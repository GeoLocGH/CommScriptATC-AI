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
  accuracyScore?: number; // Score from 0.0 to 1.0
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

export const AVAILABLE_PILOT_VOICES = {
  'Puck': 'Standard Male 1',
  'Kore': 'Standard Female',
  'Zephyr': 'Calm Male',
  'Charon': 'Deep Male',
} as const;

export type PilotVoiceName = keyof typeof AVAILABLE_PILOT_VOICES;

export const AVAILABLE_ATC_VOICES = {
  'Fenrir': 'Authoritative Male',
  'Puck': 'Standard Male 1',
  'Kore': 'Standard Female',
  'Zephyr': 'Calm Male',
  'Charon': 'Deep Male',
} as const;

export type AtcVoiceName = keyof typeof AVAILABLE_ATC_VOICES;

export const AVAILABLE_PLAYBACK_SPEEDS = {
  '0.75': '0.75x (Slow)',
  '1.0': '1.0x (Normal)',
  '1.25': '1.25x (Fast)',
  '1.5': '1.5x (Faster)',
} as const;

export type PlaybackSpeed = keyof typeof AVAILABLE_PLAYBACK_SPEEDS;

export interface TrainingScenario {
  id: string;
  title: string;
  description: string;
  category: string;
  atcInstruction: string;
  expectedReadback: string;
  isCustom?: boolean;
}