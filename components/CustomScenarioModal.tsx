
import React, { useState } from 'react';
import { TrainingScenario } from '../types';
import SpinnerIcon from './icons/SpinnerIcon';
import TrashIcon from './icons/TrashIcon';

interface CustomScenarioModalProps {
  onClose: () => void;
  onSave: (scenario: Omit<TrainingScenario, 'key' | 'isCustom'>) => void;
  onDelete: (scenarioKey: string) => void;
  onGenerate: (scenarioType: string) => Promise<Omit<TrainingScenario, 'key' | 'isCustom'>>;
  existingScenarios: TrainingScenario[];
}

const AI_GENERATION_TYPES = {
    'IFR Clearance': 'IFR Clearance',
    'VFR Clearance': 'VFR Clearance',
    'Traffic Pattern': 'Traffic Pattern',
    'Non-Towered Airport': 'Non-Towered Airport Communications',
    'Mountain Flying': 'Mountain Flying Procedures',
    'Emergency "MAYDAY"': 'Emergency "MAYDAY"',
    'Critical MAYDAY': 'Critical MAYDAY',
    'Approach & Diversion': 'Approach & Diversion',
    'Mixed Instructions': 'Mixed Instructions',
};

const CustomScenarioModal: React.FC<CustomScenarioModalProps> = ({ onClose, onSave, onDelete, onGenerate, existingScenarios }) => {
  const [name, setName] = useState('');
  const [atcInstruction, setAtcInstruction] = useState('');
  const [expectedReadback, setExpectedReadback] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && atcInstruction.trim() && expectedReadback.trim()) {
      onSave({ name, atcInstruction, expectedReadback });
      // Clear form after saving
      setName('');
      setAtcInstruction('');
      setExpectedReadback('');
    }
  };

  const handleGenerateClick = async (type: string) => {
    setIsGenerating(true);
    const result = await onGenerate(type);
    if(result) {
        setName(result.name);
        setAtcInstruction(result.atcInstruction);
        setExpectedReadback(result.expectedReadback);
    }
    setIsGenerating(false);
  }

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-2xl border border-gray-700">
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white">Manage Custom Scenarios</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl">&times;</button>
        </div>
        
        <div className="p-6 max-h-[80vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side: Form for new scenario */}
            <div className="flex flex-col space-y-4">
                <h3 className="text-lg font-semibold text-cyan-400 border-b border-cyan-400/20 pb-2">Create New Scenario</h3>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Scenario Name</label>
                        <input type="text" id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="e.g., IFR Clearance to LAX" required />
                    </div>
                    <div>
                        <label htmlFor="atc" className="block text-sm font-medium text-gray-300 mb-1">ATC Instruction</label>
                        <textarea id="atc" value={atcInstruction} onChange={(e) => setAtcInstruction(e.target.value)} rows={4} className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="Use {callsign} for the callsign" required />
                    </div>
                    <div>
                        <label htmlFor="readback" className="block text-sm font-medium text-gray-300 mb-1">Expected Pilot Read-back</label>
                        <textarea id="readback" value={expectedReadback} onChange={(e) => setExpectedReadback(e.target.value)} rows={4} className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" placeholder="Use {callsign} for the callsign" required />
                    </div>

                    <div className="pt-2">
                        <h4 className="text-sm font-semibold text-gray-400 mb-2">Or, Generate with AI:</h4>
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(AI_GENERATION_TYPES).map(([key, value]) => (
                                <button key={key} type="button" onClick={() => handleGenerateClick(value)} disabled={isGenerating} className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50 disabled:cursor-wait">
                                    {key}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <button type="submit" disabled={isGenerating} className="w-full mt-4 flex justify-center items-center px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50">
                        {isGenerating ? <SpinnerIcon className="w-5 h-5" /> : 'Save Scenario'}
                    </button>
                </form>
            </div>

            {/* Right side: List of existing scenarios */}
            <div className="flex flex-col">
                <h3 className="text-lg font-semibold text-cyan-400 border-b border-cyan-400/20 pb-2 mb-4">Saved Scenarios</h3>
                <div className="flex-grow overflow-y-auto space-y-2 pr-2">
                {existingScenarios.length > 0 ? (
                    existingScenarios.map(scenario => (
                        <div key={scenario.key} className="flex items-center justify-between p-2 bg-gray-900/50 rounded-md">
                            <span className="text-gray-300 text-sm">{scenario.name}</span>
                            <button onClick={() => onDelete(scenario.key)} className="p-1 text-gray-500 hover:text-red-400 rounded-full transition-colors" aria-label={`Delete ${scenario.name}`}>
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                ) : (
                    <p className="text-center text-gray-500 pt-8">No custom scenarios saved yet.</p>
                )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CustomScenarioModal;