
import React, { useState } from 'react';
import { LanguageCode, SUPPORTED_LANGUAGES, PilotVoiceName, AVAILABLE_PILOT_VOICES, AtcVoiceName, AVAILABLE_ATC_VOICES, PlaybackSpeed, AVAILABLE_PLAYBACK_SPEEDS } from '../types';

interface SettingsModalProps {
  currentCallsign: string;
  currentLanguage: LanguageCode;
  currentVoice: PilotVoiceName;
  currentAtcVoice: AtcVoiceName;
  currentPlaybackSpeed: PlaybackSpeed;
  currentAccuracyThreshold: number;
  currentDiversityMode: boolean;
  currentRadioEffects: boolean;
  onSave: (newCallsign: string, newLanguage: LanguageCode, newVoice: PilotVoiceName, newAtcVoice: AtcVoiceName, newPlaybackSpeed: PlaybackSpeed, newAccuracyThreshold: number, newDiversityMode: boolean, newRadioEffects: boolean) => void;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ currentCallsign, currentLanguage, currentVoice, currentAtcVoice, currentPlaybackSpeed, currentAccuracyThreshold, currentDiversityMode, currentRadioEffects, onSave, onClose }) => {
  const [callsign, setCallsign] = useState(currentCallsign);
  const [language, setLanguage] = useState<LanguageCode>(currentLanguage);
  const [voice, setVoice] = useState<PilotVoiceName>(currentVoice);
  const [atcVoice, setAtcVoice] = useState<AtcVoiceName>(currentAtcVoice);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(currentPlaybackSpeed);
  const [accuracyThreshold, setAccuracyThreshold] = useState(currentAccuracyThreshold);
  const [diversityMode, setDiversityMode] = useState(currentDiversityMode);
  const [radioEffects, setRadioEffects] = useState(currentRadioEffects);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (callsign.trim()) {
      onSave(callsign.trim(), language, voice, atcVoice, playbackSpeed, accuracyThreshold, diversityMode, radioEffects);
    }
  };

  return (
    <div className="fixed top-20 right-4 z-40 w-80 bg-gray-800 rounded-lg shadow-2xl border border-gray-700 flex flex-col max-h-[80vh]">
      <div className="p-3 border-b border-gray-700 flex justify-between items-center bg-gray-800/95 backdrop-blur rounded-t-lg sticky top-0 z-10">
        <h2 className="text-lg font-bold text-white">Settings</h2>
        <button type="button" onClick={onClose} className="text-gray-500 hover:text-white text-xl">&times;</button>
      </div>
      
      <div className="p-4 overflow-y-auto">
        <form onSubmit={handleSave}>
          <div className="mb-4">
            <label htmlFor="callsign" className="block text-xs font-medium text-gray-400 mb-1">
              Aircraft Callsign
            </label>
            <input
              type="text"
              id="callsign"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              placeholder="e.g., N123AB"
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="language" className="block text-xs font-medium text-gray-400 mb-1">
              Language
            </label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-4">
            <label htmlFor="voice" className="block text-xs font-medium text-gray-400 mb-1">
              Pilot Voice
            </label>
            <select
              id="voice"
              value={voice}
              onChange={(e) => setVoice(e.target.value as PilotVoiceName)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {Object.entries(AVAILABLE_PILOT_VOICES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="atc-voice" className="block text-xs font-medium text-gray-400 mb-1">
              ATC Voice (Training)
            </label>
            <select
              id="atc-voice"
              value={atcVoice}
              onChange={(e) => setAtcVoice(e.target.value as AtcVoiceName)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {Object.entries(AVAILABLE_ATC_VOICES).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="playbackSpeed" className="block text-xs font-medium text-gray-400 mb-1">
              Playback Speed
            </label>
            <select
              id="playbackSpeed"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(e.target.value as PlaybackSpeed)}
              className="w-full bg-gray-900 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {Object.entries(AVAILABLE_PLAYBACK_SPEEDS).map(([speed, name]) => (
                <option key={speed} value={speed}>{name}</option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label htmlFor="accuracyThreshold" className="block text-xs font-medium text-gray-400 mb-1">
              Accuracy Threshold
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                id="accuracyThreshold"
                min="50"
                max="100"
                step="5"
                value={accuracyThreshold}
                onChange={(e) => setAccuracyThreshold(parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <span className="text-sm font-bold text-cyan-400 w-10 text-right">{accuracyThreshold}%</span>
            </div>
          </div>

          <div className="mb-4">
             <div className="flex items-center justify-between">
                <label htmlFor="radioEffects" className="text-xs font-medium text-gray-400">
                  Simulate Radio Effects
                </label>
                <button
                  type="button"
                  id="radioEffects"
                  role="switch"
                  aria-checked={radioEffects}
                  onClick={() => setRadioEffects(!radioEffects)}
                  className={`${
                    radioEffects ? 'bg-blue-600' : 'bg-gray-700'
                  } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800`}
                >
                  <span
                    className={`${
                      radioEffects ? 'translate-x-5' : 'translate-x-1'
                    } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                  />
                </button>
             </div>
             <p className="text-[10px] text-gray-500 mt-1">
               Adds realistic static and frequency filtering to ATC audio.
             </p>
          </div>

          <div className="mb-6">
             <div className="flex items-center justify-between">
                <label htmlFor="diversityMode" className="text-xs font-medium text-gray-400">
                  Enhanced Accent Support
                </label>
                <button
                  type="button"
                  id="diversityMode"
                  role="switch"
                  aria-checked={diversityMode}
                  onClick={() => setDiversityMode(!diversityMode)}
                  className={`${
                    diversityMode ? 'bg-blue-600' : 'bg-gray-700'
                  } relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800`}
                >
                  <span
                    className={`${
                      diversityMode ? 'translate-x-5' : 'translate-x-1'
                    } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                  />
                </button>
             </div>
             <p className="text-[10px] text-gray-500 mt-1">
               Improves recognition for diverse accents and prioritizes intent over strict pronunciation.
             </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-white"
            >
              Close
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 rounded-md transition-colors text-white"
            >
              Save & Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;
