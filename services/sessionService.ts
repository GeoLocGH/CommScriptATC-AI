import { Session, ConversationEntry } from '../types';

const SESSIONS_KEY = 'atc-copilot-sessions';

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

export const saveSession = (log: ConversationEntry[]): Session[] => {
  if (log.length === 0) return getSavedSessions();

  const newSession: Session = {
    id: Date.now(),
    date: new Date().toLocaleString(),
    log: log,
  };

  const sessions = getSavedSessions();
  const updatedSessions = [newSession, ...sessions];

  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(updatedSessions));
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
