
export enum AppStatus {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  THINKING = 'THINKING',
  CHECKING_ACCURACY = 'CHECKING_ACCURACY',
  SPEAKING = 'SPEAKING',
  ERROR = 'ERROR',
}

export interface ReadbackFeedback {
  accuracy: 'CORRECT' | 'INCORRECT';
  feedbackSummary: string;
  detailedFeedback?: string;
  correctPhraseology?: string;
  commonPitfalls?: string;
  furtherReading?: string;
}

export interface ConversationEntry {
  speaker: 'ATC' | 'PILOT';
  text: string;
  feedback?: ReadbackFeedback;
}

export interface Session {
  id: number; // Using timestamp as ID
  date: string;
  log: ConversationEntry[];
}
