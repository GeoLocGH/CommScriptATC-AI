import React from 'react';
import { AppStatus, TrainingScenario } from '../types';
import MicrophoneIcon from './icons/MicrophoneIcon';
import StopIcon from './icons/StopIcon';
import SpinnerIcon from './icons/SpinnerIcon';
import MicVisualizer from './MicVisualizer';
import DownloadIcon from './icons/DownloadIcon';
import WarningIcon from './icons/WarningIcon';
import RedoIcon from './icons/RedoIcon';
import BackspaceIcon from './icons/BackspaceIcon';
import TransponderIcon from './icons/TransponderIcon';

interface ControlPanelProps {
  status: AppStatus;
  onToggleListening: () => void;
  onRegenerateReadback: () => void;
  onClearTranscription: () => void;
  isRegenerateDisabled: boolean;
  micVolume: number;
  recordedAudioUrl: string | null;
  callsign: string;
  errorMessage?: string | null;
  isTrainingMode: boolean;
  currentScenario: TrainingScenario | null;
  squawkCode: string;
  onSquawkCodeChange: (code: string) => void;
  onSquawkSubmit: () => void;
  isSquawkDisabled: boolean;
}

const SQUELCH_THRESHOLD = 0.01; // Below this RMS volume, show squelch effect

const ControlPanel: React.FC<ControlPanelProps> = ({ status, onToggleListening, onRegenerateReadback, onClearTranscription, isRegenerateDisabled, micVolume, recordedAudioUrl, callsign, errorMessage, isTrainingMode, squawkCode, onSquawkCodeChange, onSquawkSubmit, isSquawkDisabled }) => {
  const isListening = status === AppStatus.LISTENING;
  
  const getStatusText = () => {
    if (isTrainingMode) {
      switch (status) {
        case AppStatus.SPEAKING:
          return 'Playing ATC instruction...';
        case AppStatus.LISTENING:
          return 'Listening for your read-back...';
        case AppStatus.IDLE:
          return 'Press button to speak read-back';
        case AppStatus.THINKING:
          return 'Analyzing your read-back...';
        default:
          return 'Training mode active';
      }
    }

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
        return errorMessage || 'An error occurred. Please try again.';
      case AppStatus.IDLE:
      default:
        if (recordedAudioUrl) return 'Session complete. Download available.';
        return 'Press Start to begin';
    }
  };
  
  const isLoading = [AppStatus.THINKING, AppStatus.CHECKING_ACCURACY].includes(status) || (isTrainingMode && status === AppStatus.SPEAKING);

  const buttonIcon = () => {
    if (isListening) return <StopIcon className="w-8 h-8" />;
    return <MicrophoneIcon className="w-8 h-8" />;
  };

  const buttonAriaLabel = isListening ? 'Stop recording' : isTrainingMode ? 'Start recording your read-back' : 'Start listening for ATC';

  const buttonBgColor = isListening ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700';
  const statusColor = status === AppStatus.ERROR ? 'text-red-400' : 'text-cyan-400';
  
  const handleSquawkInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Squawk codes only use digits 0-7.
    const value = e.target.value.replace(/[^0-7]/g, '').slice(0, 4);
    onSquawkCodeChange(value);
  };

  const handleSquawkFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSquawkSubmit();
  };


  return (
    <div className="w-full flex flex-col items-center p-4 bg-gray-800/50 backdrop-blur-sm rounded-lg shadow-lg border border-gray-700">
      <div className="flex items-center space-x-3 mb-2">
        {isLoading ? (
          <SpinnerIcon className="w-6 h-6 text-cyan-400" />
        ) : status === AppStatus.ERROR ? (
          <WarningIcon className="w-5 h-5 text-red-400" />
        ) : (
          <div className={`w-4 h-4 rounded-full ${status === AppStatus.LISTENING ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
        )}
        <p className={`text-lg font-medium ${statusColor}`}>{getStatusText()}</p>
      </div>
      <MicVisualizer volume={micVolume} isSquelched={micVolume < SQUELCH_THRESHOLD && status === AppStatus.LISTENING} />
      <button
        onClick={onToggleListening}
        className={`my-2 flex items-center justify-center w-24 h-24 rounded-full text-white transition-all duration-300 ease-in-out shadow-2xl focus:outline-none focus:ring-4 focus:ring-opacity-50 ${buttonBgColor} ${isListening ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
        aria-label={buttonAriaLabel}
        disabled={isTrainingMode && status === AppStatus.SPEAKING}
      >
        {buttonIcon()}
      </button>

      <div className="flex items-center justify-center gap-2 mb-2">
        <button
          onClick={onRegenerateReadback}
          disabled={isRegenerateDisabled || isTrainingMode}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700/80 rounded-lg text-gray-300 text-sm transition-colors duration-200 enabled:hover:bg-gray-600/80 enabled:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Regenerate read-back for last ATC instruction"
          title={isTrainingMode ? "Regeneration is disabled in training mode" : "Regenerate read-back for last ATC instruction"}
        >
          <RedoIcon className="w-4 h-4" />
          <span>Regenerate</span>
        </button>

        {status === AppStatus.LISTENING && !isTrainingMode && (
            <button
                onClick={onClearTranscription}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-700/80 rounded-lg text-yellow-100 text-sm transition-colors duration-200 hover:bg-yellow-600/80 hover:text-white"
                aria-label="Clear current transcription"
                title="Clear current transcription"
            >
                <BackspaceIcon className="w-4 h-4" />
                <span>Clear Input</span>
            </button>
        )}
      </div>

      <form onSubmit={handleSquawkFormSubmit} className="w-full flex items-center justify-center gap-2 mt-2">
        <label htmlFor="squawk-input" className="sr-only">Squawk Code</label>
        <input
            id="squawk-input"
            type="text"
            value={squawkCode}
            onChange={handleSquawkInputChange}
            className="w-32 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white text-center font-mono tracking-widest placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            placeholder="7000"
            maxLength={4}
            pattern="[0-7]{4}"
            title="Enter a 4-digit squawk code (digits 0-7)"
            disabled={isSquawkDisabled}
        />
        <button
            type="submit"
            disabled={isSquawkDisabled || squawkCode.length !== 4}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-lg text-white text-sm transition-colors duration-200 enabled:hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Generate read-back for this squawk code"
        >
            <TransponderIcon className="w-4 h-4" />
            <span>Squawk</span>
        </button>
      </form>


      {recordedAudioUrl && status === AppStatus.IDLE && (
        <div className="mt-4">
            <a
                href={recordedAudioUrl}
                download={`atc-session-${callsign}-${new Date().toISOString()}.wav`}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors"
                aria-label="Download session audio"
                title="Download session audio as WAV"
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