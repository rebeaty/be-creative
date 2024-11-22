from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError, validator
import openai
import os
import json
from datetime import datetime
import dateutil.parser
from pathlib import Path
from dotenv import load_dotenv
import logging
from typing import Dict, Any, Optional, Literal, List, Union
import boto3
from io import StringIO, BytesIO
import csv
import requests
from PIL import Image
import dns.resolver
import socket
import requests.adapters
import asyncio
from urllib.parse import urlparse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI()

# Add CORS middleware
origins = [
    "http://localhost:3000",      # React development server
    "http://localhost:8000",      # FastAPI backend
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize OpenAI API
openai.api_key = os.getenv('OPENAI_API_KEY')
if not openai.api_key:
    raise ValueError("OPENAI_API_KEY environment variable is not set")

# Check if running on Heroku
def is_heroku():
    return 'DYNO' in os.environ

# Initialize S3 only if on Heroku and AWS creds exist
if is_heroku() and os.getenv('AWS_ACCESS_KEY_ID'):
    s3 = boto3.client(
        's3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
    )
    BUCKET_NAME = os.getenv('AWS_BUCKET_NAME')
else:
    s3 = None
    BUCKET_NAME = None

# Custom DNS Resolver
class CustomDNSResolver:
    def __init__(self):
        self.resolver = dns.resolver.Resolver()
        self.resolver.nameservers = ['8.8.8.8', '8.8.4.4']  # Google's DNS servers

    def __call__(self, host):
        try:
            return socket.gethostbyname(host)
        except socket.gaierror:
            try:
                answers = self.resolver.resolve(host, 'A')
                return str(answers[0])
            except Exception as e:
                logger.error(f"DNS resolution failed for {host}: {str(e)}")
                raise

# Models for request/response validation
class TimingData(BaseModel):
    firstKeypressLatency: Optional[float] = Field(None, ge=0)
    totalResponseTime: Optional[float] = Field(None, ge=0)

class AiExperienceSurvey(BaseModel):
    genAiExperience: Literal['none', 'basic', 'intermediate', 'advanced']
    textToImageExperience: Literal['never', 'rarely', 'sometimes', 'often', 'very_often']
    toolsUsed: Dict[str, bool]
    otherTools: Optional[str] = None

class SurveySubmission(BaseModel):
    prolificId: str = Field(..., min_length=1)
    survey: AiExperienceSurvey
    timestamp: str

class PromptSubmission(BaseModel):
    prolificId: str = Field(..., min_length=1)
    trialIndex: int = Field(..., ge=0, lt=4)
    condition: Literal['BE_CREATIVE', 'BE_FLUENT', 'practice']
    theme: str
    prompts: List[str]
    isPractice: bool
    conditionOrder: Literal['creative_first', 'fluent_first']
    timingData: Optional[TimingData] = None
    timestamp: str

    @validator('prompts')
    def validate_prompts(cls, v):
        if not v:
            raise ValueError('Prompts list cannot be empty')
        if any(len(prompt) > 500 for prompt in v):
            raise ValueError('Prompt too long')
        return v

class ImageGeneration(BaseModel):
    prompts: List[str] = Field(..., max_items=2)
    prolificId: str = Field(..., min_length=1)
    timestamp: str

    @validator('prompts')
    def validate_prompts(cls, v):
        if not v or len(v) > 2:
            raise ValueError('Must provide 1-2 prompts')
        if any(len(prompt) > 500 for prompt in v):
            raise ValueError('Prompt too long')
        return v

class ImageSelection(BaseModel):
    prolificId: str = Field(..., min_length=1)
    trialIndex: int
    condition: Literal['BE_CREATIVE', 'BE_FLUENT', 'practice']
    theme: str
    selectedPrompt: str
    isPractice: bool
    conditionOrder: Literal['creative_first', 'fluent_first']
    timestamp: str

# Local Storage Class
class LocalStorage:
    def __init__(self):
        pass

    @staticmethod
    def save_to_csv(data_dict: dict, csv_path: Path):
        try:
            is_new_file = not csv_path.exists()
            
            with open(csv_path, "a", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=data_dict.keys())
                if is_new_file:
                    writer.writeheader()
                writer.writerow(data_dict)
            
            return True
        except Exception as e:
            logger.error(f"Error saving to CSV: {str(e)}")
            raise

    @staticmethod
    def save_json(content: dict, json_path: Path):
        try:
            with open(json_path, "w", encoding="utf8") as f:
                json.dump(content, f, ensure_ascii=False, indent=4)
            return True
        except Exception as e:
            logger.error(f"Error saving JSON: {str(e)}")
            raise

    @staticmethod
    async def save_image(image_url: str, image_path: Path):
        try:
            # Create a session with retry configuration
            session = requests.Session()
            retries = requests.adapters.Retry(
                total=3,
                backoff_factor=0.5,
                status_forcelist=[500, 502, 503, 504]
            )
            session.mount('https://', requests.adapters.HTTPAdapter(max_retries=retries))
            
            try:
                # Try direct download first
                response = session.get(image_url, timeout=30)
                response.raise_for_status()
            except (requests.exceptions.RequestException, requests.exceptions.ConnectionError) as e:
                logger.warning(f"Direct download failed, trying with DNS resolver: {str(e)}")
                
                # If direct download fails, try with custom DNS resolver
                resolver = CustomDNSResolver()
                parsed_url = urlparse(image_url)
                try:
                    ip = resolver(parsed_url.hostname)
                    url_with_ip = image_url.replace(parsed_url.hostname, ip)
                    response = session.get(
                        url_with_ip,
                        headers={'Host': parsed_url.hostname},
                        timeout=30
                    )
                    response.raise_for_status()
                except Exception as dns_error:
                    logger.error(f"DNS resolution approach failed: {str(dns_error)}")
                    raise
            
            # Ensure directory exists
            image_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save the image
            image = Image.open(BytesIO(response.content))
            image.save(image_path, format='PNG')
            return True
            
        except Exception as e:
            logger.error(f"Error saving image: {str(e)}")
            raise

# Helper functions for CSV storage
def create_survey_dict(submission: SurveySubmission) -> dict:
    """Create flattened dictionary for CSV storage"""
    return {
        'timestamp': submission.timestamp,
        'prolificId': submission.prolificId,
        'genAiExperience': submission.survey.genAiExperience,
        'textToImageExperience': submission.survey.textToImageExperience,
        'toolsUsed': json.dumps(submission.survey.toolsUsed),
        'otherTools': submission.survey.otherTools
    }

def create_prompt_dict(submission: PromptSubmission) -> dict:
    """Create flattened dictionary for CSV storage"""
    return {
        'timestamp': submission.timestamp,
        'prolificId': submission.prolificId,
        'trialIndex': submission.trialIndex,
        'condition': submission.condition,
        'theme': submission.theme,
        'promptCount': len(submission.prompts),
        'prompts': json.dumps(submission.prompts),
        'isPractice': submission.isPractice,
        'conditionOrder': submission.conditionOrder,
        'firstKeypressLatency': submission.timingData.firstKeypressLatency if submission.timingData else None,
        'totalResponseTime': submission.timingData.totalResponseTime if submission.timingData else None
    }

def create_selection_dict(selection: ImageSelection) -> dict:
    """Create flattened dictionary for CSV storage"""
    return {
        'timestamp': selection.timestamp,
        'prolificId': selection.prolificId,
        'trialIndex': selection.trialIndex,
        'condition': selection.condition,
        'theme': selection.theme,
        'selectedPrompt': selection.selectedPrompt,
        'isPractice': selection.isPractice,
        'conditionOrder': selection.conditionOrder
    }

# API Endpoints
@app.post("/api/save-survey")
async def save_survey(submission: SurveySubmission):
    try:
        logger.info(f"Received survey submission: {submission.dict()}")
        
        # Create data directory if it doesn't exist
        data_dir = Path("data")
        data_dir.mkdir(exist_ok=True)
        
        survey_dict = create_survey_dict(submission)
        safe_timestamp = submission.timestamp.replace(':', '-')

        # Save to CSV
        csv_path = data_dir / "surveys.csv"
        storage = LocalStorage()
        storage.save_to_csv(survey_dict, csv_path)

        # Save JSON for complete data
        participant_dir = data_dir / submission.prolificId
        participant_dir.mkdir(exist_ok=True)
        json_path = participant_dir / f"survey_{safe_timestamp}.json"
        storage.save_json(submission.dict(), json_path)

        return {
            "status": "success",
            "message": "Survey saved successfully"
        }

    except ValidationError as e:
        logger.error(f"Validation error: {e.json()}")
        raise HTTPException(status_code=422, detail=e.errors())
    except Exception as e:
        logger.error(f"Error in save_survey: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/save-prompts")
async def save_prompts(submission: PromptSubmission):
    try:
        logger.info(f"Saving prompts for participant: {submission.prolificId}")

        if not submission.isPractice:
            # Create data directory if it doesn't exist
            data_dir = Path("data")
            data_dir.mkdir(exist_ok=True)
            
            prompt_dict = create_prompt_dict(submission)
            safe_timestamp = submission.timestamp.replace(':', '-')

            # Save to CSV
            csv_path = data_dir / "prompts.csv"
            storage = LocalStorage()
            storage.save_to_csv(prompt_dict, csv_path)

            # Save JSON for complete data
            participant_dir = data_dir / submission.prolificId
            participant_dir.mkdir(exist_ok=True)
            json_path = participant_dir / f"prompts_{submission.trialIndex}_{safe_timestamp}.json"
            storage.save_json(submission.dict(), json_path)

            return {
                "status": "success",
                "message": "Prompts saved successfully"
            }
        else:
            return {
                "status": "success",
                "message": "Practice prompts acknowledged (not saved)"
            }

    except ValidationError as e:
        logger.error(f"Validation error: {e.json()}")
        raise HTTPException(status_code=422, detail=e.errors())
    except Exception as e:
        logger.error(f"Error in save_prompts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-images")
async def generate_images(request: ImageGeneration):
    try:
        logger.info(f"Generating images for participant: {request.prolificId}")
        
        image_responses = []
        data_dir = Path("data")
        data_dir.mkdir(exist_ok=True)

        client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        
        for i, prompt in enumerate(request.prompts):
            try:
                logger.info(f"Sending prompt to DALL-E: {prompt}")
                
                response = client.images.generate(
                    model="dall-e-3",
                    prompt=prompt,
                    n=1,
                    size="1024x1024",
                    response_format="url"
                )
                
                image_url = response.data[0].url
                logger.info(f"Successfully generated image {i+1}")
                
                # Save image with retries
                participant_dir = data_dir / request.prolificId / "images"
                participant_dir.mkdir(exist_ok=True, parents=True)
                
                safe_timestamp = request.timestamp.replace(':', '-')
                image_path = participant_dir / f"image_{safe_timestamp}_{i}.png"
                
                logger.info(f"Saving image to {image_path}")
                await LocalStorage.save_image(image_url, image_path)
                image_responses.append(image_url)
                
            except Exception as img_error:
                logger.error(f"Error processing image {i+1}: {str(img_error)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Image processing failed for prompt {i+1}: {str(img_error)}"
                )

        if not image_responses:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate any images"
            )

        return {
            "status": "success",
            "images": image_responses
        }

    except Exception as e:
        logger.error(f"Error in generate_images: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Image generation failed: {str(e)}"
        )

@app.post("/api/save-selection")
async def save_selection(selection: ImageSelection):
    try:
        logger.info(f"Saving selection for participant: {selection.prolificId}")

        if not selection.isPractice:
            # Create data directory if it doesn't exist
            data_dir = Path("data")
            data_dir.mkdir(exist_ok=True)
            
            selection_dict = create_selection_dict(selection)
            safe_timestamp = selection.timestamp.replace(':', '-')

            # Save to CSV
            csv_path = data_dir / "selections.csv"
            storage = LocalStorage()
            storage.save_to_csv(selection_dict, csv_path)

            # Save JSON for complete data
            participant_dir = data_dir / selection.prolificId
            participant_dir.mkdir(exist_ok=True)
            json_path = participant_dir / f"selection_{selection.trialIndex}_{safe_timestamp}.json"
            storage.save_json(selection.dict(), json_path)

            return {
                "status": "success",
                "message": "Selection saved successfully"
            }
        else:
            return {
                "status": "success",
                "message": "Practice selection acknowledged (not saved)"
            }

    except ValidationError as e:
        logger.error(f"Validation error: {e.json()}")
        raise HTTPException(status_code=422, detail=e.errors())
    except Exception as e:
        logger.error(f"Error in save_selection: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    try:
        # Test OpenAI API key
        if not openai.api_key:
            raise ValueError("OpenAI API key not configured")

        # Check data directory
        data_dir = Path("data")
        data_dir.mkdir(exist_ok=True)
        
        return {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "storage": {
                "type": "local",
                "location": str(data_dir.absolute())
            },
            "version": "1.0.0",
            "features": {
                "image_generation": True,
                "prompt_collection": True,
                "selection_tracking": True
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@app.get("/api/test")
async def test():
    """Simple test endpoint for connectivity verification."""
    return {
        "status": "connected",
        "timestamp": datetime.now().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting server...")
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)