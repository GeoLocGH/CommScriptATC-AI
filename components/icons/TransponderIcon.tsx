
import React from 'react';

const TransponderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 8V4M12 20v-4"/>
    <path d="M4 12H2M22 12h-2"/>
    <path d="M18.36 18.36l-1.41-1.41M7.05 7.05 5.64 5.64"/>
    <path d="M18.36 5.64l-1.41 1.41M7.05 16.95l-1.41 1.41"/>
    <circle cx="12" cy="12" r="2"/>
  </svg>
);

export default TransponderIcon;
