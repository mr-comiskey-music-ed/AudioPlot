import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * AudioPlot mark: an "A" built from a signal path: a source (slate blue), a mic (cream)
 * and an output (rust), with a waveform as the crossbar. Same drawing as /public/favicon.svg.
 */
export const AppLogo: React.FC<AppLogoProps> = ({ className = '', size = 'md' }) => {
  const px = size === 'sm' ? 32 : size === 'lg' ? 48 : 36;
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 32 32"
      className={`shrink-0 ${className}`}
      role="img"
      aria-label="AudioPlot"
    >
      <rect width="32" height="32" rx="7" fill="#140f0a" stroke="rgba(217,164,65,0.4)" strokeWidth="0.75" />
      <path d="M7.925 21.5V9.7a3.2 3.2 0 0 1 3.2 -3.2H12M20 6.5H20.875a3.2 3.2 0 0 1 3.2 3.2V21.5" fill="none" stroke="#d9a441" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.325 16.5H22.675" fill="none" stroke="#8ec5d6" strokeWidth="3" />
      <circle cx="7.925" cy="25.3" r="3.5" fill="#8ec5d6" />
      <circle cx="16" cy="6.5" r="3.5" fill="#efe6d8" />
      <circle cx="24.075" cy="25.3" r="3.5" fill="#d9623b" />
    </svg>
  );
};
