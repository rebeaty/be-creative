from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError, validator
import openai
import os
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
import logging
from typing import Dict, Optional, Literal, List, Union
import boto3
from io import BytesIO
import csv
import requests
from PIL import Image
import dns.resolver
import socket
from urllib.parse import urlparse
from collections import defaultdict
from functools import wraps
from asyncio import Lock

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Research Task Backend", version="2.0.0")
app.mount("/data", StaticFiles(directory="data"), name="data")

# CORS middleware configuration
origins = [
    "http://localhost:3000",
    "http://localhost:8000",
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

# Initialize OpenAI
openai.api_key = os.getenv('OPENAI_API_KEY')
if not openai.api_key:
    raise ValueError("OPENAI_API_KEY environment variable is not set")

class PageTiming(BaseModel):
    prolificId: str = Field(..., min_length=1)
    page: str
    duration: int  # milliseconds
    timestamp: str

# Data Models
class TimingData(BaseModel):
    firstKeypressLatency: Optional[float] = Field(None, ge=0)
    totalResponseTime: Optional[float] = Field(None, ge=0)

class AiExperienceSurvey(BaseModel):
    genAiExperience: Literal[
        'none', 'basic', 'intermediate', 'advanced', 'expert'
    ]
    textToImageExperience: Literal[
        'never', 'rarely', 'sometimes', 'often', 'very_often'
    ]
    toolsUsed: Dict[str, bool]
    otherTools: Optional[str] = None

class SurveySubmission(BaseModel):
    prolificId: str = Field(..., min_length=1)
    survey: AiExperienceSurvey
    timestamp: str

class PromptSubmission(BaseModel):
    prolificId: str = Field(..., min_length=1)
    trialIndex: int = Field(..., ge=0, lt=7)  # 0-6 for seven trials (1 practice + 6 main)
    condition: Literal['BE_CREATIVE', 'BE_FLUENT', 'practice']
    theme: str
    prompts: List[str]
    selectedPrompt: str
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

class ImageGenerationStatus(BaseModel):
    trialIndex: int
    status: Literal['pending', 'completed', 'failed']
    prompt: str
    theme: str
    condition: str
    imagePath: Optional[str] = None
    error: Optional[str] = None
    timestamp: str

class ImageRating(BaseModel):
    prolificId: str = Field(..., min_length=1)
    trialIndex: int = Field(..., ge=0, lt=7)
    creativityRating: float = Field(..., ge=0, le=4)
    intentionRating: float = Field(..., ge=0, le=4)
    timestamp: str
    theme: str
    condition: str
    prompt: str

# Storage Helper Class
class DataStorage:
    def __init__(self, base_dir: Path = Path("data")):
        self.base_dir = base_dir
        self.base_dir.mkdir(exist_ok=True)

    def save_csv(self, data: dict, filename: str) -> None:
        filepath = self.base_dir / filename
        is_new_file = not filepath.exists()
        
        with open(filepath, "a", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=data.keys())
            if is_new_file:
                writer.writeheader()
            writer.writerow(data)

    def save_json(self, data: Union[dict, list], filepath: Path) -> None:
        filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

    def load_json(self, filepath: Path) -> Union[dict, list]:
        if not filepath.exists():
            return {}
        with open(filepath) as f:
            return json.load(f)

    async def save_image(self, image_url: str, filepath: Path) -> None:
        filepath.parent.mkdir(parents=True, exist_ok=True)
        response = requests.get(image_url)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content))
        image.save(filepath)

# Initialize storage
storage = DataStorage()

# Background Tasks Helper
async def generate_image_background(
    prolific_id: str,
    prompt: str,
    trial_index: int,
    condition: str,
    theme: str,
    timestamp: str
) -> None:
    try:
        logger.info(f"Starting background generation for trial {trial_index}")
        
        # Create status entry
        status = ImageGenerationStatus(
            trialIndex=trial_index,
            status='pending',
            prompt=prompt,
            theme=theme,
            condition=condition,
            timestamp=timestamp
        )
        
        status_path = storage.base_dir / prolific_id / "generation_status.json"
        current_status = storage.load_json(status_path)
        current_status[str(trial_index)] = status.dict()
        storage.save_json(current_status, status_path)

        # Generate image
        client = openai.OpenAI()
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            n=1,
            size="1024x1024",
            response_format="url"
        )

        # Save image
        image_path = storage.base_dir / prolific_id / "images" / f"trial_{trial_index:02d}.png"
        await storage.save_image(response.data[0].url, image_path)

        # Update status
        status.status = 'completed'
        status.imagePath = str(image_path)
        current_status[str(trial_index)] = status.dict()
        storage.save_json(current_status, status_path)

        def update_prompt_generated_status():
            temp_file = Path("data/prompts_temp.csv")
            with open("data/prompts.csv", 'r') as file, open(temp_file, 'w', newline='') as temp:
                reader = csv.DictReader(file)
                writer = csv.DictWriter(temp, fieldnames=reader.fieldnames)
                writer.writeheader()
                
                for row in reader:
                    if (row['prolificId'] == prolific_id and 
                        int(row['trialIndex']) == trial_index and 
                        row['prompt'] == prompt):
                        row['generated'] = True
                    writer.writerow(row)
                    
            temp_file.replace(Path("data/prompts.csv"))

        update_prompt_generated_status()

        logger.info(f"Completed background generation for trial {trial_index}")

    except Exception as e:
        logger.error(f"Error in background generation for trial {trial_index}: {str(e)}")
        status.status = 'failed'
        status.error = str(e)
        current_status[str(trial_index)] = status.dict()
        storage.save_json(current_status, status_path)

        # API Endpoints
@app.post("/api/save-survey")
async def save_survey(submission: SurveySubmission):
    try:
        logger.info(f"Saving survey for participant: {submission.prolificId}")
        
        # Save to CSV
        survey_dict = {
            'timestamp': submission.timestamp,
            'prolificId': submission.prolificId,
            'genAiExperience': submission.survey.genAiExperience,
            'textToImageExperience': submission.survey.textToImageExperience,
            'toolsUsed': json.dumps(submission.survey.toolsUsed),
            'otherTools': submission.survey.otherTools
        }
        storage.save_csv(survey_dict, "surveys.csv")

        # Save detailed JSON
        survey_path = storage.base_dir / submission.prolificId / "survey.json"
        storage.save_json(submission.dict(), survey_path)

        return {"status": "success", "message": "Survey saved successfully"}
    except Exception as e:
        logger.error(f"Error in save_survey: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/save-prompt")
async def save_prompt(submission: PromptSubmission, background_tasks: BackgroundTasks):
    try:
        logger.info(f"Saving prompts for participant {submission.prolificId}, trial {submission.trialIndex}")

# Save each prompt as a separate row
        for index, prompt in enumerate(submission.prompts, start=1):
            if prompt.strip():  # Only save non-empty prompts
                prompt_dict = {
                    'timestamp': submission.timestamp,
                    'prolificId': submission.prolificId,
                    'trialIndex': submission.trialIndex,
                    'condition': submission.condition,
                    'theme': submission.theme,
                    'prompt': prompt,
                    'selected': prompt == submission.selectedPrompt,
                    'generated': False,  # Will be updated when image is generated
                    'trial_pos': index,
                    'isPractice': submission.isPractice,
                    'conditionOrder': submission.conditionOrder,
                    'firstKeypressLatency': submission.timingData.firstKeypressLatency if submission.timingData else None,
                    'totalResponseTime': submission.timingData.totalResponseTime if submission.timingData else None
                }
                storage.save_csv(prompt_dict, "prompts.csv")

        # Save detailed JSON for the trial
        trial_path = storage.base_dir / submission.prolificId / f"trial_{submission.trialIndex}.json"
        storage.save_json(submission.dict(), trial_path)

 # Start background image generation if a prompt was selected
        if submission.selectedPrompt:
            background_tasks.add_task(
                generate_image_background,
                submission.prolificId,
                submission.selectedPrompt,
                submission.trialIndex,
                submission.condition,
                submission.theme,
                submission.timestamp
            )

        return {"status": "success", "message": "Prompt saved and image generation initiated"}
    except Exception as e:
        logger.error(f"Error in save_prompt: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/check-generation-status/{prolific_id}")
async def check_generation_status(prolific_id: str):
    try:
        status_path = storage.base_dir / prolific_id / "generation_status.json"
        status = storage.load_json(status_path)
        
        all_completed = all(
            status.get(str(i), {}).get('status') == 'completed'
            for i in range(7)  # Check all 7 trials
        )
        
        return {
            "status": "ready" if all_completed else "pending",
            "completedTrials": sum(
                1 for i in range(7)
                if status.get(str(i), {}).get('status') == 'completed'
            )
        }
    except Exception as e:
        logger.error(f"Error checking generation status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-all-images/{prolific_id}")
async def get_all_images(prolific_id: str):
    try:
        status_path = storage.base_dir / prolific_id / "generation_status.json"
        if not status_path.exists():
            raise HTTPException(status_code=404, detail="No images found")

        status = storage.load_json(status_path)
        base_url = os.getenv('API_URL', 'http://localhost:8000')
        
        images = []
        for trial_index in range(7):
            trial_status = status.get(str(trial_index))
            if trial_status and trial_status['status'] == 'completed':
                images.append({
                    'trialIndex': trial_index,
                    'imagePath': f"{base_url}/data/{prolific_id}/images/trial_{trial_index:02d}.png",
                    'prompt': trial_status['prompt'],
                    'theme': trial_status['theme'],
                    'condition': trial_status['condition']
                })

        if not images:
            raise HTTPException(status_code=404, detail="No completed images found")

        return {'images': sorted(images, key=lambda x: x['trialIndex'])}
    except Exception as e:
        logger.error(f"Error retrieving images: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/save-ratings")
async def save_ratings(ratings: List[ImageRating]):
    try:
        logger.info(f"Saving ratings for participant: {ratings[0].prolificId}")
        
        # Save each rating to CSV
        for rating in ratings:
            rating_dict = {
                'timestamp': rating.timestamp,
                'prolificId': rating.prolificId,
                'trialIndex': rating.trialIndex,
                'creativityRating': rating.creativityRating,
                'intentionRating': rating.intentionRating,
                'theme': rating.theme,
                'condition': rating.condition
            }
            storage.save_csv(rating_dict, "ratings.csv")

        # Save complete ratings JSON
        ratings_path = storage.base_dir / ratings[0].prolificId / "ratings.json"
        storage.save_json([r.dict() for r in ratings], ratings_path)

        return {"status": "success", "message": "Ratings saved successfully"}
    except Exception as e:
        logger.error(f"Error saving ratings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    try:
        return {
            "status": "healthy",
            "version": "2.0.0",
            "timestamp": datetime.now().isoformat(),
            "storage": {
                "type": "local",
                "location": str(storage.base_dir.absolute())
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/api/save-timing")
async def save_timing(timing: PageTiming):
    try:
        logger.info(f"Saving page timing for participant: {timing.prolificId}")
        
        timing_dict = {
            'timestamp': timing.timestamp,
            'prolificId': timing.prolificId,
            'page': timing.page,
            'duration_ms': timing.duration,
            'duration_seconds': timing.duration / 1000
        }
        
        # Save to CSV
        storage.save_csv(timing_dict, "page_timings.csv")
        
        return {"status": "success", "message": "Timing saved successfully"}
    except Exception as e:
        logger.error(f"Error saving timing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))    
    
@app.post("/api/mark-completion")
async def mark_completion(
    prolific_id: str,
    timestamp: str
):
    try:
        completion_data = {
            "prolificId": prolific_id,
            "timestamp": timestamp,
            "completedAt": datetime.now().isoformat()
        }
        
        # Save to CSV
        storage.save_csv(completion_data, "completions.csv")
        
        # Save individual JSON
        completion_path = storage.base_dir / prolific_id / "completion.json"
        storage.save_json(completion_data, completion_path)
        
        return {"status": "success", "message": "Completion recorded"}
    except Exception as e:
        logger.error(f"Error recording completion: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Main entry point
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)