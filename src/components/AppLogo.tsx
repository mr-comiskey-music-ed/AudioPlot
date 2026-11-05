import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * AudioPlot mark: an "A" built from a signal path: a source (blue), a mic (white)
 * and an output (orange), with a waveform as the crossbar. Same drawing as /public/favicon.svg.
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
      <rect width="32" height="32" rx="7" fill="#17151a" stroke="rgba(249,115,22,0.35)" strokeWidth="0.75" />
      <path d="M7.925 21.5V9.7a3.2 3.2 0 0 1 3.2 -3.2H12M20 6.5H20.875a3.2 3.2 0 0 1 3.2 3.2V21.5" fill="none" stroke="#f97316" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.125 16.5H22.875" fill="none" stroke="#38bdf8" strokeWidth="2.6" />
      <circle cx="7.925" cy="25.3" r="3.5" fill="#38bdf8" />
      <circle cx="16" cy="6.5" r="3.5" fill="#e7e5e4" />
      <circle cx="24.075" cy="25.3" r="3.5" fill="#f97316" />
    </svg>
  );
};
