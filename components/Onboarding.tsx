
import React, { useState } from 'react';
import MicrophoneIcon from './icons/MicrophoneIcon';
import TowerIcon from './icons/TowerIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import HistoryIcon from './icons/HistoryIcon';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import PilotIcon from './icons/PilotIcon';

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: <TowerIcon className="w-12 h-12 text-cyan-400" />,
    title: 'Welcome to ATC Co-pilot!',
    description: "This short tutorial will guide you through the main features. Let's get you ready for the virtual skies.",
  },
  {
    icon: <MicrophoneIcon className="w-12 h-12 text-blue-400" />,
    title: 'Start Listening',
    description: 'Press the large microphone button to start a session. The app will begin listening for Air Traffic Control (ATC) instructions through your microphone.',
  },
  {
    icon: <TowerIcon className="w-12 h-12 text-cyan-400" />,
    title: 'Live Transcription',
    description: 'As the app listens, ATC instructions will be transcribed in real-time in the conversation log. The app will automatically detect when the transmission is complete.',
  },
  {
    icon: <CheckCircleIcon className="w-12 h-12 text-green-400" />,
    title: 'AI Read-back & Feedback',
    description: "Once an ATC instruction is transcribed, the AI will automatically generate the correct pilot read-back. It will then analyze the read-back and provide detailed feedback on its accuracy.",
  },
  {
    icon: <HistoryIcon className="w-12 h-12 text-gray-400" />,
    title: 'Review Your Sessions',
    description: 'Every completed session is automatically saved. Use the "Session History" panel to review past interactions, analyze your performance, and track your progress over time.',
  },
  {
    icon: <PilotIcon className="w-12 h-12 text-green-400" />,
    title: "You're Cleared for Takeoff!",
    description: 'You now know the basics. Press "Finish" to close this tutorial and start your first training session. Good luck!',
  },
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-2xl border border-gray-700 text-center p-8 flex flex-col">
        <div className="flex-grow flex flex-col items-center justify-center">
            <div className="mb-6">{step.icon}</div>
            <h2 className="text-2xl font-bold text-white mb-4">{step.title}</h2>
            <p className="text-gray-300 mb-8">{step.description}</p>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="flex items-center space-x-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            <span>Prev</span>
          </button>

          <div className="flex space-x-2">
            {steps.map((_, index) => (
                <div key={index} className={`w-2.5 h-2.5 rounded-full transition-colors ${currentStep === index ? 'bg-cyan-400' : 'bg-gray-600'}`}></div>
            ))}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              className="flex items-center space-x-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              <span>Next</span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onComplete}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 rounded-md transition-colors"
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
