
import React from 'react';
import { AppStatus } from '../types';
import MicrophoneIcon from './icons/MicrophoneIcon';
import StopIcon from './icons/StopIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import MicVisualizer from './MicVisualizer';

interface ControlPanelProps {
  status: AppStatus;
  onToggleListening: () => void;
  micVolume: number;
}

const ControlPanel: React.FC<ControlPanelProps> = ({ status, onToggleListening, micVolume }) => {
  const isListening = status !== AppStatus.IDLE && status !== AppStatus.ERROR;

  const getStatusText = () => {
    switch (status) {
      case AppStatus.LISTENING:
        return 'Listening for ATC...';
      case AppStatus.THINKING:
        return 'Generating Read-back...';
      case AppStatus.CHECKING_ACCURACY:
        return 'Checking Accuracy...';
      case AppStatus.SPEAKING:
        return 'Speaking Read-back...';
      case AppStatus.ERROR:
        return 'An error occurred. Please try again.';
      case AppStatus.IDLE:
      default:
        return 'Press Start to begin';
    }
  };
  
  const isLoading = [AppStatus.THINKING, AppStatus.CHECKING_ACCURACY, AppStatus.SPEAKING].includes(status);

  const buttonIcon = () => {
    if (isListening) return <StopIcon className="w-8 h-8" />;
    return <MicrophoneIcon className="w-8 h-8" />;
  };

  const buttonBgColor = isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700';
  const statusColor = status === AppStatus.ERROR ? 'text-red-400' : 'text-cyan-400';

  return (
    <div className="flex flex-col items-center p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700">
      <div className="flex items-center space-x-3 mb-2">
        {isLoading ? (
          <SpinnerIcon className="w-6 h-6 text-cyan-400" />
        ) : (
          <div className={`w-4 h-4 rounded-full ${status === AppStatus.LISTENING ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
        )}
        <p className={`text-lg font-medium ${statusColor}`}>{getStatusText()}</p>
      </div>
      <MicVisualizer volume={micVolume} />
      <button
        onClick={onToggleListening}
        className={`flex items-center justify-center w-24 h-24 rounded-full text-white transition-all duration-300 ease-in-out shadow-2xl focus:outline-none focus:ring-4 focus:ring-opacity-50 ${buttonBgColor} ${isListening ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
        aria-label={isListening ? 'Stop listening' : 'Start listening'}
      >
        {buttonIcon()}
      </button>
    </div>
  );
};

export default ControlPanel;
