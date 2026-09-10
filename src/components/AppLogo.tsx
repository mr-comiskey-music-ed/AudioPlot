import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AppLogo: React.FC<AppLogoProps> = ({ className = '', size = 'md' }) => {
  const dimensions = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-12 h-12' : 'w-9 h-9';
  const iconSize = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-9 h-9' : 'w-7 h-7';

  return (
    <div className={`relative flex items-center justify-center rounded-md bg-gradient-to-br from-stone-900 via-stone-900 to-stone-950 border border-orange-500/40 shadow-lg shadow-orange-500/20 overflow-hidden shrink-0 ${dimensions} ${className}`}>
      {/* Subtle grid pattern background representing a stage/studio plot */}
      <div className="absolute inset-0 bg-[radial-gradient(#f97316_1px,transparent_1px)] [background-size:6px_6px] opacity-15" />
      <div className="absolute inset-0 bg-gradient-to-tr from-orange-500/10 via-transparent to-blue-500/15" />

      {/* Signal Flow Equipment Plot SVG */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${iconSize} relative z-10`}
      >
        {/* Orthogonal Signal Patch Cables */}
        <path d="M 3 18.5 V 7.5 H 5" className="stroke-orange-400/80" strokeWidth="1.25" strokeDasharray="1.5 1.5" />
        <path d="M 12 15 V 20.5 H 19" className="stroke-blue-400/80" strokeWidth="1.25" />

        {/* Equipment Box 1: Left Source Node (Orange - Lower Corner) */}
        <rect x="1" y="18.5" width="4" height="4" rx="1" className="fill-orange-500/25 stroke-orange-400" strokeWidth="1.25" />
        <circle cx="3" cy="20.5" r="0.9" className="fill-orange-400" />

        {/* Equipment Box 2: Center Processing Node with Triangle Wave */}
        <rect x="5" y="0.75" width="14" height="14.25" rx="2.5" className="fill-blue-500/30 stroke-blue-400" strokeWidth="1.5" />
        <path
          d="M 6.8 7.9 L 9.4 4.2 L 14.6 11.6 L 17.2 7.9"
          className="stroke-blue-100"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Equipment Box 3: Right Output Node (Orange - Lower Corner) */}
        <rect x="19" y="18.5" width="4" height="4" rx="1" className="fill-orange-500/25 stroke-orange-400" strokeWidth="1.25" />
        <path d="M 20.5 20.5 H 22" className="stroke-orange-400" strokeWidth="1.25" />
      </svg>
    </div>
  );
};
