import React from 'react';
import { TrainingScenario } from '../types';
import GraduationCapIcon from './icons/GraduationCapIcon';

interface TrainingModeBarProps {
  scenario: TrainingScenario;
  onExit: () => void;
}

const TrainingModeBar: React.FC<TrainingModeBarProps> = ({ scenario, onExit }) => {
  return (
    <div className="w-full flex items-center justify-between p-3 bg-yellow-600/30 backdrop-blur-sm rounded-lg border border-yellow-500/50 text-yellow-200 shadow-lg mb-4">
      <div className="flex items-center space-x-3">
        <GraduationCapIcon className="w-6 h-6 flex-shrink-0" />
        <div>
          <h3 className="font-bold">Training Mode</h3>
          <p className="text-sm text-yellow-300">{scenario.title}</p>
        </div>
      </div>
      <button
        onClick={onExit}
        className="px-4 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors text-white"
        title="Exit training mode"
      >
        Exit
      </button>
    </div>
  );
};

export default TrainingModeBar;