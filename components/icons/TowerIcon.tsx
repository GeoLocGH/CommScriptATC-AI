
import React from 'react';

const TowerIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M20.57 14.86L18 12.29V7c0-1.1-.9-2-2-2h-2V3c0-1.1-.9-2-2-2s-2 .9-2 2v2H8c-1.1 0-2 .9-2 2v5.29L3.43 14.86c-.37.37-.37.98 0 1.35l8.29 8.29c.37.37.98.37 1.35 0l8.5-8.5c.37-.37.37-.98 0-1.34zM12 21.41L5.59 15H11v-1h2v1h5.41L12 21.41zM16 13h-3v-1h-2v1H8V7h8v6z" />
  </svg>
);

export default TowerIcon;
