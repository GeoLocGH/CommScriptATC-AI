
import React from 'react';

const MicVisualizer: React.FC<{ volume: number }> = ({ volume }) => {
  const numBars = 20;
  // Amplify the raw RMS value for better visual representation
  const level = Math.min(1, volume * 4); 
  const activeBarsCount = Math.ceil(level * numBars);

  return (
    <div className="flex items-center justify-center space-x-0.5 h-6 w-40 mb-4" aria-label={`Microphone volume level: ${Math.round(level * 100)}%`}>
      {Array.from({ length: numBars }).map((_, i) => {
        const isActive = i < activeBarsCount;
        let bgColor = 'bg-gray-600/70';
        if (isActive) {
          if (i < numBars * 0.6) {
            bgColor = 'bg-green-500';
          } else if (i < numBars * 0.9) {
            bgColor = 'bg-yellow-400';
          } else {
            bgColor = 'bg-red-500';
          }
        }
        
        return (
          <div
            key={i}
            className={`w-1.5 h-full rounded-full transition-colors duration-100 ${bgColor}`}
          />
        );
      })}
    </div>
  );
};

export default MicVisualizer;
