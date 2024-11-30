import React, { useState, useEffect, useCallback, useRef } from 'react';

// Configurable Constants
const TRIAL_TIME = 35; // 3 minutes in seconds
const WARNING_TIME = 30; // 30 seconds warning threshold

const PRACTICE_THEME = "SPACE";
const TRIAL_THEMES = [
  "TIME",
  "MYSTERY",
  "COMFORT",
  "MEMORY",
  "CURIOSITY",
  "FUTURE"
];

const CONDITIONS = {
  BE_CREATIVE: {
    id: 'BE_CREATIVE',
    instructions: (
    <>
      Instructions for upcoming trial - read carefully!{'\n\n'}
      The goal is to come up with CREATIVE prompts, which are prompts that elicit clever, 
      unusual, interesting, uncommon, humorous, innovative, or different images from the AI.{'\n\n'}
      Your prompt ideas should be new to you, meaning you have never seen, heard, or thought 
      of them before.{'\n\n'}
      <span className="underline">You'll have 3 minutes to enter prompts. It's more important 
      to come up with creative prompts than many prompts.</span>
    </>
    ),
    trialInstruction: (
      <>
        Please produce {'\n\n'}CREATIVE prompts{'\n\n'}for the following theme:
      </>
    )
  },
  BE_FLUENT: {
    id: 'BE_FLUENT',
    instructions: (
      <>
        Instructions for upcoming trial:{'\n\n'}
        The goal is to come up with as MANY prompts as possible.{'\n\n'}
        <span className="underline">You'll have 3 minutes to enter as many prompts as you can.</span>
      </>
    ),
    trialInstruction: (
      <>
        Please produce {'\n\n'}MANY prompts{'\n\n'}for the following theme:
      </>
    )
  }
};

const RATING_LABELS = {
  creativity: [
    'Not creative at all',
    'Slightly creative',
    'Moderately creative',
    'Very creative',
    'Extremely creative'
  ],
  intention: [
    'Not at all',
    'Slightly',
    'Moderately',
    'Very much',
    'Completely'
  ]
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

const Button = ({ children, onClick, disabled, className = '', type = 'button' }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleClick = async (e) => {
    if (onClick && !isProcessing) {
      setIsProcessing(true);
      try {
        await onClick(e);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <button
      type={type}
      onClick={handleClick}
      disabled={disabled || isProcessing}
      className={`w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium
        hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors ${isProcessing ? 'opacity-50' : ''} ${className}`}
    >
      {isProcessing ? (
        <span className="flex items-center justify-center">
          <span className="mr-2">Processing...</span>
          <span className="animate-spin">⚪</span>
        </span>
      ) : children}
    </button>
  );
};

const LoadingOverlay = () => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-8 rounded-lg shadow-xl">
      <div className="flex flex-col items-center space-y-4">
        <div className="flex space-x-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-4 h-4 bg-blue-500 rounded-full animate-bounce"
              style={{
                animationDelay: `${i * 0.15}s`,
                animationDuration: '0.8s'
              }}
            />
          ))}
        </div>
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
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    if (timeLeft <= 0 || hasCompletedRef.current) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= WARNING_TIME) {
          setIsWarning(true);
        }

        if (prev <= 1) {
          clearInterval(intervalRef.current);
          if (!hasCompletedRef.current) {
            hasCompletedRef.current = true;
            onComplete();
          }
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timeLeft, onComplete]);

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
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">Welcome to part A</h2>
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
    if (!responses.genAiExperience || !responses.textToImageExperience) {
      setError('Please complete all required fields');
      return;
    }

    onSubmit(responses);
  };

  return (
    <Card>
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">AI Experience Survey</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-gray-700 mb-2">
            How would you rate your experience with generative AI tools (e.g., ChatGPT)?
          </label>
          <select
            className="w-full p-3 border rounded-lg"
            value={responses.genAiExperience}
            onChange={(e) => setResponses(prev => ({...prev, genAiExperience: e.target.value}))}
          >
            <option value="">Select an option</option>
            <option value="none">No experience</option>
            <option value="basic">Basic</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
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
          >
            <option value="">Select an option</option>
            <option value="never">Never</option>
            <option value="rarely">Rarely</option>
            <option value="sometimes">Sometimes</option>
            <option value="often">Often</option>
            <option value="very_often">Very often</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-gray-700">
            Which text-to-image tools have you used? (Select all that apply)
          </label>
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
              <span>{label}</span>
            </label>
          ))}
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
            />
          </div>
        )}

        {error && <ErrorDisplay message={error} />}
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
          This research investigates how people collaborate with generative artificial intelligence 
          to pursue creative goals. You have been selected to participate as a healthy adult.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Study Procedures</h3>
        <p className="text-gray-700">
          Your primary task involves creating text prompts that an AI tool will transform into 
          images. You will write prompts and select the most suitable ones. Additionally, you 
          will complete creativity tasks and provide ratings. This study requires a quiet 
          environment and a PC/Laptop or Tablet.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Duration and Compensation</h3>
        <p className="text-gray-700">
          The study will take approximately 45 minutes to complete. You will receive 
          compensation for your participation through Prolific.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Risks and Benefits</h3>
        <p className="text-gray-700">
          Data confidentiality will be maintained to the extent permitted by the technology 
          used. While absolute confidentiality cannot be guaranteed, this research will 
          enhance our understanding of human creativity and human-AI interaction.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Voluntary Participation</h3>
        <p className="text-gray-700">
          Your participation is entirely voluntary. You may choose not to participate or 
          withdraw at any time without penalty.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Contact Information</h3>
        <p className="text-gray-700">
          For questions about this study, please contact Dr. Roger Beaty at (814) 863-8524 
          or rebeaty@psu.edu. For questions about your rights as a research participant, 
          contact the Office for Research Protections at (814) 865-1775 or ORProtections@psu.edu.
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
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">Internet Use Agreement</h2>
      <div className="space-y-6">
        <div className="bg-amber-50 p-4 rounded-lg">
          <p className="font-medium text-gray-800">Important Notice:</p>
          <p className="text-gray-700 mt-2">
            To ensure the integrity of our research, please do not use the Internet (including 
            web searches) or any AI tools (such as ChatGPT) during this study. We aim to 
            understand your natural creative thinking process.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-gray-700">To maintain study integrity:</p>
          <ul className="list-disc pl-5 space-y-2 text-gray-700">
            <li>Copy and paste functionality has been disabled</li>
            <li>Right-click menu access has been restricted</li>
            <li>Please keep all other browser windows and tabs closed</li>
          </ul>
        </div>

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

        <Button onClick={onContinue} disabled={!agreed}>
          Continue
        </Button>
      </div>
    </Card>
  );
};

const GeneralInstructions = ({ onContinue }) => (
  <Card>
    <h2 className="text-2xl font-semibold text-blue-600 mb-6">Task Overview - Please Read Carefully</h2>
    <div className="space-y-6">
      <p className="text-gray-700">
        In this study, you will collaborate with an AI system to create images from text 
        descriptions. You will write text commands (called "prompts") that the AI will use 
        to generate images.
      </p>

      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <h3 className="font-semibold text-gray-800">Study Structure:</h3>
        <div className="space-y-2 text-gray-700">
          <p>The study consists of seven trials structured as follows:</p>
          <p>• One practice trial to familiarize you with the task</p>
          <p>• Six main trials with different themes and instructions</p>
          <p>• For each trial, you will have 3 minutes to write prompts</p>
          <p>• After writing, you will select your best prompt</p>
          <p>• The AI will generate images based on your chosen prompts</p>
          <p>• At the end, you will rate all generated images</p>
        </div>
      </div>

      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-blue-800">
          Each prompt should describe a unique image idea that reflects the given theme. 
          Be specific and clear in your descriptions.
        </p>
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
        Let's begin with a practice round to help you understand the task format.
      </p>

      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <p className="text-gray-800">In this practice round, you will:</p>
        <div className="space-y-2 text-gray-700">
          <p>• Have 3 minutes to write prompts based on a theme</p>
          <p>• Select your best prompt after the time is up</p>
          <p>• Your selected prompt will generate an AI image</p>
          <p>• This helps you prepare for the main trials</p>
        </div>
      </div>

      <p className="text-gray-700">
        Click continue when you're ready to start the practice round.
      </p>

      <Button onClick={onContinue}>Begin Practice</Button>
    </div>
  </Card>
);

const MainTrialTransition = ({ onContinue, condition }) => (
  <Card>
    <h2 className="text-2xl font-semibold text-blue-600 mb-6">Main task</h2>
    <div className="space-y-6">
      <p className="text-gray-700">
        You've completed the practice round. Now we'll begin with the first trial of the main task.
      </p>

      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-blue-800 whitespace-pre-line">
          {CONDITIONS[condition].instructions}
        </p>
      </div>

      <Button onClick={onContinue}>Begin main task</Button>
    </div>
  </Card>
);

const PromptInput = ({ onSubmit, theme, condition, isPractice }) => {
  const [prompts, setPrompts] = useState(['']);
  const [showTheme, setShowTheme] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const responseStartRef = useRef(new Date());
  const [firstKeypressTime, setFirstKeypressTime] = useState(null);
  const [firstKeypressRecorded, setFirstKeypressRecorded] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const themeTimer = setTimeout(() => setShowTheme(true), 800);
    return () => clearTimeout(themeTimer);
  }, []);

  const handleKeyPress = useCallback(() => {
    if (!firstKeypressRecorded) {
      setFirstKeypressTime(new Date());
      setFirstKeypressRecorded(true);
    }
  }, [firstKeypressRecorded]);

  const handlePromptChange = useCallback((index, value) => {
    if (isTimeUp) return;
    setPrompts(prev => {
      const newPrompts = [...prev];
      newPrompts[index] = value;
      if (index === prev.length - 1 && value.trim()) {
        newPrompts.push('');
      }
      return newPrompts;
    });
  }, [isTimeUp]);

  const handleTimerComplete = useCallback(() => {
    setIsTimeUp(true);
    const filteredPrompts = prompts.filter(prompt => prompt.trim());

    if (filteredPrompts.length === 0) {
      setError('Please write at least one prompt before proceeding.');
      return;
    }

    setPrompts(filteredPrompts);
  }, [prompts]);

  const handlePromptSelection = useCallback((prompt) => {
    if (!isTimeUp) return;
    setSelectedPrompt(prompt);
  }, [isTimeUp]);

  const handleSubmit = useCallback(() => {
    if (!selectedPrompt) {
      setError('Please select one prompt to proceed.');
      return;
    }

    const timingData = {
      firstKeypressLatency: firstKeypressTime ? 
        (firstKeypressTime - responseStartRef.current) / 1000 : null,
      totalResponseTime: TRIAL_TIME
    };

    onSubmit(prompts, selectedPrompt, timingData);
  }, [firstKeypressTime, onSubmit, prompts, selectedPrompt]);

  return (
    <div className="relative">
      <Timer seconds={TRIAL_TIME} onComplete={handleTimerComplete} />
      
      <Card>
        {error && <ErrorDisplay message={error} />}

        <div className={`transition-all duration-500 ${showTheme ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-gray-800 whitespace-pre-line text-center">
              {isPractice ? 
                "Please write prompts for the following theme:" :
                condition === 'BE_CREATIVE' ?
                "Please write CREATIVE prompts for the following theme:" :
                "Please write MANY prompts for the following theme:"
              }
            </h3>
            <p className="text-gray-700 mt-2 text-center font-bold">
              {theme}
            </p>
          </div>

          {!isTimeUp ? (
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
                  onKeyDown={handleKeyPress}
                  onPaste={(e) => e.preventDefault()}
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-700 font-medium">Select your best prompt:</p>
              {prompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handlePromptSelection(prompt)}
                  className={`w-full p-4 text-left rounded-lg transition-colors
                    ${selectedPrompt === prompt ?
                      'bg-blue-100 border-2 border-blue-500' :
                      'bg-gray-50 border-2 border-transparent hover:border-blue-200'
                    }`}
                >
                  {prompt}
                </button>
              ))}
              <Button
                onClick={handleSubmit}
                disabled={!selectedPrompt}
              >
                Continue with Selected Prompt
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

const ImageRatingInterface = ({ images, onSubmit }) => {
  const [ratings, setRatings] = useState(
    images.map(() => ({ creativity: 2, intention: 2 }))
  );
  const [error, setError] = useState(null);

  const handleRatingChange = (imageIndex, type, value) => {
    setRatings(prev => {
      const newRatings = [...prev];
      newRatings[imageIndex] = {
        ...newRatings[imageIndex],
        [type]: value
      };
      return newRatings;
    });
  };

  const handleSubmit = () => {
    const allRated = ratings.every(r => 
      r.creativity !== undefined && r.intention !== undefined
    );

    if (!allRated) {
      setError('Please rate all images before continuing.');
      return;
    }

    onSubmit(ratings);
  };

  return (
    <Card>
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">
        Rate All Generated Images
      </h2>

      {error && <ErrorDisplay message={error} />}

      <div className="space-y-8">
        {images.map((image, index) => (
          <div key={index} className="border rounded-lg p-6 space-y-4">
            <img
              src={image.path}
              alt={`Generated for trial ${image.trialIndex}`}
              className="w-full rounded-lg"
            />
            <p className="text-gray-700 italic">"{image.prompt}"</p>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How creative is this image?
                </label>
                <input
                  type="range"
                  min="0"
                  max="4"
                  value={ratings[index].creativity}
                  onChange={(e) => handleRatingChange(index, 'creativity', Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  {RATING_LABELS.creativity.map((label, i) => (
                    <span key={i} className={ratings[index].creativity === i ? 'font-bold' : ''}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How much does this image reflect your intentions?
                </label>
                <input
                  type="range"
                  min="0"
                  max="4"
                  value={ratings[index].intention}
                  onChange={(e) => handleRatingChange(index, 'intention', Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  {RATING_LABELS.intention.map((label, i) => (
                    <span key={i} className={ratings[index].intention === i ? 'font-bold' : ''}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={handleSubmit}
        className="mt-8"
      >
        Submit All Ratings
      </Button>
    </Card>
  );
};

const MainApp = () => {
  const [currentPage, setCurrentPage] = useState('prolificId');
  const [prolificId, setProlificId] = useState('');
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize conditions with three trials per condition
  const [conditions] = useState(() => {
    const isCreativeFirst = Math.random() < 0.5;
    const createSequence = (condition) => Array(3).fill(CONDITIONS[condition]);
    
    return {
      order: isCreativeFirst ? 'creative_first' : 'fluent_first',
      sequence: isCreativeFirst
        ? [...createSequence('BE_CREATIVE'), ...createSequence('BE_FLUENT')]
        : [...createSequence('BE_FLUENT'), ...createSequence('BE_CREATIVE')]
    };
  });

  // Randomize themes for all trials
  const [trialThemes] = useState(() => {
    const themes = [...TRIAL_THEMES];
    return [PRACTICE_THEME, ...shuffleArray(themes)];
  });

  const getCurrentTrial = useCallback(() => {
    if (currentTrialIndex === 0) {
      return {
        theme: PRACTICE_THEME,
        condition: 'practice'
      };
    }
    return {
      theme: trialThemes[currentTrialIndex],
      condition: conditions.sequence[currentTrialIndex - 1].id
    };
  }, [currentTrialIndex, conditions.sequence, trialThemes]);

  const handlePromptSubmission = async (prompts, selectedPrompt, timingData) => {
    try {
      setIsLoading(true);
      setError(null);

      const currentTrial = getCurrentTrial();
      const submission = {
        prolificId,
        trialIndex: currentTrialIndex,
        condition: currentTrial.condition,
        theme: currentTrial.theme,
        prompts,
        selectedPrompt,
        isPractice: currentTrialIndex === 0,
        conditionOrder: conditions.order,
        timingData,
        timestamp: new Date().toISOString()
      };

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/save-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission)
      });

      if (!response.ok) throw new Error('Failed to save prompt');

      handleNextTrial();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const checkGenerationStatus = useCallback(async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/check-generation-status/${prolificId}`
      );
      const data = await response.json();
      return data.status === 'ready';
    } catch (err) {
      console.error('Error checking generation status:', err);
      return false;
    }
  }, [prolificId]);

  const pollGenerationStatus = useCallback(async () => {
    const poll = async () => {
      const isReady = await checkGenerationStatus();
      if (isReady) {
        const response = await fetch(
          `${process.env.REACT_APP_API_URL}/api/get-all-images/${prolificId}`
        );
        const data = await response.json();
        setGeneratedImages(data.images);
        setCurrentPage('imageRating');
      } else {
        setTimeout(poll, 5000); // Poll every 5 seconds
      }
    };
    poll();
  }, [checkGenerationStatus, prolificId]);

  const handleNextTrial = useCallback(() => {
    if (isPractice) {
      setIsPractice(false);
      setCurrentTrialIndex(0);
      setCurrentPage('mainTrialTransition');  // Make sure we show transition page first
    } else {
      const nextTrialIndex = currentTrialIndex + 1;
      if (nextTrialIndex >= 6) {
        setCurrentPage('thankYou');
      } else {
        setCurrentTrialIndex(nextTrialIndex);
        setCurrentPage('betweenTrials');
      }
    }

const BetweenTrialInstructions = ({ condition, trialNumber, onContinue }) => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card>
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">
        Trial {trialNumber} Instructions
      </h2>
      <div className={`space-y-6 transition-all duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
        <div className="bg-blue-50 p-4 rounded-lg">
          <p className="text-blue-800 whitespace-pre-line">
            {condition.instructions}
          </p>
        </div>

        <Button onClick={onContinue}>
          Begin Trial {trialNumber}
        </Button>
      </div>
    </Card>
  );
};

  const handleRatingSubmission = async (ratings) => {
    try {
      setIsLoading(true);
      setError(null);

      const formattedRatings = ratings.map((rating, index) => ({
        prolificId,
        trialIndex: generatedImages[index].trialIndex,
        creativityRating: rating.creativity,
        intentionRating: rating.intention,
        theme: generatedImages[index].theme,
        condition: generatedImages[index].condition,
        prompt: generatedImages[index].prompt,
        timestamp: new Date().toISOString()
      }));

      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/save-ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formattedRatings)
      });

      if (!response.ok) throw new Error('Failed to save ratings');

      // Mark study completion
      await fetch(`${process.env.REACT_APP_API_URL}/api/mark-completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prolificId,
          timestamp: new Date().toISOString()
        })
      });

      setCurrentPage('thankYou');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const pageComponents = {
    prolificId: ProlificIdEntry,
    consent: ConsentForm,
    aiExperienceSurvey: AiExperienceSurvey,
    internetUsage: InternetUsageAgreement,
    generalInstructions: GeneralInstructions,
    practiceInstructions: PracticeInstructions,
    promptInput: PromptInput,
    mainTrialTransition: MainTrialTransition,
    imageRating: ImageRatingInterface,
    thankYou: ThankYou
  };

  const getPageProps = () => {
    const baseProps = { error };
    const currentTrial = getCurrentTrial();

    switch (currentPage) {
      case 'prolificId':
          return {
              ...baseProps,
              onSubmit: id => {
                  setProlificId(id);
                  setCurrentPage('aiExperienceSurvey');
              }
          };
      case 'aiExperienceSurvey':
          return {
              ...baseProps,
              onSubmit: () => setCurrentPage('consent')
          };
      case 'consent':
          return {
              ...baseProps,
              onAccept: () => setCurrentPage('internetUsage')
          };
      case 'internetUsage':
          return {
              ...baseProps,
              onContinue: () => setCurrentPage('generalInstructions')
          };
      case 'generalInstructions':
          return {
              ...baseProps,
              onContinue: () => setCurrentPage('practiceInstructions')
          };
      case 'practiceInstructions':
          return {
              ...baseProps,
              onContinue: () => setCurrentPage('promptInput')
          };
      case 'promptInput':
        return {
          ...baseProps,
          theme: currentTrial.theme,
          condition: currentTrial.condition,
          isPractice: currentTrialIndex === 0,
          onSubmit: handlePromptSubmission
        };
      case 'mainTrialTransition':
        return {
          ...baseProps,
          condition: conditions.sequence[0].id,
          onContinue: () => setCurrentPage('promptInput')
        };
      case 'betweenTrials':
        return {
          ...baseProps,
          condition: conditions.sequence[currentTrialIndex - 1].id,
          trialNumber: currentTrialIndex,
          onContinue: () => setCurrentPage('promptInput')
        };
      case 'imageRating':
        return {
          ...baseProps,
          images: generatedImages,
          onSubmit: handleRatingSubmission
        };
      case 'thankYou':
        return baseProps;
      default:
        return baseProps;
    }
  };

  const PageComponent = pageComponents[currentPage];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        {isLoading && <LoadingOverlay />}
        {PageComponent && <PageComponent {...getPageProps()} />}
      </div>
    </div>
  );
};

const ThankYou = () => (
  <Card>
    <h2 className="text-2xl font-semibold text-blue-600 mb-6">Thank You!</h2>
    <div className="space-y-6">
      <p className="text-gray-700">
        You have completed the image generation portion of the study. You will now be redirected 
        to part B of the survey.
      </p>
      <div className="text-center animate-pulse">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  </Card>
);

export default MainApp;