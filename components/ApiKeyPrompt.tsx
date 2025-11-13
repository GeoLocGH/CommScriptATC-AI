

import React from 'react';
import SpinnerIcon from './icons/SpinnerIcon';

const ApiKeyPrompt: React.FC<{ onSelectKey: () => void, isVerifying?: boolean }> = ({ onSelectKey, isVerifying = false }) => (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center text-center p-8 bg-gray-800/50 rounded-lg border border-gray-700 shadow-lg">
        <header className="text-center mb-6">
          <h1 className="text-4xl md:text-5xl font-bold text-cyan-400">CommScript ATC</h1>
          <p className="text-gray-400 mt-2">AI-Powered Radio Communication Assistant</p>
        </header>
        <div className="w-full bg-gray-800 p-6 rounded-lg border border-yellow-500/50">
            <h2 className="text-2xl font-bold text-yellow-300 mb-4">API Key Required</h2>
            <p className="text-gray-300 mb-6">
                To use the live transcription features of this application, you need to select a Gemini API key.
                Usage of this API may incur charges. For more information, please see the{' '}
                <a
                    href="https://ai.google.dev/gemini-api/docs/billing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                >
                    billing documentation
                </a>.
            </p>
            <button
                onClick={onSelectKey}
                disabled={isVerifying}
                className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
            >
                {isVerifying ? (
                    <>
                        <SpinnerIcon className="w-5 h-5 mr-3" />
                        Verifying...
                    </>
                ) : (
                    'Select API Key'
                )}
            </button>
        </div>
        <footer className="text-center text-gray-600 text-sm mt-8">
            <p>Callsign: N123AB. For training and simulation purposes only.</p>
        </footer>
    </div>
);

export default ApiKeyPrompt;