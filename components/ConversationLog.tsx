import React, { useRef, useEffect } from 'react';
import { ConversationEntry, PhraseAnalysis } from '../types';
import PilotIcon from './icons/PilotIcon';
import TowerIcon from './icons/TowerIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';
import WarningIcon from './icons/WarningIcon';
import RedoIcon from './icons/RedoIcon';

interface ConversationLogProps {
  log: ConversationEntry[];
  interimTranscription: string;
  accuracyThreshold: number;
}

const ConfidenceIndicator: React.FC<{ score: number | undefined, speaker: 'ATC' | 'PILOT' }> = ({ score, speaker }) => {
  if (typeof score !== 'number') {
    return null;
  }

  const roundedScore = Math.round(score * 100);
  const title = speaker === 'ATC'
    ? `Transcription Confidence: ${roundedScore}%`
    : `Read-back Generation Confidence: ${roundedScore}%`;

  let colorClass = 'bg-red-500';
  if (score >= 0.85) {
    colorClass = 'bg-green-500';
  } else if (score >= 0.6) {
    colorClass = 'bg-yellow-400';
  }

  return (
    <div
      className={`w-3 h-3 rounded-full ml-2 flex-shrink-0`}
      title={title}
      aria-label={title}
    >
      <div className={`w-full h-full rounded-full ${colorClass}`}></div>
    </div>
  );
};

const ConversationLog: React.FC<ConversationLogProps> = ({ log, interimTranscription, accuracyThreshold }) => {
  const endOfLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfLogRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      accuracyScore,
      feedbackSummary,
      detailedFeedback,
      correctPhraseology,
      phraseAnalysis,
      commonPitfalls,
      furtherReading,
    } = entry.feedback;

    const isCorrect = accuracy === 'CORRECT';
    const borderColor = isCorrect ? 'border-green-500/50' : 'border-yellow-500/50';
    const iconColor = isCorrect ? 'text-green-400' : 'text-yellow-400';
    const titleColor = isCorrect ? 'text-green-300' : 'text-yellow-300';
    const scorePercentage = typeof accuracyScore === 'number' ? Math.round(accuracyScore * 100) : null;
    const isBelowThreshold = typeof accuracyScore === 'number' && accuracyScore < (accuracyThreshold / 100);

    const FeedbackSection: React.FC<{ title: string; children: React.ReactNode; mono?: boolean }> = ({ title, children, mono = false }) => (
      <div className="mt-3">
        <h5 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{title}</h5>
        <div className={`text-gray-300 whitespace-pre-wrap ${mono ? 'font-mono bg-gray-900/50 p-2 rounded-md mt-1' : 'mt-1'}`}>{children}</div>
      </div>
    );
    
    const PhraseAnalysisBlock: React.FC<{ analysis: PhraseAnalysis[] }> = ({ analysis }) => {
      const getStatusColor = (status: PhraseAnalysis['status']) => {
        switch (status) {
          case 'correct':
            return 'border-green-500/50 bg-green-500/10 text-green-300';
          case 'acceptable_variation':
            return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-300';
          case 'incorrect':
            return 'border-red-500/50 bg-red-500/10 text-red-300';
          default:
            return 'border-gray-600/50 bg-gray-600/10 text-gray-300';
        }
      };

      return (
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {analysis.map((item, index) => (
            <span
              key={index}
              className={`font-mono px-2 py-1 rounded-md border text-sm ${getStatusColor(item.status)}`}
              title={item.explanation || item.status}
            >
              {item.phrase}
            </span>
          ))}
        </div>
      );
    };

    return (
      <div className={`mt-3 p-3 rounded-lg border bg-gray-800/50 ${borderColor}`}>
        <div className="flex items-start justify-between">
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
            {scorePercentage !== null && (
                <div className={`text-sm font-bold px-2 py-1 rounded-md ${isCorrect ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                    {scorePercentage}%
                </div>
            )}
        </div>
        
        {isBelowThreshold && (
          <div className="ml-7 mt-3 p-3 rounded-md bg-red-500/10 border border-red-500/30 flex items-center gap-2">
            <RedoIcon className="w-5 h-5 text-red-300 flex-shrink-0" />
            <p className="text-red-200 text-sm">
              Accuracy is below your threshold of {accuracyThreshold}%. Please try the read-back again.
            </p>
          </div>
        )}
        
        {(phraseAnalysis || !isCorrect || (entry.alternatives && entry.alternatives.length > 0)) && (
             <div className="ml-7 mt-2 border-l border-gray-600 pl-4">
                 {phraseAnalysis && phraseAnalysis.length > 0 && (
                     <FeedbackSection title="Phrase-by-Phrase Analysis">
                         <PhraseAnalysisBlock analysis={phraseAnalysis} />
                     </FeedbackSection>
                 )}
                 {entry.alternatives && entry.alternatives.length > 0 && (
                    <FeedbackSection title="Alternative Phraseology">
                        <ul className="space-y-2">
                            {entry.alternatives.map((alt, i) => (
                                <li key={i} className="font-mono bg-gray-900/50 p-2 rounded-md">{alt}</li>
                            ))}
                        </ul>
                    </FeedbackSection>
                 )}
                {!isCorrect && (
                    <>
                        {detailedFeedback && <FeedbackSection title="Details">{detailedFeedback}</FeedbackSection>}
                        {correctPhraseology && <FeedbackSection title="Correct Phraseology" mono>{correctPhraseology}</FeedbackSection>}
                        {commonPitfalls && <FeedbackSection title="Common Pitfalls">{commonPitfalls}</FeedbackSection>}
                        {furtherReading && <FeedbackSection title="Further Reading">{furtherReading}</FeedbackSection>}
                    </>
                )}
            </div>
        )}
      </div>
    );
  };


  return (
    <div className="flex-grow w-full bg-gray-900/70 p-4 rounded-lg overflow-y-auto border border-gray-700 shadow-inner h-64 md:h-auto">
      <div className="space-y-4">
        {log.map((entry, index) => (
          <div key={index} className="flex items-start space-x-3">
            {getIcon(entry.speaker)}
            <div className="flex-1">
              <div className="flex items-center">
                {getLabel(entry.speaker)}
                <ConfidenceIndicator score={entry.confidence} speaker={entry.speaker} />
              </div>
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
        <div ref={endOfLogRef} />
      </div>
    </div>
  );
};

export default ConversationLog;