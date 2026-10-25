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
      <path d="M6.5 21.5V6.5h5.5M19.5 6.5h6v15" fill="none" stroke="#f97316" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6.5 18.5c1.6 0 1.6-2.6 3.2-2.6s1.6 2.6 3.2 2.6 1.6-2.6 3.1-2.6 1.6 2.6 3.2 2.6 1.6-2.6 3.2-2.6 1.6 2.6 3.1 2.6"
        fill="none"
        stroke="#f97316"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="6.5" cy="25.3" r="3.5" fill="#38bdf8" />
      <circle cx="16" cy="6.5" r="3.5" fill="#e7e5e4" />
      <circle cx="25.5" cy="25.3" r="3.5" fill="#f97316" />
    </svg>
  );
};
