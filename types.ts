
export enum AppStatus {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  CHECKING_ACCURACY = 'CHECKING_ACCURACY',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR',
}

export interface PhraseAnalysis {
  phrase: string;
  status: 'correct' | 'acceptable_variation' | 'incorrect';
  explanation?: string;
}

export interface ReadbackFeedback {
  accuracy: 'CORRECT' | 'INCORRECT';
  feedbackSummary: string;
  detailedFeedback?: string;
  correctPhraseology?: string;
  phraseAnalysis?: PhraseAnalysis[];
  commonPitfalls?: string;
  furtherReading?: string;
}

export interface ConversationEntry {
  speaker: 'ATC' | 'PILOT';
  text: string;
  feedback?: ReadbackFeedback;
  confidence?: number;
  alternatives?: string[];
}

export interface Session {
  id: number; // Using timestamp as ID
  date: string;
  log: ConversationEntry[];
}

export const SUPPORTED_LANGUAGES = {
  'en-US': 'English',
  'fr-FR': 'French',
  'ja-JP': 'Japanese',
} as const;

export type LanguageCode = keyof typeof SUPPORTED_LANGUAGES;

export const AVAILABLE_VOICES = {
  'Puck': 'Standard Male 1',
  'Kore': 'Standard Female',
  'Zephyr': 'Calm Male',
  'Charon': 'Deep Male',
  'Fenrir': 'Authoritative Male',
} as const;

export type VoiceName = keyof typeof AVAILABLE_VOICES;
