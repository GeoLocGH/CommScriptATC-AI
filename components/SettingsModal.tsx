import React, { useState } from 'react';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../types';

interface SettingsModalProps {
  currentCallsign: string;
  currentLanguage: LanguageCode;
  onSave: (newCallsign: string, newLanguage: LanguageCode) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ currentCallsign, currentLanguage, onSave, onClose }) => {
  const [callsign, setCallsign] = useState(currentCallsign);
  const [language, setLanguage] = useState<LanguageCode>(currentLanguage);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (callsign.trim()) {
      onSave(callsign.trim(), language);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">&times;</button>
        </div>
        
        <form onSubmit={handleSave}>
          <div className="mb-6">
            <label htmlFor="callsign" className="block text-sm font-medium text-gray-300 mb-2">
              Aircraft Callsign
            </label>
            <input
              type="text"
              id="callsign"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="e.g., November-One-Two-Three-Alpha-Bravo"
              required
            />
             <p className="text-xs text-gray-500 mt-2">Use phonetic alphabet for best results (e.g., "Alpha", not "A").</p>
          </div>

          <div className="mb-6">
            <label htmlFor="language" className="block text-sm font-medium text-gray-300 mb-2">
              Transcription Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">Select the language for ATC communications.</p>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;
