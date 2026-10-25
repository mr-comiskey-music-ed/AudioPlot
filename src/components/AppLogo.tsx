import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * AudioPlot mark: a source (blue) and a mic (white) joined by one cable that
 * leaves the mic as a sound wave. Same drawing as /public/favicon.svg.
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
      <path d="M7.5 20.5V12h5" fill="none" stroke="#f97316" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M15.5 15v4.5c0 1.2.8 2 2 2h.5c1.5 0 1.6-4 3.2-4s1.7 4 3.2 4 1.7-4 3.1-4"
        fill="none"
        stroke="#f97316"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="23.5" r="3" fill="#38bdf8" />
      <circle cx="15.5" cy="12" r="3" fill="#e7e5e4" />
    </svg>
  );
};
