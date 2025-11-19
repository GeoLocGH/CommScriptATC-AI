import React from 'react';
import CheckIcon from './icons/CheckIcon';
import CloseIcon from './icons/CloseIcon';
import InfoIcon from './icons/InfoIcon';

interface CallsignConfirmationBannerProps {
  callsign: string;
  onConfirm: () => void;
  onIgnore: () => void;
}

const CallsignConfirmationBanner: React.FC<CallsignConfirmationBannerProps> = ({ callsign, onConfirm, onIgnore }) => {
  return (
    <div className="w-full flex items-center justify-between p-3 bg-blue-600/30 backdrop-blur-sm rounded-lg border border-blue-500/50 text-blue-200 shadow-lg mb-4" role="alert">
      <div className="flex items-center space-x-3">
        <InfoIcon className="w-6 h-6 flex-shrink-0" />
        <div>
          <p className="font-semibold">AI detected callsign: <span className="font-bold text-white">{callsign.replace(/-/g, ' ')}</span></p>
          <p className="text-sm text-blue-300">Use for future read-backs?</p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={onConfirm}
          className="p-2 bg-green-500/30 hover:bg-green-500/50 rounded-full text-white transition-colors"
          title="Confirm and use this callsign"
          aria-label="Confirm and use this callsign"
        >
          <CheckIcon className="w-5 h-5" />
        </button>
        <button
          onClick={onIgnore}
          className="p-2 bg-red-500/30 hover:bg-red-500/50 rounded-full text-white transition-colors"
          title="Ignore this time"
          aria-label="Ignore this time"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default CallsignConfirmationBanner;
