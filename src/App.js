import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import UserRestrictions from './UserRestrictions';

// Configurable Constants
const TRIAL_TIME = 12; // 2 minutes in seconds
const PRACTICE_TIME = 10; // 30 seconds for practice
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

const CONDITIONS = { // each has a long form instruction (before trial) and short form instruction (during)
  BE_CREATIVE: {
    id: 'BE_CREATIVE',
    instructions: (
    <>
      Instructions for upcoming trial - read carefully!{'\n\n'}
      The goal is to come up with CREATIVE prompts, which are prompts that elicit clever, 
      unusual, interesting, uncommon, humorous, innovative, or different images from the AI.{'\n\n'}
      Your prompt ideas should be new to you, meaning you have never seen, heard, or thought 
      of them before.{'\n\n'}
      <span className="underline">You'll have 2 minutes to enter prompts. It's more important 
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
        <span className="underline">You'll have 2 minutes to enter as many prompts as you can.</span>
      </>
    ),
    trialInstruction: (
      <>
        Please produce {'\n\n'}MANY prompts{'\n\n'}for the following theme:
      </>
    )
  }
};

const RATING_LABELS = { // for later ratings of images
  creativity: [
    'Not creative at all',
    '',
    '',
    '',
    'Very creative'
  ],
  intention: [
    'Not matching at all',
    '',
    '',
    '',
    'Fully matching'
  ]
};

const shuffleArray = (array) => { // randomize
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};


const Card = ({ children }) => (
  <div className="bg-white shadow-lg rounded-lg p-6 relative mb-16">
    {children}
  </div>
);

const usePageTracking = (currentPage, prolificId) => {
  const startTimeRef = useRef(Date.now());
  const previousPageRef = useRef(currentPage);

  useEffect(() => {
    if (currentPage === previousPageRef.current) return;
    if (previousPageRef.current && prolificId) {
      const duration = Date.now() - startTimeRef.current;
      
      fetch(`${process.env.REACT_APP_API_URL}/api/save-timing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prolificId,
          page: previousPageRef.current,
          duration,
          timestamp: new Date().toISOString()
        })
      }).catch(error => console.error('Error saving page timing:', error));
    }

    // Reset start time and update previous page
    startTimeRef.current = Date.now();
    previousPageRef.current = currentPage;
  }, [currentPage, prolificId]);
};

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
  const endTimeRef = useRef(Date.now() + seconds * 1000);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    const timerInterval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.ceil((endTimeRef.current - now) / 1000);
      
      if (remaining <= WARNING_TIME && !isWarning) {
        setIsWarning(true);
      }

      if (remaining <= 0) {
        clearInterval(timerInterval);
        setTimeLeft(0);
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          onComplete();
        }
      } else {
        setTimeLeft(remaining);
      }
    }, 100); // Update more frequently for smoother countdown

    return () => clearInterval(timerInterval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

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
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">AI Experience</h2>
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

const ConsentForm = ({ onAccept }) => {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = () => {
    if (!agreed) {
      setError('Please agree to the consent form before continuing');
      return;
    }
    onAccept();
  };

  return (
    <Card>
    <h2 className="text-2xl font-semibold text-blue-600 mb-6">Research Consent Form</h2>
    <div className="space-y-6 p-4 border rounded-lg">
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
          Your main task will be to create text prompts for an AI tool which will transform them 
          into images. This involves typing your image ideas and selecting the best ones. You will 
          additionally complete a set of intelligence measures, creativity tasks, and personality 
          questionnaires. It is necessary to complete this study in a quiet environment, using a 
          PC/Laptop or a Tablet.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Duration and Compensation</h3>
        <p className="text-gray-700">
          The study will take approximately 45 minutes to complete. You will be paid for your participation through Prolific.
        </p>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">Risks and Benefits</h3>
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

      <section>
        <h3 className="text-xl font-semibold mb-2">Contact Information</h3>
        <p className="text-gray-700">
          For questions about the study, please contact Dr. Roger Beaty at (814) 863-8524 or rebeaty@psu.edu. 
          For questions about your rights as a research participant, contact the Office for Research Protections at (814) 865-1775 or ORProtections@psu.edu.
        
        </p>
      </section>
    </div>

    <div className="mt-6 space-y-4">
        <div className="flex items-center space-x-2">
          <input 
            type="checkbox" 
            id="consent" 
            className="h-4 w-4" 
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <label htmlFor="consent" className="text-gray-700">
            I have read and understand the above information and agree to participate in this study
          </label>
        </div>
        
        {error && <ErrorDisplay message={error} />}
        
        <Button onClick={handleSubmit} disabled={!agreed}>
          Continue
        </Button>
      </div>
    </Card>
  );
};

const InternetUsageAgreement = ({ onContinue }) => {
  const [agreed, setAgreed] = useState(false);
  
  return (
    <Card>
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">Internet Use Agreement</h2>
      <div className="space-y-6">
        <div className="bg-amber-50 p-4 rounded-lg">
          <p className="font-medium text-gray-800">Please note:</p>
          <p className="text-gray-700 mt-2">
            Do not use the Internet (e.g., web search) or any other assistance (e.g., AI tools like ChatGPT) 
            while completing the tasks and questionnaires. We want to understand your natural creative 
            thinking process.
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
    <h2 className="text-2xl font-semibold text-blue-600 mb-6">Task Overview - Read Carefully</h2>
    <div className="space-y-6">
      <p className="text-gray-700">
        In the coming task, you'll work with an AI system to bring image ideas to life. You will produce 
        sets of written commands (called "prompts") that will be interpreted by an AI image generation tool.
      </p>

      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <h3 className="font-semibold text-gray-800">Task Structure:</h3>
        <div className="space-y-2 text-gray-700">
          <p>The study consists of seven trials structured as follows:</p>
          <p>• One practice trial (30s) to familiarize you with the task</p>
          <p>• Six main trials with <span className="underline">different themes</span> and <span className="underline">different instructions</span></p>
          <p>• For each main trial, you will have 2 minutes to write prompts</p>
          <p>• When the timer is up, you will select your best prompt</p>
          <p>• The AI will generate images based on your chosen prompts</p>
          <p>• After the last trial, you will evaluate the generated images</p>
        </div>
      </div>

      <div className="bg-amber-50 p-4 rounded-lg space-y-2">
        <p className="font-medium text-amber-800">Important Tips:</p>
        <ul className="list-disc pl-5 space-y-1 text-amber-800">
          <li>Use specific and clear language so the AI understands your idea</li>
          <li>Vague prompts (e.g., single words) may be misinterpreted by the AI</li>
          <li>Do not use explicit language or otherwise inappropriate content</li>
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
        Let's begin with a practice round to help you understand the task format.
      </p>

      <div className="bg-gray-50 p-4 rounded-lg space-y-4">
        <p className="text-gray-800">In this practice round, you will:</p>
        <div className="space-y-2 text-gray-700">
          <p>• Have 30 seconds to write prompts for a given theme</p>
          <p>• Select your best prompt after the time is up</p>
          <p>This helps you prepare for the main trials.</p>
        </div>
      </div>

      <p className="text-gray-700">
        Click continue when you're ready to start the practice round.
      </p>

      <Button onClick={onContinue}>Begin Practice</Button>
    </div>
  </Card>
);

const PromptInput = ({ onSubmit, theme, condition, isPractice, currentTrialIndex }) => {
  const [prompts, setPrompts] = useState(['']);
  const [showTheme, setShowTheme] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [error, setError] = useState(null);
  const [firstKeypressTime, setFirstKeypressTime] = useState(null);
  const [firstKeypressRecorded, setFirstKeypressRecorded] = useState(false);
  const responseStartRef = useRef(new Date());
  const selectionStartTimeRef = useRef(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const promptsRef = useRef(['']); 
  const currentTime = isPractice ? PRACTICE_TIME : TRIAL_TIME;

  useEffect(() => {
    promptsRef.current = prompts;
  }, [prompts]);

  useEffect(() => {
    const themeTimer = setTimeout(() => setShowTheme(true), 800);
    return () => {
      clearTimeout(themeTimer);
    };
  }, []);

  const handleTimerComplete = useCallback(() => {
    setIsTimeUp(true);
    const filteredPrompts = promptsRef.current.filter(prompt => prompt.trim());

    if (filteredPrompts.length === 0) {
      setError(
        "You did not provide any prompt. Please ensure to write down your prompt ideas in time. It is critical that you actively participate in the survey."
      );
      setPrompts([]);
    } else {
      setPrompts(filteredPrompts);
      setSelectedPrompt(null);
      selectionStartTimeRef.current = new Date();
    }
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

  const handlePromptSelection = useCallback((prompt) => {
    if (!isTimeUp) return;
    setSelectedPrompt(prompt);
    setError(null);
  }, [isTimeUp]);

  const handleSubmit = useCallback(() => {
    if (hasSubmitted) return;
  
    const validPrompts = promptsRef.current.filter(prompt => prompt.trim());
    
    const now = new Date();
    const timingData = {
      firstKeypressLatency: firstKeypressTime ? 
        (firstKeypressTime - responseStartRef.current) / 1000 : null,
      totalResponseTime: isTimeUp ? 
        (now - responseStartRef.current) / 1000 : null,
      selectionPhaseStart: selectionStartTimeRef.current?.toISOString() || null,
      selectionPhaseDuration: selectionStartTimeRef.current ? 
        (now - selectionStartTimeRef.current) / 1000 : null
    };
  
    if (!selectedPrompt && validPrompts.length > 0) {
      setError("Please select one of your prompts before continuing.");
      return;
    }
  
    setHasSubmitted(true);
    onSubmit(validPrompts, selectedPrompt, timingData);
  }, [firstKeypressTime, onSubmit, selectedPrompt, hasSubmitted, isTimeUp]);

  return (
    <div className="relative">
      {!isTimeUp && <Timer seconds={currentTime} onComplete={handleTimerComplete} />}
      
      <Card>
        {error && <ErrorDisplay message={error} />}
        <div className={`transition-all duration-500 ${showTheme ? 'opacity-100' : 'opacity-0'}`}>
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="font-semibold text-gray-800 whitespace-pre-line text-center">
              {isPractice ? 
                "Please write \nprompts for the following theme:" :
                condition === 'BE_CREATIVE' ?
                "Please write \nCREATIVE prompts\nfor the following theme:" :
                "Please write \nMANY prompts\nfor the following theme:"
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
                  className="w-full p-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="Type your prompt here..."
                  value={prompt}
                  onChange={(e) => handlePromptChange(index, e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isTimeUp}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {prompts.length > 0 ? (
                <>
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
                </>
              ) : null}
              <Button onClick={handleSubmit}>
                Continue
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

const MainTrialTransition = ({ onContinue, condition }) => (
  <Card>
    <h2 className="text-2xl font-semibold text-blue-600 mb-6">Main task</h2>
    <div className="space-y-6">
      <p className="text-gray-700">
        You've completed the practice round. Now we'll begin with the first trial of the main task.
      </p>

      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="text-blue-800 whitespace-pre-line">
          {CONDITIONS[condition]?.instructions || "Please prepare for the next trial."}
        </p>
      </div>

      <Button onClick={onContinue}>Begin main task</Button>
    </div>
  </Card>
);


const MainApp = () => {
  const [currentPage, setCurrentPage] = useState('prolificId');
  const [prolificId, setProlificId] = useState('');
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [generatedImages, setGeneratedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const getPageName = (currentPage, currentTrialIndex) => {
    if (currentPage === 'promptInput') {
      return `Trial ${currentTrialIndex} Input Phase`;
    }
    if (currentPage.startsWith('promptSelection_trial_')) {
      return `Trial ${currentTrialIndex} Selection Phase`;
    }
    return currentPage;
  };

  const currentPageName = useMemo(() => {
    return getPageName(currentPage, currentTrialIndex);
  }, [currentPage, currentTrialIndex]);

  usePageTracking(currentPageName, prolificId);
  
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

  const handlePromptSubmission = async (submittedPrompts, selectedPrompt, timingData) => {
    try {
      setIsLoading(true);
      setError(null);
  
      // If no prompts were provided
      if (submittedPrompts.length === 0) {
        handleNextTrial();
        return;
      }
  
      // If no prompt was selected but there are prompts
      if (!selectedPrompt && submittedPrompts.length > 0) {
        return;
      }
  
      const currentTrial = getCurrentTrial();
      const submission = {
        prolificId,
        trialIndex: currentTrialIndex,
        condition: currentTrial.condition,
        theme: currentTrial.theme,
        prompts: submittedPrompts,
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

  const pollGenerationStatus = useCallback(async () => {
    try {
        let attempts = 0;
        const maxAttempts = 4;
        const pollInterval = 5000; // 5 seconds between attempts
        
        const poll = async () => {
            if (attempts >= maxAttempts) {
                console.log('Polling timed out after', attempts, 'attempts');
                setCurrentPage('noImages');
                return;
            }

            attempts++;
            console.log('Polling attempt', attempts);
            
            const response = await fetch(
                `${process.env.REACT_APP_API_URL}/api/check-generation-status/${prolificId}`
            );
            const data = await response.json();
            console.log('Status response:', data);
            
            switch (data.status) {
                case 'ready':
                    try {
                        const imagesResponse = await fetch(
                            `${process.env.REACT_APP_API_URL}/api/get-all-images/${prolificId}`
                        );
                        
                        if (!imagesResponse.ok) {
                            throw new Error('Failed to fetch images');
                        }
                        
                        const imageData = await imagesResponse.json();
                        if (imageData.images && imageData.images.length > 0) {
                            console.log('Found images:', imageData.images.length);
                            setGeneratedImages(imageData.images);
                            setCurrentPage('imageRating');
                            setIsLoading(false);
                        } else {
                            console.log('No images in response');
                            setCurrentPage('noImages');
                        }
                    } catch (error) {
                        console.error('Error fetching images:', error);
                        setCurrentPage('noImages');
                    }
                    break;

                case 'no_trials':
                case 'all_failed':
                    console.log('No valid trials found:', data.status);
                    setCurrentPage('noImages');
                    break;

                case 'pending':
                    console.log('Still pending, completed trials:', data.completedTrials);
                    setTimeout(poll, pollInterval);
                    break;

                default:
                    console.error('Unknown status:', data.status);
                    setCurrentPage('noImages');
            }
        };

        await poll();
    } catch (error) {
        console.error('Error in polling:', error);
        setError('Failed to load images');
        setIsLoading(false);
        setCurrentPage('noImages');
    }
}, [prolificId, setCurrentPage, setError, setGeneratedImages, setIsLoading]);

const ProcessingPage = () => (
  <Card>
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">Processing Images</h2>
      <div className="space-y-6">
          <p className="text-gray-700">
              Please wait while we process your images. This may take ~30s.
          </p>
          <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
      </div>
  </Card>
);

  const handleNextTrial = useCallback(() => {
    const nextTrialIndex = currentTrialIndex + 1;
    
    if (currentTrialIndex === 0) {
        setCurrentTrialIndex(nextTrialIndex);
        setCurrentPage('mainTrialTransition');
    } else if (nextTrialIndex >= 7) {
        setIsLoading(true);
        setCurrentPage('processing'); // Add a processing page
        pollGenerationStatus();
    } else {
        setCurrentTrialIndex(nextTrialIndex);
        setCurrentPage('betweenTrials');
    }
}, [currentTrialIndex, pollGenerationStatus]);

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

const NoImagesPage = () => (
  <Card>
    <h2 className="text-2xl font-semibold text-red-600 mb-6">No Images Available</h2>
    <div className="space-y-6">
      <p className="text-gray-700">
        Unfortunately, no images could be created. This is either because:
        1) no prompts were provided, or
        2) prompts that were provided could not be generated by the AI (e.g., because of content policy violations or internal server errors).
      </p>
      <p className="text-gray-700 font-medium">
        The survey must terminate at this point. You may close this window now.
      </p>
    </div>
  </Card>
);

const handleRatingSubmission = useCallback(async (ratings, images) => {
  try {
    setIsLoading(true);
    setError(null);

    const formattedRatings = images.map((image, index) => ({
      prolificId,
      trialIndex: image.trialIndex,
      creativityRating: ratings[index].creativity,
      intentionRating: ratings[index].intention,
      theme: image.theme,
      condition: image.condition,
      prompt: image.prompt,
      timestamp: new Date().toISOString()
    }));

    const ratingsResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/save-ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formattedRatings)
    });

    if (!ratingsResponse.ok) {
      const error = await ratingsResponse.json();
      throw new Error(error.detail || 'Failed to save ratings');
    }

    // Mark completion
    const completionResponse = await fetch(
      `${process.env.REACT_APP_API_URL}/api/mark-completion?prolific_id=${prolificId}&timestamp=${new Date().toISOString()}`,
      { method: 'POST' }
    );

    if (!completionResponse.ok) {
      throw new Error('Failed to mark completion');
    }

    setCurrentPage('thankYou');
  } catch (err) {
    setError(err.message);
    console.error('Submission error:', err);
  } finally {
    setIsLoading(false);
  }
}, [prolificId, setCurrentPage, setError, setIsLoading]);

const ImageRatingInterface = ({ images, onSubmit }) => {
  const [randomizedImages, setRandomizedImages] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!images || images.length === 0) {
      setError('No images available');
      return;
    }
    const shuffled = [...images].sort(() => Math.random() - 0.5);
    setRandomizedImages(shuffled);
    setRatings(shuffled.map(() => ({ creativity: null, intention: null })));
  }, [images]);

  const validateImagePath = (path) => {
    return path?.startsWith('data') || path?.startsWith('http') || path?.startsWith('/');
  };

  const handleSubmit = () => {
    const missingRatings = ratings.some(r => 
      r.creativity === null || r.intention === null
    );

    if (missingRatings) {
      setError('Please provide both ratings for all images before continuing.');
      return;
    }

    onSubmit(ratings, randomizedImages);
  };


  const handleRatingChange = (imageIndex, type, value) => {
    setRatings(prev => {
      const newRatings = [...prev];
      newRatings[imageIndex] = {
        ...newRatings[imageIndex],
        [type]: Number(value)
      };
      return newRatings;
    });
  };

  return (
    <Card>
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">
        Rate All Generated Images
      </h2>
      <h3 className="text-lg text-gray-700 mb-6">
        The themes and prompts are being displayed together with the image.<br />
      </h3>
      <p className="text-gray-700">
              Please provide ratings:<br />- How creative is this image?<br />- How much does this image match your prompt intentions?<br /><br />
          </p>

      <div className="space-y-8">
        
        {randomizedImages.map((image, index) => (
          <div key={index} className="border rounded-lg p-6 space-y-4">
            <p className="text-gray-700 font-medium">Theme: {image.theme}</p>
            {validateImagePath(image.imagePath) ? (
              <img
                src={image.imagePath}
                alt={`Generated for trial ${image.trialIndex}`}
                className="w-full rounded-lg"
                onError={(e) => {
                  console.error('Image failed to load:', image.imagePath);
                  e.target.src = '/api/placeholder/400/320';
                }}
              />
            ) : (
              <div className="bg-gray-200 h-64 flex items-center justify-center rounded-lg">
                <span className="text-gray-500">Image not available</span>
              </div>
            )}
            <div className="space-y-2">
            <p className="text-gray-700 italic">your prompt: "{image.prompt}"</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How creative is this image?
                </label>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={ratings[index]?.creativity ?? 2}
                  onChange={(e) => handleRatingChange(index, 'creativity', Number(e.target.value))}
                  className={`w-[calc(100%-1rem)] mx-2 [accent-color:#3B82F6] [-webkit-appearance:none] h-3 bg-blue-100 rounded-lg ${
                    ratings[index]?.creativity !== null ? 'opacity-100' : 'opacity-50'
                  }`} 
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  {RATING_LABELS.creativity.map((label, i) => (
                    <div key={i} className="flex flex-col items-center text-center w-10">
                    <span className={ratings[index]?.creativity === i ? 'font-bold text-blue-500' : ''}>
                    {i}
                    </span>
                    <span className={`mt-1 whitespace-pre-line ${
                      ratings[index]?.creativity === i ? 'font-bold text-blue-500' : ''
                    }`}>
                    {label}
                  </span>
                </div>
                ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How much does this image match your prompt intentions?
                </label>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={ratings[index]?.intention ?? 2}
                  onChange={(e) => handleRatingChange(index, 'intention', Number(e.target.value))}
                  className={`w-[calc(100%-1rem)] mx-2 [accent-color:#3B82F6] [-webkit-appearance:none] h-3 bg-blue-100 rounded-lg ${
                    ratings[index]?.intention !== null ? 'opacity-100' : 'opacity-50'
                  }`} 
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
  {RATING_LABELS.intention.map((label, i) => (
    <div key={i} className="flex flex-col items-center text-center w-10">
      <span className={ratings[index]?.intention === i ? 'font-bold text-blue-500' : ''}>
        {i}
      </span>
      <span className={`mt-1 whitespace-pre-line ${
        ratings[index]?.intention === i ? 'font-bold text-blue-500' : ''
      }`}>
        {label}
      </span>
    </div>
  ))}
</div>
              </div>
            </div>
          </div>
        ))}
         {error && <ErrorDisplay message={error} />}
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

const pageComponents = {
  prolificId: ProlificIdEntry,
  consent: ConsentForm,
  aiExperienceSurvey: AiExperienceSurvey,
  internetUsage: InternetUsageAgreement,
  generalInstructions: GeneralInstructions,
  practiceInstructions: PracticeInstructions,
  promptInput: PromptInput,
  betweenTrials: BetweenTrialInstructions,
  mainTrialTransition: MainTrialTransition,
  processing: ProcessingPage,
  noImages: NoImagesPage,
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
          setCurrentPage('consent');
        }
      };
    case 'consent':
      return {
        ...baseProps,
        onAccept: () => setCurrentPage('internetUsage')
      };
    case 'internetUsage':
      return {
        ...baseProps,
        onContinue: () => setCurrentPage('aiExperienceSurvey')
      };
    case 'aiExperienceSurvey':
      return {
        ...baseProps,
        onSubmit: () => setCurrentPage('generalInstructions')
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
        onSubmit: handlePromptSubmission,
        currentTrialIndex
      };
    case 'betweenTrials':
      return {
        ...baseProps,
        condition: conditions.sequence[currentTrialIndex - 1],
        trialNumber: currentTrialIndex,
        theme: currentTrial.theme,
        onContinue: () => setCurrentPage('promptInput')
      };
    case 'mainTrialTransition':
      return {
        ...baseProps,
        condition: conditions.sequence[0].id,
        trialNumber: 1,
        theme: trialThemes[1],
        onContinue: () => setCurrentPage('promptInput')
      };
    case 'imageRating':
      return {
        ...baseProps,
        images: generatedImages,
        onSubmit: (ratings, images) => handleRatingSubmission(ratings, images)
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
      <UserRestrictions />
      <div className="max-w-2xl mx-auto px-4">
        {isLoading && <LoadingOverlay />}
        {PageComponent && <PageComponent {...getPageProps()} />}
      </div>
    </div>
  );
};

const ThankYou = () => {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Card>
      <h2 className="text-2xl font-semibold text-blue-600 mb-6">Thank You!</h2>
      <div className="space-y-6">
        <p className="text-gray-700">
          You have completed the image generation portion of the study. You will now be redirected 
          to part B of the survey.
        </p>
        <div className="text-center animate-pulse">
          <p className="text-gray-600">Redirecting in 5 seconds...</p>
        </div>
      </div>
    </Card>
  );
};

export default MainApp;