

import React from 'react';
import { AppStatus } from '../types';
import MicrophoneIcon from './icons/MicrophoneIcon';
import StopIcon from './icons/StopIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import MicVisualizer from './MicVisualizer';
import DownloadIcon from './icons/DownloadIcon';
import WarningIcon from './icons/WarningIcon';
import RedoIcon from './icons/RedoIcon';
import BackspaceIcon from './icons/BackspaceIcon';

interface ControlPanelProps {
  status: AppStatus;
  isTrainingMode: boolean;
  onToggleListening: () => void;
  onRegenerateReadback: () => void;
  onClearTranscription: () => void;
  isRegenerateDisabled: boolean;
  micVolume: number;
  recordedAudioUrl: string | null;
  callsign: string;
  errorMessage?: string | null;
  thinkingMessage: string | null;
}

const SQUELCH_THRESHOLD = 0.01; // Below this RMS volume, show squelch effect

const ControlPanel: React.FC<ControlPanelProps> = ({ status, isTrainingMode, onToggleListening, onRegenerateReadback, onClearTranscription, isRegenerateDisabled, micVolume, recordedAudioUrl, callsign, errorMessage, thinkingMessage }) => {
  const isListening = status === AppStatus.LISTENING;

  const getStatusText = () => {
    if (isTrainingMode) {
      switch (status) {
        case AppStatus.AWAITING_USER_RESPONSE:
          return 'Your turn: Read back the instruction';
        case AppStatus.LISTENING:
          return 'Listening for your read-back...';
        case AppStatus.SPEAKING:
          return 'Playing ATC instruction...';
        case AppStatus.IDLE:
          return 'Select a training scenario above';
        case AppStatus.THINKING:
        case AppStatus.CHECKING_ACCURACY:
           return thinkingMessage ? `${thinkingMessage}...` : 'Analyzing your read-back...';
        case AppStatus.ERROR:
          return errorMessage || 'An error occurred. Please try again.';
      }
    }
    // Default status text for non-training mode
    switch (status) {
      case AppStatus.LISTENING:
        return 'Listening for ATC...';
      case AppStatus.THINKING:
        return thinkingMessage ? `${thinkingMessage}...` : 'Generating Read-back...';
      case AppStatus.CHECKING_ACCURACY:
        return thinkingMessage ? `${thinkingMessage}...` : 'Checking Accuracy...';
      case AppStatus.SPEAKING:
        return 'Speaking Read-back...';
      case AppStatus.ERROR:
        return errorMessage || 'An error occurred. Please try again.';
      case AppStatus.IDLE:
      default:
        if (recordedAudioUrl) return 'Session complete. Download available.';
        return 'Press Start to begin';
    }
  };
  
  const isLoading = [AppStatus.THINKING, AppStatus.CHECKING_ACCURACY, AppStatus.SPEAKING].includes(status);
  const canStart = [AppStatus.IDLE, AppStatus.AWAITING_USER_RESPONSE, AppStatus.ERROR].includes(status);
  const isButtonDisabled = isTrainingMode && status === AppStatus.IDLE;

  const buttonIcon = () => {
    if (isListening) return <StopIcon className="w-8 h-8" />;
    return <MicrophoneIcon className="w-8 h-8" />;
  };
  
  const buttonLabel = () => {
      if (isTrainingMode && status === AppStatus.AWAITING_USER_RESPONSE) {
          return 'Record Read-back';
      }
      return isListening ? 'Stop' : 'Start';
  }


  const buttonBgColor = isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700';
  const statusColor = status === AppStatus.ERROR ? 'text-red-400' : 'text-cyan-400';

  return (
    <div className="w-full flex flex-col items-center p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700">
      <div className="flex items-center space-x-3 mb-2">
        {isLoading ? (
          <SpinnerIcon className="w-6 h-6 text-cyan-400" />
        ) : status === AppStatus.ERROR ? (
          <WarningIcon className="w-5 h-5 text-red-400" />
        ) : (
          <div className={`w-4 h-4 rounded-full ${status === AppStatus.LISTENING || status === AppStatus.AWAITING_USER_RESPONSE ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
        )}
        <p className={`text-lg font-medium ${statusColor}`}>{getStatusText()}</p>
      </div>
      <MicVisualizer volume={micVolume} isSquelched={micVolume < SQUELCH_THRESHOLD && status === AppStatus.LISTENING} />
      <button
        onClick={onToggleListening}
        disabled={isButtonDisabled}
        className={`my-2 flex items-center justify-center w-24 h-24 rounded-full text-white transition-all duration-300 ease-in-out shadow-2xl focus:outline-none focus:ring-4 focus:ring-opacity-50 ${buttonBgColor} ${isListening ? 'focus:ring-red-500' : 'focus:ring-blue-500'} disabled:bg-gray-500 disabled:cursor-not-allowed`}
        aria-label={isListening ? 'Stop listening' : 'Start listening'}
      >
        {buttonIcon()}
      </button>

      <div className="flex items-center justify-center gap-2 mb-2">
        <button
          onClick={onRegenerateReadback}
          disabled={isRegenerateDisabled || isTrainingMode}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700/80 rounded-lg text-gray-300 text-sm transition-colors duration-200 enabled:hover:bg-gray-600/80 enabled:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Regenerate read-back for last ATC instruction"
          title={isTrainingMode ? "Regeneration disabled in training mode" : "Regenerate read-back for last ATC instruction (Cmd/Ctrl + R)"}
        >
          <RedoIcon className="w-4 h-4" />
          <span>Regenerate</span>
        </button>

        {status === AppStatus.LISTENING && (
            <button
                onClick={onClearTranscription}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-700/80 rounded-lg text-yellow-100 text-sm transition-colors duration-200 hover:bg-yellow-600/80 hover:text-white"
                aria-label="Clear current transcription"
                title="Clear current transcription (Cmd/Ctrl + Backspace)"
            >
                <BackspaceIcon className="w-4 h-4" />
                <span>Clear Input</span>
            </button>
        )}
      </div>

      {recordedAudioUrl && status === AppStatus.IDLE && !isTrainingMode && (
        <div className="mt-2">
            <a
                href={recordedAudioUrl}
                download={`atc-session-${callsign}-${new Date().toISOString()}.webm`}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                aria-label="Download session audio"
            >
                <DownloadIcon className="w-5 h-5" />
                <span>Download Audio</span>
            </a>
        </div>
      )}

    </div>
  );
};

export default ControlPanel;