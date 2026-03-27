import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';

const ONBOARDING_STEP_KEY = 'forsion_onboarding_step';

interface OnboardingFlowProps {
  onComplete: () => void;
  themePreset: string;
}

interface StepConfig {
  title: string;
  description: string;
  targetSelector: string;
  prompts?: string[];
}

const STEPS: StepConfig[] = [
  {
    title: 'Choose Your AI Model',
    description: "Pick an AI model to start chatting. Not sure? The default works great!",
    targetSelector: '[data-onboarding="model-selector"]',
  },
  {
    title: 'Send Your First Message',
    description: 'Type a message or try one of these quick prompts:',
    targetSelector: '[data-onboarding="chat-input"]',
    prompts: [
      'Help me write a professional email',
      'Summarize this article for me',
      "What's on my schedule today?",
    ],
  },
  {
    title: 'Explore Skills Market',
    description: 'Give your AI superpowers! Install Skills to search the web, run code, and more.',
    targetSelector: '[data-onboarding="settings-btn"]',
  },
];

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete, themePreset }) => {
  const savedStep = parseInt(localStorage.getItem(ONBOARDING_STEP_KEY) || '0', 10);
  const [currentStep, setCurrentStep] = useState(Math.min(savedStep, STEPS.length - 1));
  const isMonet = themePreset === 'monet';

  useEffect(() => {
    localStorage.setItem(ONBOARDING_STEP_KEY, String(currentStep));
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleComplete = () => {
    localStorage.removeItem(ONBOARDING_STEP_KEY);
    onComplete();
  };

  const step = STEPS[currentStep];

  return (
    <div className="fixed inset-0 z-[55] pointer-events-none">
      <div className="absolute inset-0 bg-black/30 pointer-events-auto" onClick={handleComplete} />

      <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-md pointer-events-auto rounded-2xl shadow-2xl p-5 ${
        isMonet ? 'glass-dark' : 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700'
      }`}>
        <button
          onClick={handleComplete}
          className={`absolute top-3 right-3 p-1 rounded-lg transition-colors ${
            isMonet ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-white'
          }`}
        >
          <X size={16} />
        </button>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === currentStep
                  ? `flex-1 ${isMonet ? 'bg-white' : 'bg-forsion-500'}`
                  : i < currentStep
                    ? `w-6 ${isMonet ? 'bg-white/40' : 'bg-forsion-200 dark:bg-forsion-800'}`
                    : `w-6 ${isMonet ? 'bg-white/15' : 'bg-gray-200 dark:bg-zinc-700'}`
              }`}
            />
          ))}
        </div>

        <div className="flex items-start gap-3 mb-4">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            isMonet ? 'bg-white/20' : 'bg-forsion-50 dark:bg-forsion-900/20'
          }`}>
            <Sparkles size={16} className={isMonet ? 'text-white' : 'text-forsion-600 dark:text-forsion-400'} />
          </div>
          <div>
            <h3 className={`font-semibold text-sm mb-1 ${isMonet ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
              Step {currentStep + 1}: {step.title}
            </h3>
            <p className={`text-xs leading-relaxed ${isMonet ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}`}>
              {step.description}
            </p>
          </div>
        </div>

        {step.prompts && (
          <div className="space-y-2 mb-4">
            {step.prompts.map((prompt, i) => (
              <div
                key={i}
                className={`text-xs px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  isMonet
                    ? 'bg-white/10 text-white/70 hover:bg-white/20'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-zinc-800 dark:text-gray-400 dark:hover:bg-zinc-700'
                }`}
              >
                {prompt}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  isMonet ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-white'
                }`}
              >
                <ChevronLeft size={14} />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleComplete}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                isMonet ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className={`flex items-center gap-1 text-xs font-medium px-4 py-2 rounded-lg transition-colors ${
                isMonet
                  ? 'bg-white/25 text-white hover:bg-white/35'
                  : 'bg-forsion-600 text-white hover:bg-forsion-500'
              }`}
            >
              {currentStep === STEPS.length - 1 ? 'Done' : 'Next'}
              {currentStep < STEPS.length - 1 && <ChevronRight size={14} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingFlow;
