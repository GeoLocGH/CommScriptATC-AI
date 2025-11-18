
import { TrainingScenario } from '../types';

const CUSTOM_SCENARIOS_KEY = 'atc-copilot-custom-scenarios';

export const getCustomScenarios = (): TrainingScenario[] => {
  try {
    const scenariosJson = localStorage.getItem(CUSTOM_SCENARIOS_KEY);
    if (scenariosJson) {
      const scenarios = JSON.parse(scenariosJson) as TrainingScenario[];
      return scenarios.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch (error) {
    console.error("Failed to load custom scenarios from localStorage", error);
  }
  return [];
};

export const saveCustomScenario = (scenario: Omit<TrainingScenario, 'key' | 'isCustom'>): TrainingScenario[] => {
  const scenarios = getCustomScenarios();
  const newScenario: TrainingScenario = {
    ...scenario,
    key: `custom-${Date.now()}`,
    isCustom: true,
  };

  const updatedScenarios = [...scenarios, newScenario];

  try {
    localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(updatedScenarios));
    return getCustomScenarios();
  } catch (error) {
    console.error("Failed to save custom scenario to localStorage", error);
    return scenarios;
  }
};

export const deleteCustomScenario = (scenarioKey: string): TrainingScenario[] => {
    const scenarios = getCustomScenarios();
    const updatedScenarios = scenarios.filter(s => s.key !== scenarioKey);

    try {
        localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(updatedScenarios));
        return getCustomScenarios();
    } catch (error) {
        console.error("Failed to delete custom scenario from localStorage", error);
        return scenarios;
    }
};