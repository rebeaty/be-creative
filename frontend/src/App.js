import React, { useState, useEffect, useCallback, useRef } from 'react';

// Configurable Constants
const TRIAL_TIME = 35; // 3 minutes in seconds
const WARNING_TIME = 30; // 30 seconds warning threshold

const PRACTICE_THEME = "Any subject - create some test prompts";
const TRIAL_THEMES = [
  "Nature and landscapes",
  "Urban life and cities",
  "Emotions and feelings",
  "Science and technology"
];

const CONDITIONS = {
  BE_CREATIVE: {
    id: 'BE_CREATIVE',
    instructions: `The goal is to come up with creative prompts, which are prompts that elicit clever, unusual, interesting, uncommon, humorous, innovative, or different images from the AI.

Your prompt ideas should be new to you, meaning you have never seen, heard, or thought of them before.

You'll have 3 minutes to enter prompts. It's more important to come up with creative prompts than many prompts.`
  },
  BE_FLUENT: {
    id: 'BE_FLUENT',
    instructions: `The goal is to come up with as many prompts as possible.

You'll have 3 minutes to enter as many prompts as you can.`
  }
};

// Utility Functions
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Base Components
const Card = ({ children }) => (
  <div className="bg-white shadow-lg rounded-lg p-6 relative mb-16">
    {children}
  </div>
);

const Button = ({ children, onClick, disabled, className = '', type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium
    hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
    transition-colors ${className}`}
  >
    {children}
  </button>
);

// UI Components
const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-6 rounded-lg shadow-xl">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <p className="text-gray-700">Processing...</p>
      </div>
    </div>
  </div>
);

const ErrorDisplay = ({ message }) => message ? (
  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg mt-4">
    <p className="text-red-700">{message}</p>
  </div>
) : null;

const Timer = ({ seconds, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [isWarning, setIsWarning] = useState(false);
  const intervalRef = useRef(null);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete reference updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Setup timer
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Don't start if already at 0
    if (timeLeft <= 0) {
      onCompleteRef.current?.();
      return;
    }

    // Start new interval
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        // Check for warning state
        if (prev <= WARNING_TIME && !isWarning) {
          setIsWarning(true);
        }

        // Check for completion
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          onCompleteRef.current?.();
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeLeft, isWarning]);

  // Format time display
  const minutes = Math.floor(timeLeft / 60);
  const remainingSeconds = timeLeft % 60;
  const timeDisplay = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;

  return (
    <div 
      className={`fixed top-4 right-4 z-50 transition-colors duration-300
        ${isWarning 
          ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' 
          : 'bg-blue-50 text-blue-700 border-blue-200'} 
        border rounded-md px-4 py-2 text-sm font-medium shadow-lg`}
    >
      {timeDisplay}
    </div>
  );
};

// Initial Components
const ProlificIdEntry = ({ onSubmit }) => {
  const [id, setId] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (id.trim()) {
      onSubmit(id);
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">Welcome</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="prolificId" className="block text-gray-700 mb-2">
            Prolific ID:
          </label>
          <input
            id="prolificId"
            type="text"
            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="Enter your Prolific ID"
          />
        </div>
        <Button type="submit" disabled={!id.trim()}>Continue</Button>
      </form>
    </Card>
  );
};

const AiExperienceSurvey = ({ onSubmit }) => {
  const [responses, setResponses] = useState({
    genAiExperience: '',
    textToImageExperience: '',
    toolsUsed: {
      dall_e: false,
      midjourney: false,
      stable_diffusion: false,
      other: false
    },
    otherTools: ''
  });
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    
    // Validate required fields
    if (!responses.genAiExperience || !responses.textToImageExperience) {
      setError('Please fill in all required fields');
      return;
    }

    // Clean up the response
    const cleanedResponses = {
      ...responses,
      otherTools: responses.toolsUsed.other ? responses.otherTools : null
    };

    console.log('Submitting survey responses:', cleanedResponses);
    onSubmit(cleanedResponses);
  };

  return (
    <Card>
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">Experience Survey</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-gray-700 mb-2">
            How would you rate your experience with generative AI tools (e.g., ChatGPT)?
          </label>
          <select
            className="w-full p-3 border rounded-lg"
            value={responses.genAiExperience}
            onChange={(e) => setResponses(prev => ({...prev, genAiExperience: e.target.value}))}
            required
          >
            <option value="">Select an option</option>
            <option value="none">No experience</option>
            <option value="basic">Basic experience</option>
            <option value="intermediate">Intermediate experience</option>
            <option value="advanced">Advanced experience</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-700 mb-2">
            How often do you use text-to-image generation tools?
          </label>
          <select
            className="w-full p-3 border rounded-lg"
            value={responses.textToImageExperience}
            onChange={(e) => setResponses(prev => ({...prev, textToImageExperience: e.target.value}))}
            required
          >
            <option value="">Select an option</option>
            <option value="never">Never</option>
            <option value="rarely">Rarely</option>
            <option value="sometimes">Sometimes</option>
            <option value="often">Often</option>
            <option value="very_often">Very often</option>
          </select>
        </div>

        <div>
          <label className="block text-gray-700 mb-2">
            Which text-to-image tools have you used? (Select all that apply)
          </label>
          <div className="space-y-2">
            {Object.entries({
              dall_e: "DALL-E",
              midjourney: "Midjourney",
              stable_diffusion: "Stable Diffusion",
              other: "Other"
            }).map(([key, label]) => (
              <label key={key} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={responses.toolsUsed[key]}
                  onChange={(e) => setResponses(prev => ({
                    ...prev,
                    toolsUsed: {
                      ...prev.toolsUsed,
                      [key]: e.target.checked
                    }
                  }))}
                  className="h-4 w-4"
                />
                <span className="text-gray-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {responses.toolsUsed.other && (
          <div>
            <label className="block text-gray-700 mb-2">
              Please specify other tools:
            </label>
            <input
              type="text"
              className="w-full p-3 border rounded-lg"
              value={responses.otherTools}
              onChange={(e) => setResponses(prev => ({...prev, otherTools: e.target.value}))}
              placeholder="Enter other tools..."
            />
          </div>
        )}

        <Button type="submit">Continue</Button>
      </form>
    </Card>
  );
};

const ConsentForm = ({ onAccept }) => (
  <Card>
    <h2 className="text-2xl font-semibold text-blue-600 mb-6">Research Consent Form</h2>
    <div className="space-y-6 max-h-[60vh] overflow-y-auto p-4">
      <section>
        <h3 className="text-xl font-semibold mb-2">Purpose of the Study</h3>
        <p className="text-gray-700">
          This research is being done to study how people work together with generative artificial 
          intelligence to pursue creative goals. You are being asked to participate because you are 
          a healthy adult.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Study Procedures</h3>
        <p className="text-gray-700">
          Your main task will be to create text prompts for an AI tool which will transform them 
          into images. This involves typing your image ideas and selecting the best ones. You will 
          additionally complete a set of intelligence measures, creativity tasks, and personality 
          questionnaires. It is necessary to complete this study in a quiet environment, using a 
          PC/Laptop or a Tablet.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Duration & Compensation</h3>
        <p className="text-gray-700">
          The study will take approximately 45 minutes to complete. You will be paid for your participation.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Risks & Benefits</h3>
        <p className="text-gray-700">
          The confidentiality of your electronic data will be maintained to the degree permitted by the 
          technology used. Absolute confidentiality cannot be guaranteed. The study will improve our 
          knowledge about human creativity and human-AI interaction.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Voluntary Participation</h3>
        <p className="text-gray-700">
          Your participation is voluntary. You may choose not to participate or withdraw at any time 
          without penalty.
        </p>
      </section>
    </div>

    <div className="mt-6">
      <Button onClick={onAccept}>I Agree to Participate</Button>
    </div>
  </Card>
);

const InternetUsageAgreement = ({ onContinue }) => {
  const [agreed, setAgreed] = useState(false);
  
  return (
    <Card>
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">Important Information</h2>
      <div className="space-y-6">
        <div className="bg-amber-50 p-4 rounded-lg">
          <p className="font-medium text-gray-800">Please note:</p>
          <p className="text-gray-700 mt-2">
            Do not use the Internet (e.g., web search) or any other assistance (e.g., AI tools like ChatGPT) 
            while completing the tasks and questionnaires. We want to understand your natural creative 
            thinking process.
          </p>
        </div>

        <p className="text-gray-700">
          To ensure this:
        </p>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>Copy and paste has been disabled</li>
          <li>Right-click context menu has been disabled</li>
          <li>Please close any other browser tabs or windows</li>
        </ul>

        <div className="flex items-center space-x-2">
          <input 
            type="checkbox" 
            id="agreement" 
            className="h-4 w-4" 
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <label htmlFor="agreement" className="text-gray-700">
            I agree not to use the internet or other assistance during this study
          </label>
        </div>

        <Button 
          onClick={onContinue}
          disabled={!agreed}
        >
          Continue
        </Button>
      </div>
    </Card>
  );
};

const GeneralInstructions = ({ onContinue }) => (
  <Card>
    <h2 className="text-2xl font-semibold text-blue-600 mb-6">Study Overview</h2>
    <div className="space-y-6">
      <p className="text-gray-700">
        In this study, you'll work with an AI system to bring image ideas to life. You will produce 
        sets of written commands (called "prompts") that will be interpreted by an AI image generation tool.
      </p>

      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <h3 className="font-semibold text-gray-800">Study Structure:</h3>
        <ul className="list-disc pl-5 space-y-2 text-gray-700">
          <li>You'll first complete a practice round to get familiar with the task</li>
          <li>Then you'll complete four main trials with different themes</li>
          <li>For each trial, you'll have 3 minutes to write your prompts</li>
          <li>After each trial, you'll select your best prompts</li>
          <li>The AI will generate images based on your selected prompts</li>
        </ul>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-blue-800">
          Each prompt should describe a unique image idea - for example, a scenery, an emotion, 
          a moment in time, or whatever you'd like to create.
        </p>
      </div>

      <div className="bg-amber-50 p-4 rounded-lg space-y-2">
        <p className="font-medium text-amber-800">Important Tips:</p>
        <ul className="list-disc pl-5 space-y-1 text-amber-800">
          <li>Use specific and clear language so the AI understands your idea</li>
          <li>Vague prompts (e.g., single words) may be misinterpreted by the AI</li>
          <li>Avoid explicit language or inappropriate content</li>
        </ul>
      </div>

      <Button onClick={onContinue}>Continue</Button>
    </div>
  </Card>
);

const PracticeInstructions = ({ onContinue }) => (
  <Card>
    <h2 className="text-2xl font-semibold text-blue-600 mb-6">Practice Round</h2>
    <div className="space-y-6">
      <p className="text-gray-700">
        Let's start with a practice round to help you get familiar with the task.
      </p>

      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <p className="text-gray-800">During this practice round, you will:</p>
        <ol className="list-decimal pl-5 space-y-2 text-gray-700">
          <li>Have 3 minutes to write your prompts</li>
          <li>Select your top two prompts after time is up</li>
          <li>See the AI-generated images for your selected prompts</li>
          <li>Choose which image you think is most creative</li>
        </ol>
      </div>

      <p className="text-gray-700">
        Click continue when you're ready to begin the practice round.
      </p>

      <Button onClick={onContinue}>Begin Practice</Button>
    </div>
  </Card>
);

const PromptInput = ({ onSubmit, theme, condition, isPractice }) => {
  const [prompts, setPrompts] = useState(['']);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const responseStartRef = useRef(new Date());
  const [firstKeypressTime, setFirstKeypressTime] = useState(null);
  const [firstKeypressRecorded, setFirstKeypressRecorded] = useState(false);
  const promptsRef = useRef(prompts);

  // Keep promptsRef updated
  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  // Handle initial animations
  useEffect(() => {
    const instructionsTimer = setTimeout(() => setShowInstructions(true), 400);
    const themeTimer = setTimeout(() => setShowTheme(true), 800);

    return () => {
      clearTimeout(instructionsTimer);
      clearTimeout(themeTimer);
    };
  }, []);

  const handleKeyPress = useCallback((e) => {
    if (!firstKeypressRecorded) {
      setFirstKeypressTime(new Date());
      setFirstKeypressRecorded(true);
    }
  }, [firstKeypressRecorded]);

  const handlePromptChange = useCallback((index, value) => {
    setPrompts(prev => {
      const newPrompts = [...prev];
      newPrompts[index] = value;
      if (index === prev.length - 1 && value.trim()) {
        newPrompts.push('');
      }
      return newPrompts;
    });
  }, []);

  const handleTimerComplete = useCallback(() => {
    const filteredPrompts = promptsRef.current.filter(prompt => prompt.trim());
    const timingData = {
      firstKeypressLatency: firstKeypressTime ? 
        (firstKeypressTime - responseStartRef.current) / 1000 : null,
      totalResponseTime: TRIAL_TIME
    };
    onSubmit(filteredPrompts, timingData);
  }, [firstKeypressTime, onSubmit]);

  return (
    <div className="relative">
      <Timer seconds={TRIAL_TIME} onComplete={handleTimerComplete} />
      
      <Card>
        <div className={`transition-all duration-500 ${showInstructions ? 'opacity-100' : 'opacity-0'}`}>
          {!isPractice && condition && (
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <p className="text-blue-800 whitespace-pre-line">
                {CONDITIONS[condition].instructions}
              </p>
            </div>
          )}
        </div>

        <div className={`transition-all duration-500 ${showTheme ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-gray-800">Theme:</h3>
            <p className="text-gray-700 mt-2">{theme}</p>
          </div>

          <div className="space-y-4">
            {prompts.map((prompt, index) => (
              <input
                key={index}
                type="text"
                className="w-full p-3 border-2 border-gray-200 rounded-lg
                  focus:outline-none focus:border-blue-500"
                placeholder="Type your prompt here..."
                value={prompt}
                onChange={(e) => handlePromptChange(index, e.target.value)}
                onKeyPress={handleKeyPress}
                onPaste={(e) => e.preventDefault()}
                onCopy={(e) => e.preventDefault()}
                onCut={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()}
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

const PromptSelection = ({ prompts, onSubmit, maxSelections = 2 }) => {
  const [selectedPrompts, setSelectedPrompts] = useState([]);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const togglePrompt = (prompt) => {
    if (selectedPrompts.includes(prompt)) {
      setSelectedPrompts(prev => prev.filter(p => p !== prompt));
    } else if (selectedPrompts.length < maxSelections) {
      setSelectedPrompts(prev => [...prev, prompt]);
    }
  };

  return (
    <Card>
      <div className={`transition-all duration-500 ${showContent ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform -translate-y-4'}`}>
        <h2 className="text-2xl font-semibold text-blue-600 mb-6">
          Select Your Best Prompts
        </h2>

        <p className="text-gray-700 mb-4">
          Please select your {maxSelections} best prompts:
        </p>

        <div className="space-y-3 mb-6">
          {prompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => togglePrompt(prompt)}
              className={`w-full p-4 rounded-lg text-left transition-colors
                ${selectedPrompts.includes(prompt)
                  ? 'bg-blue-100 border-2 border-blue-500'
                  : 'bg-gray-50 border-2 border-transparent hover:border-blue-200'
                }`}
              disabled={!selectedPrompts.includes(prompt) && selectedPrompts.length >= maxSelections}
            >
              <p className="text-gray-800">{prompt}</p>
            </button>
          ))}
        </div>

        <Button
          onClick={() => onSubmit(selectedPrompts)}
          disabled={selectedPrompts.length !== maxSelections}
        >
          Generate Images
        </Button>
      </div>
    </Card>
  );
};

const ImageDisplay = ({ images, prompts, onSelect, onContinue }) => {
  const [selectedImage, setSelectedImage] = useState(null);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleImageSelection = (index) => {
    setSelectedImage(index);
    onSelect?.(index);
  };

  return (
    <Card>
      <div className={`transition-all duration-500 ${showContent ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform -translate-y-4'}`}>
        <h2 className="text-2xl font-semibold text-blue-600 mb-6">
          Generated Images
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {images.map((image, index) => (
            <div key={index} className="space-y-3">
              <button
                onClick={() => handleImageSelection(index)}
                className={`w-full aspect-square rounded-lg overflow-hidden transition-all
                  ${selectedImage === index
                    ? 'ring-4 ring-blue-500'
                    : 'hover:ring-2 hover:ring-blue-200'
                  }`}
              >
                <img
                  src={image}
                  alt={`Generated from: ${prompts[index]}`}
                  className="w-full h-full object-cover"
                />
              </button>
              <p className="text-sm text-gray-600 italic">
                "{prompts[index]}"
              </p>
            </div>
          ))}
        </div>

        <Button
          onClick={onContinue}
          disabled={selectedImage === null}
        >
          Continue
        </Button>
      </div>
    </Card>
  );
};

const MainTrialTransition = ({ onContinue, condition }) => (
  <Card>
    <h2 className="text-2xl font-semibold text-blue-600 mb-6">Main Study</h2>
    <div className="space-y-6">
      <p className="text-gray-700">
        You've completed the practice round. Now we'll begin the main study.
      </p>

      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-blue-800 whitespace-pre-line">
          {CONDITIONS[condition].instructions}
        </p>
      </div>

      <Button onClick={onContinue}>Begin Main Study</Button>
    </div>
  </Card>
);

const ThankYou = () => (
  <Card>
    <h2 className="text-2xl font-semibold text-blue-600 mb-6">Thank You!</h2>
    <div className="space-y-6">
      <p className="text-gray-700">
        You have completed the image generation portion of the study. You will now be redirected 
        to a final survey.
      </p>
      <div className="text-center">
        <Button onClick={() => {
          // Replace with actual survey URL
          window.location.href = "https://survey-url-here.com";
        }}>
          Continue to Survey
        </Button>
      </div>
    </div>
  </Card>
);

// Main App Component
const TextToImageApp = () => {
  const [currentPage, setCurrentPage] = useState('prolificId');
  const [prolificId, setProlificId] = useState('');
  const [surveyResponses, setSurveyResponses] = useState(null);
  const [currentPrompts, setCurrentPrompts] = useState([]);
  const [currentImages, setCurrentImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isPractice, setIsPractice] = useState(true);
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [timingData, setTimingData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Randomly assign condition order
  const [conditions] = useState(() => {
    const isCreativeFirst = Math.random() < 0.5;
    return {
      order: isCreativeFirst ? 'creative_first' : 'fluent_first',
      sequence: isCreativeFirst
        ? [CONDITIONS.BE_CREATIVE, CONDITIONS.BE_CREATIVE, CONDITIONS.BE_FLUENT, CONDITIONS.BE_FLUENT]
        : [CONDITIONS.BE_FLUENT, CONDITIONS.BE_FLUENT, CONDITIONS.BE_CREATIVE, CONDITIONS.BE_CREATIVE]
    };
  });

  // Randomize themes for main trials
  const [trialThemes] = useState(() => shuffleArray([...TRIAL_THEMES]));

  const getCurrentTrial = useCallback(() => {
    if (isPractice) {
      return {
        theme: PRACTICE_THEME,
        condition: null
      };
    }
    return {
      theme: trialThemes[currentTrialIndex],
      condition: conditions.sequence[currentTrialIndex]
    };
  }, [isPractice, currentTrialIndex, trialThemes, conditions.sequence]);

  // In App.js, update the survey submission code:

// Replace the handleAiExperienceSurveySubmit function with this:
const handleAiExperienceSurveySubmit = async (responses) => {
  try {
    setIsLoading(true);
    setError(null);
    
    const surveyData = {
      prolificId,
      survey: {
        genAiExperience: responses.genAiExperience,
        textToImageExperience: responses.textToImageExperience,
        toolsUsed: responses.toolsUsed,
        otherTools: responses.otherTools || null
      },
      timestamp: new Date().toISOString()
    };

    // Debug logging
    console.log('Submitting survey data:', surveyData);
    console.log('API URL:', process.env.REACT_APP_API_URL);

    // Check if API URL is defined
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    
    const response = await fetch(`${apiUrl}/api/save-survey`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(surveyData)
    });

    // Log the raw response
    console.log('Raw response:', response);

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Survey submission error:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      
      let errorMessage;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.detail || 'Failed to save survey';
      } catch {
        errorMessage = 'Failed to save survey';
      }
      
      throw new Error(errorMessage);
    }

    const responseData = await response.json();
    console.log('Survey submission successful:', responseData);

    setSurveyResponses(responses);
    setCurrentPage('consent');
  } catch (err) {
    console.error('Error in survey submission:', err);
    setError(`Failed to save survey: ${err.message}`);
  } finally {
    setIsLoading(false);
  }
};

// Add these uses of the unused variables somewhere in your component:
useEffect(() => {
  // Use surveyResponses in an effect
  if (surveyResponses) {
    console.log('Survey responses updated:', surveyResponses);
  }
}, [surveyResponses]);

useEffect(() => {
  // Use selectedImage in an effect
  if (selectedImage !== null) {
    console.log('Selected image updated:', selectedImage);
  }
}, [selectedImage]);

useEffect(() => {
  // Use timingData in an effect
  if (timingData) {
    console.log('Timing data updated:', timingData);
  }
}, [timingData]);

  const handlePromptSubmit = async (prompts, timing) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const currentTrial = getCurrentTrial();
      const promptData = {
        prolificId,
        trialIndex: currentTrialIndex,
        condition: currentTrial.condition?.id || 'practice',
        theme: currentTrial.theme,
        prompts,
        isPractice,
        conditionOrder: conditions.order,
        timingData: timing,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/save-prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptData)
      });

      if (!response.ok) {
        throw new Error('Failed to save prompts');
      }

      setCurrentPrompts(prompts);
      setTimingData(timing);
      setCurrentPage('promptSelection');
    } catch (err) {
      console.error('Error saving prompts:', err);
      setError('Failed to save prompts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptSelection = async (selectedPrompts) => {
    try {
      setIsLoading(true);
      setError(null);

      const imageRes = await fetch(`${process.env.REACT_APP_API_URL}/api/generate-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompts: selectedPrompts,
          prolificId,
          timestamp: new Date().toISOString()
        })
      });

      if (!imageRes.ok) {
        const errorData = await imageRes.json();
        throw new Error(errorData.detail || 'Failed to generate images');
      }

      const imageData = await imageRes.json();
      setCurrentImages(imageData.images);
      setCurrentPrompts(selectedPrompts);
      setCurrentPage('imageDisplay');
    } catch (err) {
      console.error('Error generating images:', err);
      setError('Failed to generate images. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageSelection = async (imageIndex) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const currentTrial = getCurrentTrial();
      const selectionData = {
        prolificId,
        trialIndex: currentTrialIndex,
        condition: currentTrial.condition?.id || 'practice',
        theme: currentTrial.theme,
        selectedPrompt: currentPrompts[imageIndex],
        isPractice,
        conditionOrder: conditions.order,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/save-selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectionData)
      });

      if (!response.ok) {
        throw new Error('Failed to save selection');
      }

      setSelectedImage(imageIndex);
      handleNextTrial();
    } catch (err) {
      console.error('Error saving selection:', err);
      setError('Failed to save your selection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextTrial = useCallback(() => {
    if (isPractice) {
      setIsPractice(false);
      setCurrentTrialIndex(0);
      setCurrentPage('mainTrialTransition');
    } else {
      const nextTrialIndex = currentTrialIndex + 1;
      if (nextTrialIndex >= 4) { // Use hardcoded length instead of TRIAL_THEMES.length
        setCurrentPage('thankYou');
      } else {
        setCurrentTrialIndex(nextTrialIndex);
        setCurrentPage('promptInput');
      }
    }

    // Reset states for next trial
    setCurrentPrompts([]);
    setCurrentImages([]);
    setSelectedImage(null);
    setTimingData(null);
    setError(null);
  }, [currentTrialIndex, isPractice]); // Remove TRIAL_THEMES.length from dependencies

  // Cleanup effect for image URLs
  useEffect(() => {
    return () => {
      currentImages.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [currentImages]);

  const pageSequence = {
    prolificId: {
      component: ProlificIdEntry,
      props: {
        onSubmit: (id) => {
          setProlificId(id);
          setCurrentPage('aiExperienceSurvey');
        }
      }
    },
    aiExperienceSurvey: {
      component: AiExperienceSurvey,
      props: {
        onSubmit: handleAiExperienceSurveySubmit
      }
    },
    consent: {
      component: ConsentForm,
      props: {
        onAccept: () => setCurrentPage('internetUsage')
      }
    },
    internetUsage: {
      component: InternetUsageAgreement,
      props: {
        onContinue: () => setCurrentPage('generalInstructions')
      }
    },
    generalInstructions: {
      component: GeneralInstructions,
      props: {
        onContinue: () => setCurrentPage('practiceInstructions')
      }
    },
    practiceInstructions: {
      component: PracticeInstructions,
      props: {
        onContinue: () => setCurrentPage('promptInput')
      }
    },
    mainTrialTransition: {
      component: MainTrialTransition,
      props: {
        onContinue: () => setCurrentPage('promptInput'),
        condition: conditions.sequence[0].id
      }
    },
    promptInput: {
      component: PromptInput,
      props: {
        onSubmit: handlePromptSubmit,
        theme: getCurrentTrial().theme,
        condition: getCurrentTrial().condition?.id,
        isPractice,
        isLoading
      }
    },
    promptSelection: {
      component: PromptSelection,
      props: {
        prompts: currentPrompts,
        onSubmit: handlePromptSelection,
        isLoading
      }
    },
    imageDisplay: {
      component: ImageDisplay,
      props: {
        images: currentImages,
        prompts: currentPrompts,
        onSelect: handleImageSelection,
        onContinue: handleNextTrial,
        isLoading
      }
    },
    thankYou: {
      component: ThankYou,
      props: {
        surveyUrl: process.env.REACT_APP_SURVEY_URL
      }
    }
  };

  const renderCurrentPage = () => {
    const pageConfig = pageSequence[currentPage];
    if (!pageConfig) return null;

    const Component = pageConfig.component;
    return (
      <div className="max-w-2xl mx-auto p-4">
        {isLoading && <LoadingOverlay />}
        <Component {...(pageConfig.props || {})} />
        <ErrorDisplay message={error} />
      </div>
    );
  };

  return renderCurrentPage();
};

export default TextToImageApp;