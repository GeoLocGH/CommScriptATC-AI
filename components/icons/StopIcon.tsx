
import React from 'react';

const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M6 6h12v12H6z" />
  </svg>
);

export default StopIcon;
