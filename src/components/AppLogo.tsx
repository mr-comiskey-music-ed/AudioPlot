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
      <path d="M6.8 21.6V6.8h5" fill="none" stroke="#f97316" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M15.5 10.3v8.2c0 1.6 1 2.6 2.3 2.6c1.6 0 1.7-6 3.4-6s1.8 6 3.4 6 1.7-6 2.9-6"
        fill="none"
        stroke="#f97316"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="6.8" cy="25.1" r="3.5" fill="#38bdf8" />
      <circle cx="15.5" cy="6.8" r="3.5" fill="#e7e5e4" />
    </svg>
  );
};
