








import React, { useState, useMemo } from 'react';
import { TrainingScenario } from '../types';
import TrashIcon from './icons/TrashIcon';
import PlusIcon from './icons/PlusIcon';
import GraduationCapIcon from './icons/GraduationCapIcon';
import DownloadIcon from './icons/DownloadIcon';
import UploadIcon from './icons/UploadIcon';

interface CustomScenarioModalProps {
  scenarios: TrainingScenario[];
  onSelect: (scenario: TrainingScenario) => void;
  onClose: () => void;
  onCreate: (scenario: Omit<TrainingScenario, 'id' | 'isCustom'>) => void;
  onDelete: (scenarioId: string) => void;
  onImport: (scenarios: any[]) => { success: boolean, message: string, count: number };
}

const CreateScenarioForm: React.FC<{
  onSave: (scenario: Omit<TrainingScenario, 'id' | 'isCustom'>) => void;
  onCancel: () => void;
  existingCategories: string[];
}> = ({ onSave, onCancel, existingCategories }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [atcInstruction, setAtcInstruction] = useState('');
  const [expectedReadback, setExpectedReadback] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && description.trim() && category.trim() && atcInstruction.trim() && expectedReadback.trim()) {
      onSave({ title, description, category, atcInstruction, expectedReadback });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">Scenario Title</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
      </div>
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Description</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} required rows={2} className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
      </div>
       <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-1">Category</label>
        <input 
            id="category" 
            value={category} 
            onChange={(e) => setCategory(e.target.value)} 
            required 
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            list="category-suggestions"
            placeholder="e.g., Basic Clearances"
        />
        <datalist id="category-suggestions">
            {existingCategories.map(cat => <option key={cat} value={cat} />)}
        </datalist>
      </div>
      <div>
        <label htmlFor="atcInstruction" className="block text-sm font-medium text-gray-300 mb-1">ATC Instruction</label>
        <textarea id="atcInstruction" value={atcInstruction} onChange={(e) => setAtcInstruction(e.target.value)} required rows={3} className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
      </div>
      <div>
        <label htmlFor="expectedReadback" className="block text-sm font-medium text-gray-300 mb-1">Expected Pilot Read-back</label>
        <textarea id="expectedReadback" value={expectedReadback} onChange={(e) => setExpectedReadback(e.target.value)} required rows={3} className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
      </div>
      <div className="flex justify-end space-x-2 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors">Cancel</button>
        <button type="submit" className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">Save Scenario</button>
      </div>
    </form>
  );
};

const CustomScenarioModal: React.FC<CustomScenarioModalProps> = ({ scenarios, onSelect, onClose, onCreate, onDelete, onImport }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');

  const categories = useMemo(() => {
    const allCategories = new Set(scenarios.map(s => s.category));
    return ['All', ...Array.from(allCategories).sort()];
  }, [scenarios]);

  const filteredScenarios = useMemo(() => {
    if (activeFilter === 'All') return scenarios;
    return scenarios.filter(s => s.category === activeFilter);
  }, [scenarios, activeFilter]);


  const handleCreate = (scenario: Omit<TrainingScenario, 'id' | 'isCustom'>) => {
    onCreate(scenario);
    setIsCreating(false);
  };

  const handleExport = () => {
    const customScenarios = scenarios.filter(s => s.isCustom);
    const dataStr = JSON.stringify(customScenarios.map(({ id, isCustom, ...rest }) => rest), null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'live-comm-transcript-atc-custom-scenarios.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text === 'string') {
          const json = JSON.parse(text);
          // FIX: Add a type guard to ensure the parsed JSON is an array before processing.
          if (Array.isArray(json)) {
            const result = onImport(json);
            alert(result.message);
          } else {
            alert('Import failed: File content is not a valid scenario array.');
          }
        }
      } catch (error) {
        alert('Import failed: Could not parse the file. Please ensure it is a valid JSON file.');
      } finally {
        // Allow re-uploading the same file if needed.
        if (event.target) {
            event.target.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const ScenarioList: React.FC<{ list: TrainingScenario[] }> = ({ list }) => {
     // Fix: Add a defensive check to ensure the 'list' prop is an array before attempting to use array methods on it.
     // This prevents a crash if invalid data is passed from a parent component.
     if (!Array.isArray(list) || list.length === 0) {
        return <p className="text-center text-gray-500 py-4">No scenarios in this category.</p>;
     }
     
     const groupedScenarios = list.reduce((acc, scenario) => {
        const key = scenario.isCustom ? 'Custom Scenarios' : 'Built-in Scenarios';
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(scenario);
        return acc;
     }, {} as Record<string, TrainingScenario[]>);

     return (
        <div className="space-y-4">
        {/* FIX: Explicitly type the destructured parameters to ensure `groupList` is recognized as an array. */}
        {Object.entries(groupedScenarios).map(([groupTitle, groupList]: [string, TrainingScenario[]]) => (
          <div key={groupTitle}>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">{groupTitle}</h3>
            <ul className="space-y-2">
              {groupList.map((scenario) => (
                <li key={scenario.id} className="group flex items-center justify-between p-3 rounded-md hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => onSelect(scenario)}>
                  <div>
                    <p className="font-semibold text-gray-200">{scenario.title}</p>
                    <p className="text-sm text-gray-400">{scenario.description}</p>
                  </div>
                  {scenario.isCustom && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete the scenario "${scenario.title}"? This cannot be undone.`)) {
                          onDelete(scenario.id);
                        }
                      }}
                      className="p-1.5 text-gray-500 hover:text-red-400 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                      aria-label={`Delete scenario ${scenario.title}`}
                      title="Delete scenario"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
     )
  };

  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-gray-800 rounded-lg shadow-2xl border border-gray-700 flex flex-col">
        <header className="flex justify-between items-center p-4 border-b border-gray-700">
          <div className="flex items-center space-x-2">
            <GraduationCapIcon className="w-6 h-6 text-cyan-400" />
            <h2 className="text-xl font-bold text-white">{isCreating ? 'Create Custom Scenario' : 'Select a Training Scenario'}</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl" title="Close">&times;</button>
        </header>
        <main className="p-6 overflow-y-auto max-h-[70vh]">
          {isCreating ? (
            <CreateScenarioForm onSave={handleCreate} onCancel={() => setIsCreating(false)} existingCategories={categories.filter(c => c !== 'All')} />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
                 <button onClick={() => setIsCreating(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors">
                    <PlusIcon className="w-5 h-5" />
                    Create New
                 </button>
                 <label className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 rounded-md transition-colors cursor-pointer">
                    <UploadIcon className="w-5 h-5" />
                    Import
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
                 </label>
                 <button onClick={handleExport} disabled={!scenarios.some(s=>s.isCustom)} className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <DownloadIcon className="w-5 h-5" />
                    Export
                 </button>
              </div>

              <div className="mb-4 border-b border-gray-700">
                <div className="flex space-x-1 overflow-x-auto">
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setActiveFilter(category)}
                            className={`px-3 py-2 text-sm font-medium rounded-t-md whitespace-nowrap transition-colors ${activeFilter === category ? 'bg-gray-700 text-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
              </div>

              <ScenarioList list={filteredScenarios} />
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default CustomScenarioModal;