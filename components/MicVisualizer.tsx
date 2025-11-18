
import React, { useState, useEffect, useRef } from 'react';

const NUM_BARS = 20;

const SquelchVisualizer: React.FC = () => {
    const [barHeights, setBarHeights] = useState<number[]>([]);
    const animationFrameRef = useRef<number>();
  
    useEffect(() => {
        const animate = () => {
          const newHeights = Array.from({ length: NUM_BARS }, () => Math.random() * 0.2 + 0.05); // Small random heights
          setBarHeights(newHeights);
          animationFrameRef.current = requestAnimationFrame(animate);
        };
    
        animationFrameRef.current = requestAnimationFrame(animate);
    
        return () => {
            if (animationFrameRef.current) {
                 cancelAnimationFrame(animationFrameRef.current);
            }
        };
      }, []);
  
    return (
      <div className="flex items-center justify-center space-x-0.5 h-6 w-40" aria-label="Microphone active, squelch on">
        {Array.from({ length: NUM_BARS }).map((_, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-gray-600/50 transition-all duration-100"
            style={{ height: `${(barHeights[i] || 0) * 100}%` }}
          />
        ))}
      </div>
    );
};

const VolumeVisualizer: React.FC<{ volume: number }> = ({ volume }) => {
    // Amplify the raw RMS value for better visual representation
    const level = Math.min(1, volume * 4); 
    const activeBarsCount = Math.ceil(level * NUM_BARS);
  
    return (
      <div className="flex items-center justify-center space-x-0.5 h-6 w-40" aria-label={`Microphone volume level: ${Math.round(level * 100)}%`}>
        {Array.from({ length: NUM_BARS }).map((_, i) => {
          const isActive = i < activeBarsCount;
          let bgColor = 'bg-gray-600/70';
          if (isActive) {
            if (i < NUM_BARS * 0.6) {
              bgColor = 'bg-green-500';
            } else if (i < NUM_BARS * 0.9) {
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

const MicVisualizer: React.FC<{ volume: number, isSquelched: boolean }> = ({ volume, isSquelched }) => {
  return (
    <div className="mb-4">
        {isSquelched ? <SquelchVisualizer /> : <VolumeVisualizer volume={volume} />}
    </div>
  )
};

export default MicVisualizer;