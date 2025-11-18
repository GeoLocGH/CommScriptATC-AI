

import React, { useState } from 'react';
import { TrainingScenario } from '../types';
import GraduationCapIcon from './icons/GraduationCapIcon';
import PlusIcon from './icons/PlusIcon';

interface TrainingModeBarProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  scenarios: TrainingScenario[];
  onSelectScenario: (scenario: TrainingScenario) => void;
  isInteractionDisabled: boolean;
  onManageCustom: () => void;
}

const TrainingModeBar: React.FC<TrainingModeBarProps> = ({ isEnabled, onToggle, scenarios, onSelectScenario, isInteractionDisabled, onManageCustom }) => {
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<string>('');
  
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const scenarioKey = e.target.value;
    setSelectedScenarioKey(scenarioKey);
    const scenario = scenarios.find(s => s.key === scenarioKey);
    if (scenario) {
      onSelectScenario(scenario);
    }
  };

  const defaultScenarios = scenarios.filter(s => !s.isCustom);
  const customScenarios = scenarios.filter(s => s.isCustom);


  return (
    <div className="w-full flex flex-col md:flex-row items-center justify-between p-3 bg-gray-800/50 backdrop-blur-sm rounded-lg border border-gray-700 shadow-lg space-y-3 md:space-y-0">
      <div className="flex items-center space-x-3">
        <GraduationCapIcon className="w-6 h-6 text-cyan-400" />
        <span className="font-semibold text-lg text-white">Training Mode</span>
        <label htmlFor="training-toggle" className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            id="training-toggle" 
            className="sr-only peer"
            checked={isEnabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
          <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>
      {isEnabled && (
        <div className="w-full md:w-auto flex items-center gap-2">
          <select
            value={selectedScenarioKey}
            onChange={handleSelectChange}
            disabled={isInteractionDisabled}
            className="flex-grow md:w-64 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            aria-label="Select training scenario"
          >
            <option value="" disabled>
              Select a scenario...
            </option>
            <optgroup label="Default Scenarios">
                {defaultScenarios.map(scenario => (
                <option key={scenario.key} value={scenario.key}>
                    {scenario.name}
                </option>
                ))}
            </optgroup>
            {customScenarios.length > 0 && (
                <optgroup label="Custom Scenarios">
                    {customScenarios.map(scenario => (
                    <option key={scenario.key} value={scenario.key}>
                        {scenario.name}
                    </option>
                    ))}
                </optgroup>
            )}
          </select>
          <button
            onClick={onManageCustom}
            disabled={isInteractionDisabled}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-md text-white transition-colors disabled:opacity-50"
            title="Manage Custom Scenarios"
            aria-label="Manage Custom Scenarios"
           >
            <PlusIcon className="w-5 h-5" />
           </button>
        </div>
      )}
    </div>
  );
};

export default TrainingModeBar;