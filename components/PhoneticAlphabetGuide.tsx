import React from 'react';

interface PhoneticAlphabetGuideProps {
  onClose: () => void;
}

const ALPHABET = {
  A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo',
  F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett',
  K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar',
  P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
  U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee',
  Z: 'Zulu'
};

const PhoneticAlphabetGuide: React.FC<PhoneticAlphabetGuideProps> = ({ onClose }) => {
  return (
    <div 
        className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={onClose}
    >
      <div 
        className="w-full max-w-md bg-gray-800 rounded-lg shadow-2xl border border-gray-700 p-6"
        onClick={e => e.stopPropagation()} // Prevent clicks inside from closing the modal
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">ICAO Phonetic Alphabet</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl" title="Close">&times;</button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-gray-300">
          {Object.entries(ALPHABET).map(([letter, word]) => (
            <div key={letter} className="flex items-center space-x-3">
              <span className="font-bold text-cyan-400">{letter}</span>
              <span>-</span>
              <span>{word}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PhoneticAlphabetGuide;
