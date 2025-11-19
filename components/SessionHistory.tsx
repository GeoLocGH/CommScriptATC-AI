import React, { useState } from 'react';
import { Session } from '../types';
import HistoryIcon from './icons/HistoryIcon';
import TrashIcon from './icons/TrashIcon';
import PlusIcon from './icons/PlusIcon';


interface SessionHistoryProps {
  sessions: Session[];
  currentSessionId: number | null;
  onLoadSession: (session: Session) => void;
  onDeleteSession: (sessionId: number) => void;
  onClearAll: () => void;
  onNewSession: () => void;
}

const SessionHistory: React.FC<SessionHistoryProps> = ({ sessions, currentSessionId, onLoadSession, onDeleteSession, onClearAll, onNewSession }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleClear = () => {
    if (window.confirm('Are you sure you want to delete all saved sessions? This cannot be undone.')) {
      onClearAll();
    }
  };

  return (
    <div className="w-full bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 shadow-lg">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 text-left text-cyan-400 hover:bg-gray-700/50 rounded-t-lg transition-colors"
        aria-expanded={isOpen}
        title={isOpen ? "Collapse Session History" : "Expand Session History"}
      >
        <div className="flex items-center space-x-2">
          <HistoryIcon className="w-5 h-5" />
          <span className="font-semibold">Session History</span>
        </div>
        <svg
          className={`w-6 h-6 transform transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="p-3 border-t border-gray-700">
          <div className="flex items-center mb-3 space-x-2">
            <button
              onClick={onNewSession}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              title="Start a new live session"
            >
              <PlusIcon className="w-5 h-5" />
              New Session
            </button>
            {sessions.length > 0 && (
                 <button
                    onClick={handleClear}
                    className="px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 rounded-md transition-colors"
                    title="Delete all saved sessions"
                 >
                    Clear All
                </button>
            )}
          </div>

          {sessions.length > 0 ? (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {sessions.map((session) => (
                <li
                  key={session.id}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${currentSessionId === session.id ? 'bg-blue-500/30' : 'hover:bg-gray-700/50'}`}
                  onClick={() => onLoadSession(session)}
                  title={`Load session from ${session.date}`}
                >
                  <span className="text-gray-300">{session.date}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSession(session.id);
                    }}
                    className="p-1 text-gray-500 hover:text-red-400 rounded-full transition-colors"
                    aria-label="Delete session"
                    title="Delete session"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-gray-500 py-4">No saved sessions.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default SessionHistory;