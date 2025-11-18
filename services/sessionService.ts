import { Session, ConversationEntry } from '../types';

const SESSIONS_KEY = 'atc-copilot-sessions';
const IN_PROGRESS_SESSION_KEY = 'atc-copilot-in-progress-session';

export const getSavedSessions = (): Session[] => {
  try {
    const sessionsJson = localStorage.getItem(SESSIONS_KEY);
    if (sessionsJson) {
      const sessions = JSON.parse(sessionsJson) as Session[];
      // Sort by date descending
      return sessions.sort((a, b) => b.id - a.id);
    }
  } catch (error) {
    console.error("Failed to load sessions from localStorage", error);
  }
  return [];
};

export const saveInProgressSession = (log: ConversationEntry[], isTrainingMode: boolean): void => {
  if (isTrainingMode || log.length === 0) {
    clearInProgressSession();
    return;
  }
  try {
    localStorage.setItem(IN_PROGRESS_SESSION_KEY, JSON.stringify(log));
  } catch (error) {
    console.error("Failed to save in-progress session to localStorage", error);
  }
};

export const loadInProgressSession = (): ConversationEntry[] | null => {
  try {
    const logJson = localStorage.getItem(IN_PROGRESS_SESSION_KEY);
    return logJson ? JSON.parse(logJson) as ConversationEntry[] : null;
  } catch (error) {
    console.error("Failed to load in-progress session from localStorage", error);
    return null;
  }
};

export const clearInProgressSession = (): void => {
  try {
    localStorage.removeItem(IN_PROGRESS_SESSION_KEY);
  } catch (error)
 {
    console.error("Failed to clear in-progress session from localStorage", error);
  }
};

export const saveSession = (log: ConversationEntry[], isTrainingMode: boolean): Session[] => {
  if (log.length === 0 || isTrainingMode) return getSavedSessions();

  const newSession: Session = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    log: log,
  };

  const sessions = getSavedSessions();
  const updatedSessions = [newSession, ...sessions];

  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(updatedSessions));
    clearInProgressSession(); // Clear the temporary session on successful save
    return updatedSessions;
  } catch (error) {
    console.error("Failed to save session to localStorage", error);
    return sessions; // return original sessions on failure
  }
};

export const deleteSession = (sessionId: number): Session[] => {
    const sessions = getSavedSessions();
    const updatedSessions = sessions.filter(session => session.id !== sessionId);

    try {
        localStorage.setItem(SESSIONS_KEY, JSON.stringify(updatedSessions));
        return updatedSessions;
    } catch (error) {
        console.error("Failed to delete session from localStorage", error);
        return sessions;
    }
};

export const clearAllSessions = (): Session[] => {
    try {
        localStorage.removeItem(SESSIONS_KEY);
        return [];
    } catch (error) {
        console.error("Failed to clear sessions from localStorage", error);
        return getSavedSessions();
    }
}
