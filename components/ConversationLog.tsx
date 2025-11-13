
import React, { useRef, useEffect } from 'react';
import { ConversationEntry } from '../types';
import PilotIcon from './icons/PilotIcon';
import TowerIcon from './icons/TowerIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import WarningIcon from './icons/WarningIcon';

interface ConversationLogProps {
  log: ConversationEntry[];
  interimTranscription: string;
}

const ConversationLog: React.FC<ConversationLogProps> = ({ log, interimTranscription }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log, interimTranscription]);

  const getIcon = (speaker: 'ATC' | 'PILOT') => {
    if (speaker === 'ATC') {
      return <TowerIcon className="w-6 h-6 text-cyan-400 flex-shrink-0" />;
    }
    return <PilotIcon className="w-6 h-6 text-green-400 flex-shrink-0" />;
  };

  const getLabel = (speaker: 'ATC' | 'PILOT') => {
    if (speaker === 'ATC') {
      return <span className="font-bold text-cyan-400">ATC</span>;
    }
    return <span className="font-bold text-green-400">PILOT</span>;
  };
  
  const FeedbackBlock: React.FC<{ entry: ConversationEntry }> = ({ entry }) => {
    if (!entry.feedback) return null;

    const {
      accuracy,
      feedbackSummary,
      detailedFeedback,
      correctPhraseology,
      commonPitfalls,
      furtherReading,
    } = entry.feedback;

    const isCorrect = accuracy === 'CORRECT';
    const borderColor = isCorrect ? 'border-green-500/50' : 'border-yellow-500/50';
    const iconColor = isCorrect ? 'text-green-400' : 'text-yellow-400';
    const titleColor = isCorrect ? 'text-green-300' : 'text-yellow-300';

    const FeedbackSection: React.FC<{ title: string; children: React.ReactNode; mono?: boolean }> = ({ title, children, mono = false }) => (
      <div className="mt-3">
        <h5 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{title}</h5>
        <p className={`text-gray-300 whitespace-pre-wrap ${mono ? 'font-mono bg-gray-900/50 p-2 rounded-md mt-1' : ''}`}>{children}</p>
      </div>
    );

    return (
      <div className={`mt-3 p-3 rounded-lg border bg-gray-800/50 ${borderColor}`}>
        <div className="flex items-start space-x-2">
          {isCorrect ? (
            <CheckCircleIcon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-1`} />
          ) : (
            <WarningIcon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-1`} />
          )}
          <div>
            <h4 className={`font-semibold ${titleColor}`}>Accuracy Check</h4>
            <p className="text-gray-200">{feedbackSummary}</p>
          </div>
        </div>
        {!isCorrect && (
          <div className="ml-7 mt-2 border-l border-gray-600 pl-4">
            {detailedFeedback && <FeedbackSection title="Details">{detailedFeedback}</FeedbackSection>}
            {correctPhraseology && <FeedbackSection title="Correct Phraseology" mono>{correctPhraseology}</FeedbackSection>}
            {commonPitfalls && <FeedbackSection title="Common Pitfalls">{commonPitfalls}</FeedbackSection>}
            {furtherReading && <FeedbackSection title="Further Reading">{furtherReading}</FeedbackSection>}
          </div>
        )}
      </div>
    );
  };


  return (
    <div ref={scrollRef} className="flex-grow w-full bg-gray-900/70 p-4 rounded-lg overflow-y-auto border border-gray-700 shadow-inner h-64 md:h-auto">
      <div className="space-y-4">
        {log.map((entry, index) => (
          <div key={index} className="flex items-start space-x-3">
            {getIcon(entry.speaker)}
            <div className="flex-1">
              {getLabel(entry.speaker)}
              <p className="text-gray-200 text-lg leading-relaxed">{entry.text}</p>
              {entry.speaker === 'PILOT' && <FeedbackBlock entry={entry} />}
            </div>
          </div>
        ))}
        {interimTranscription && (
          <div className="flex items-start space-x-3 opacity-60">
            {getIcon('ATC')}
            <div className="flex-1">
              {getLabel('ATC')}
              <p className="text-gray-400 text-lg leading-relaxed">{interimTranscription}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationLog;