import { TrainingScenario } from '../types';
import { BUILT_IN_SCENARIOS } from '../trainingScenarios';

const CUSTOM_SCENARIOS_KEY = 'atc-copilot-custom-scenarios';

const getCustomScenarios = (): TrainingScenario[] => {
  try {
    const storedScenarios = localStorage.getItem(CUSTOM_SCENARIOS_KEY);
    if (storedScenarios) {
      return JSON.parse(storedScenarios);
    }
  } catch (error) {
    console.error('Failed to load custom scenarios from localStorage', error);
  }
  return [];
};

const saveCustomScenarios = (scenarios: TrainingScenario[]): void => {
  try {
    localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(scenarios));
  } catch (error) {
    console.error('Failed to save custom scenarios to localStorage', error);
  }
};

// Function to get all scenarios, merging built-in with custom ones
export const getScenarios = (): TrainingScenario[] => {
  const builtInScenarios: TrainingScenario[] = BUILT_IN_SCENARIOS.map((scenario, index) => ({
    ...scenario,
    id: `builtin-${index}`, // Assign a unique ID
  }));
  const customScenarios = getCustomScenarios();
  return [...builtInScenarios, ...customScenarios];
};

// Function to save a new custom scenario
export const saveCustomScenario = (scenario: Omit<TrainingScenario, 'id' | 'isCustom'>): TrainingScenario[] => {
  const scenarios = getCustomScenarios();
  const newScenario: TrainingScenario = {
    ...scenario,
    id: `custom-${Date.now()}`,
    isCustom: true,
  };
  scenarios.push(newScenario);
  saveCustomScenarios(scenarios);
  return getScenarios(); // Return the full merged list
};

// Function to delete a custom scenario by its ID
export const deleteCustomScenario = (scenarioId: string): TrainingScenario[] => {
  let scenarios = getCustomScenarios();
  scenarios = scenarios.filter(s => s.id !== scenarioId);
  saveCustomScenarios(scenarios);
  return getScenarios(); // Return the full merged list
};

// Function to import custom scenarios from a file
export const importCustomScenarios = (newScenarios: any[]): { success: boolean; message: string; count: number } => {
    if (!Array.isArray(newScenarios)) {
        return { success: false, message: 'Import failed: File is not a valid scenario array.', count: 0 };
    }

    const existingScenarios = getCustomScenarios();
    const existingTitles = new Set(existingScenarios.map(s => s.title.toLowerCase()));
    let importCount = 0;

    for (const scenario of newScenarios) {
        // Basic validation
        if (
            typeof scenario.title === 'string' &&
            typeof scenario.description === 'string' &&
            typeof scenario.atcInstruction === 'string' &&
            typeof scenario.expectedReadback === 'string' &&
            typeof scenario.category === 'string' && // Validate category
            !existingTitles.has(scenario.title.toLowerCase())
        ) {
            const newScenario: TrainingScenario = {
                title: scenario.title,
                description: scenario.description,
                category: scenario.category,
                atcInstruction: scenario.atcInstruction,
                expectedReadback: scenario.expectedReadback,
                id: `custom-${Date.now()}-${Math.random()}`,
                isCustom: true,
            };
            existingScenarios.push(newScenario);
            existingTitles.add(newScenario.title.toLowerCase());
            importCount++;
        }
    }

    if (importCount > 0) {
        saveCustomScenarios(existingScenarios);
        return { success: true, message: `Successfully imported ${importCount} new scenario(s).`, count: importCount };
    } else {
        return { success: false, message: 'Import failed: No new, valid scenarios found in the file, or they already exist.', count: 0 };
    }
};