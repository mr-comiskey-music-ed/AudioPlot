import React from 'react';

interface StudioIconProps {
  iconType: string;
  className?: string;
  size?: number;
  color?: string;
}

export const StudioIcon: React.FC<StudioIconProps> = ({
  iconType,
  className = '',
  size = 40,
  color = 'currentColor',
}) => {
  switch (iconType) {
    // ==================== INSTRUMENTS ====================
    case 'GuitarElectric':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          <g transform="translate(32 61) scale(1.22) translate(-32 -61)">
          {/* Offset double-cutaway solid body */}
          <path
            d="M27 37C25 32 20 28 17.5 30.5C15.5 32.5 18.5 38 18.5 42C18.5 45 15.5 48 16.5 53C17.5 58 23.5 61 32 61C40.5 61 46.5 58 47.5 53C48.5 48 45.5 45 45.5 42C45.5 39 48 35.5 46.5 33.5C45 31.5 41 33 37.5 37Z"
            fill="#DC2626"
            stroke="#7F1D1D"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {/* Pickguard */}
          <path d="M28 38.5C24.5 40 22 43.5 22.5 47.5C23 51.5 26 54 29.5 54.5L36.5 38.5Z" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="0.6" />
          </g>
          {/* Neck with frets */}
          <rect x="29.6" y="9" width="4.8" height="30" rx="0.6" fill="#E0B070" stroke="#92400E" strokeWidth="0.6" />
          {[13, 17, 21, 25, 29, 33].map((y) => (
            <line key={y} x1="29.8" y1={y} x2="34.2" y2={y} stroke="#A16207" strokeWidth="0.45" />
          ))}
          {/* Six-in-line headstock with tuners */}
          <path d="M29.6 9.5L28.8 3C28.7 1.8 29.8 1 31 1.3L35.8 2.8C36.8 3.1 37 4.3 36.2 5L34.4 9.5Z" fill="#E0B070" stroke="#92400E" strokeWidth="0.6" strokeLinejoin="round" />
          {[2.6, 4.2, 5.8, 7.4].map((y) => (
            <circle key={y} cx="27.4" cy={y} r="0.85" fill="#E2E8F0" stroke="#64748B" strokeWidth="0.3" />
          ))}
          <g transform="translate(32 61) scale(1.22) translate(-32 -61)">
          {/* Three single-coil pickups */}
          {[42, 46.5, 51].map((y) => (
            <rect key={y} x="27.5" y={y} width="9" height="2.3" rx="1.1" fill="#F1F5F9" stroke="#475569" strokeWidth="0.5" />
          ))}
          {/* Bridge */}
          <rect x="28" y="55.2" width="8" height="2.4" rx="0.5" fill="#94A3B8" stroke="#475569" strokeWidth="0.4" />
          {/* Volume & tone knobs */}
          <circle cx="40" cy="50" r="1.4" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.4" />
          <circle cx="41.2" cy="53.6" r="1.4" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="0.4" />
          </g>
          {/* Strings */}
          {[30.8, 32, 33.2].map((x) => (
            <line key={x} x1={x} y1="4" x2={x} y2="56" stroke="#E5E7EB" strokeWidth="0.35" />
          ))}
        </svg>
      );

    case 'GuitarAcoustic':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Acoustic Dreadnought Body */}
          <path
            d="M20 22C16 26 16 32 18 36C15 40 14 48 18 54C22 60 38 60 42 54C46 48 45 40 42 36C44 32 44 26 40 22C36 18 24 18 20 22Z"
            fill="#D97706"
            stroke="#92400E"
            strokeWidth="1.5"
          />
          {/* Soundhole with Rosette Rings */}
          <circle cx="30" cy="32" r="5.5" fill="#18181B" stroke="#FEF3C7" strokeWidth="1" />
          <circle cx="30" cy="32" r="7" fill="none" stroke="#B45309" strokeWidth="0.8" strokeDasharray="1.5 1" />
          {/* Bridge */}
          <rect x="25" y="44" width="10" height="3" rx="1" fill="#451A03" />
          <line x1="27" y1="45" x2="33" y2="45" stroke="#FEF3C7" strokeWidth="1" />
          {/* Neck & Headstock */}
          <rect x="28.5" y="4" width="3" height="18" fill="#B45309" stroke="#78350F" strokeWidth="0.8" />
          <rect x="27.5" y="2" width="5" height="5" rx="1" fill="#78350F" />
          {/* Strings */}
          <line x1="29.5" y1="3" x2="29.5" y2="44" stroke="#FEF3C7" strokeWidth="0.5" />
          <line x1="30.5" y1="3" x2="30.5" y2="44" stroke="#FEF3C7" strokeWidth="0.5" />
        </svg>
      );

    case 'GuitarBass':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          <g transform="translate(32 62) scale(1.22) translate(-32 -62)">
          {/* Offset double-cutaway bass body (longer upper horn) */}
          <path
            d="M27.5 40C26 35 21 29 18 31C15.5 33 18.5 39 18.5 44C18.5 47 15.5 50 16.5 55C17.5 60 24 63 32 63C40 63 46.5 60 47.5 55C48.5 50 45.5 47.5 45.5 44.5C45.5 41.5 48 38 46.5 36C45 34 40.5 36 36.5 40Z"
            fill="#7C3AED"
            stroke="#4C1D95"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {/* Tortoise-style pickguard */}
          <path d="M28.5 41.5C25 43 22.5 46.5 23 50C23.5 53.5 26.5 55.5 29.5 55.5L35.5 41.5Z" fill="#78350F" stroke="#451A03" strokeWidth="0.5" />
          </g>
          {/* Long neck with frets */}
          <rect x="30" y="7" width="4" height="35" rx="0.6" fill="#E0B070" stroke="#92400E" strokeWidth="0.6" />
          {[11, 15.5, 20, 24.5, 29, 33.5, 38].map((y) => (
            <line key={y} x1="30.2" y1={y} x2="33.8" y2={y} stroke="#A16207" strokeWidth="0.45" />
          ))}
          {/* Four-in-line headstock with large tuners */}
          <path d="M30 7.5L29.3 2.2C29.2 1.1 30.2 0.4 31.3 0.6L35.5 1.6C36.5 1.8 36.8 3 36 3.6L34 7.5Z" fill="#E0B070" stroke="#92400E" strokeWidth="0.6" strokeLinejoin="round" />
          {[1.8, 3.4, 5, 6.6].map((y) => (
            <rect key={y} x="26.4" y={y - 0.7} width="2.6" height="1.4" rx="0.5" fill="#E2E8F0" stroke="#64748B" strokeWidth="0.3" />
          ))}
          <g transform="translate(32 62) scale(1.22) translate(-32 -62)">
          {/* Split-coil pickup */}
          <rect x="26.5" y="46" width="5.5" height="2.6" rx="0.8" fill="#0F172A" />
          <rect x="31.5" y="49" width="5.5" height="2.6" rx="0.8" fill="#0F172A" />
          {/* Bridge */}
          <rect x="27.5" y="56" width="9" height="3" rx="0.6" fill="#CBD5E1" stroke="#475569" strokeWidth="0.4" />
          {/* Knobs */}
          <circle cx="40" cy="53" r="1.5" fill="#E2E8F0" stroke="#475569" strokeWidth="0.4" />
          <circle cx="41.3" cy="57" r="1.5" fill="#E2E8F0" stroke="#475569" strokeWidth="0.4" />
          </g>
          {/* Four heavy strings */}
          {[30.9, 31.7, 32.5, 33.3].map((x) => (
            <line key={x} x1={x} y1="2" x2={x} y2="57" stroke="#E5E7EB" strokeWidth="0.45" />
          ))}
        </svg>
      );

    case 'KickDrum':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Kick Drum Shell with Chrome Hoops */}
          <circle cx="32" cy="32" r="24" fill="#0F172A" stroke="#38BDF8" strokeWidth="2.5" />
          {/* Resonance Front Head */}
          <circle cx="32" cy="32" r="21" fill="#1E293B" />
          {/* Kick Port Hole */}
          <circle cx="42" cy="36" r="5" fill="#020617" stroke="#64748B" strokeWidth="1.5" />
          {/* Tuning Tension Lugs */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
            const rad = (angle * Math.PI) / 180;
            const x = 32 + 22.5 * Math.cos(rad);
            const y = 32 + 22.5 * Math.sin(rad);
            return <circle key={i} cx={x} cy={y} r="1.5" fill="#E2E8F0" stroke="#475569" strokeWidth="0.5" />;
          })}
          {/* Kick Drum Floor Spurs */}
          <line x1="14" y1="46" x2="6" y2="58" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="50" y1="46" x2="58" y2="58" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

    case 'SnareDrum':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Snare Metal Shell on Stand */}
          <ellipse cx="32" cy="24" rx="20" ry="10" fill="#E2E8F0" stroke="#475569" strokeWidth="1.5" />
          {/* Drum Batter Head */}
          <ellipse cx="32" cy="24" rx="17" ry="8" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
          {/* Shell Depth */}
          <path d="M12 24V34C12 39.5 21 44 32 44C43 44 52 39.5 52 34V24" fill="#64748B" stroke="#334155" strokeWidth="1.5" />
          {/* Snare Strainer Throw-Off Lever */}
          <rect x="51" y="27" width="4" height="6" rx="1" fill="#CBD5E1" stroke="#334155" strokeWidth="0.8" />
          {/* Snare Stand Basket & Legs */}
          <path d="M32 44V56M32 56L20 62M32 56L44 62" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'TomDrum':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Tom Drum Batter Head & Rim */}
          <ellipse cx="32" cy="22" rx="19" ry="9.5" fill="#E2E8F0" stroke="#1E3A8A" strokeWidth="1.5" />
          <ellipse cx="32" cy="22" rx="16" ry="7.5" fill="#F8FAFC" stroke="#94A3B8" strokeWidth="1" />
          {/* Deep Wood Lacquer Shell */}
          <path d="M13 22V36C13 42 21.5 46.5 32 46.5C42.5 46.5 51 42 51 36V22" fill="#1D4ED8" stroke="#1E3A8A" strokeWidth="1.5" />
          {/* Bottom Rim */}
          <path d="M13 36C13 42 21.5 46.5 32 46.5C42.5 46.5 51 42 51 36" stroke="#94A3B8" strokeWidth="1.5" />
          {/* Chrome Tension Lugs */}
          <rect x="18" y="25" width="2.5" height="12" rx="0.5" fill="#E2E8F0" stroke="#475569" strokeWidth="0.5" />
          <rect x="30.5" y="27" width="2.5" height="13" rx="0.5" fill="#E2E8F0" stroke="#475569" strokeWidth="0.5" />
          <rect x="43" y="25" width="2.5" height="12" rx="0.5" fill="#E2E8F0" stroke="#475569" strokeWidth="0.5" />
          {/* Tom Mount Bracket */}
          <circle cx="32" cy="40" r="2.5" fill="#64748B" stroke="#CBD5E1" strokeWidth="0.5" />
          <line x1="32" y1="42.5" x2="32" y2="58" stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );

     case 'HiHat':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Hi-Hat Stand Rod & Tripod Legs */}
          <line x1="32" y1="22" x2="32" y2="52" stroke="#94A3B8" strokeWidth="2" />
          <line x1="32" y1="52" x2="22" y2="60" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="32" y1="52" x2="42" y2="60" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="32" y1="52" x2="32" y2="60" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round" />
          {/* Pedal Base */}
          <path d="M26 58H38" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
          {/* Hi-Hat Clutch & Top Rod */}
          <rect x="31" y="14" width="2" height="10" fill="#CBD5E1" />
          {/* Top Hi-Hat Cymbal */}
          <ellipse cx="32" cy="24" rx="16" ry="5" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
          <ellipse cx="32" cy="23" rx="5" ry="1.8" fill="#FEF08A" stroke="#B45309" strokeWidth="0.6" />
          {/* Bottom Hi-Hat Cymbal */}
          <ellipse cx="32" cy="28" rx="16" ry="4.5" fill="#D97706" stroke="#92400E" strokeWidth="1" />
        </svg>
      );

    case 'DrumCymbals':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* 1. HI-HAT CYMBALS & STAND (Left) */}
          {/* Hi-Hat Stand Rod & Tripod Legs */}
          <line x1="16" y1="18" x2="16" y2="52" stroke="#94A3B8" strokeWidth="1.5" />
          <line x1="16" y1="52" x2="9" y2="60" stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="16" y1="52" x2="23" y2="60" stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="16" y1="52" x2="16" y2="60" stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" />
          {/* Hi-Hat Clutch & Top Rod */}
          <rect x="15" y="14" width="2" height="6" fill="#CBD5E1" />
          {/* Top Hi-Hat Cymbal (Slightly tilted) */}
          <ellipse cx="16" cy="22" rx="10" ry="3.2" fill="#F59E0B" stroke="#B45309" strokeWidth="0.8" />
          <ellipse cx="16" cy="21.5" rx="3" ry="1.2" fill="#FDE68A" />
          {/* Bottom Hi-Hat Cymbal */}
          <ellipse cx="16" cy="24" rx="10" ry="3" fill="#D97706" stroke="#92400E" strokeWidth="0.8" />

          {/* 2. CRASH CYMBAL (Center-Left / Higher Boom) */}
          <line x1="32" y1="10" x2="32" y2="50" stroke="#94A3B8" strokeWidth="1.5" />
          <line x1="32" y1="50" x2="26" y2="59" stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="32" y1="50" x2="38" y2="59" stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" />
          {/* Crash Cymbal Disc */}
          <ellipse cx="32" cy="12" rx="13" ry="4" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
          <ellipse cx="32" cy="11.5" rx="4" ry="1.5" fill="#FEF08A" stroke="#B45309" strokeWidth="0.6" />
          <rect x="31" y="8" width="2" height="3" fill="#475569" />

          {/* 3. RIDE CYMBAL (Right / Heavy Bronze) */}
          <line x1="48" y1="16" x2="48" y2="50" stroke="#94A3B8" strokeWidth="1.5" />
          <line x1="48" y1="50" x2="42" y2="59" stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="48" y1="50" x2="54" y2="59" stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" />
          {/* Ride Cymbal Disc (Large with distinct bell) */}
          <ellipse cx="48" cy="18" rx="14" ry="4.5" fill="#D97706" stroke="#B45309" strokeWidth="1" />
          <ellipse cx="48" cy="17.2" rx="5" ry="2" fill="#FBBF24" stroke="#78350F" strokeWidth="0.8" />
          <rect x="47" y="14" width="2" height="3" fill="#475569" />

          {/* Overhead Stereo Bracket Guide Line */}
          <path d="M12 6 H52" stroke="#38BDF8" strokeWidth="0.8" strokeDasharray="2 1.5" opacity="0.7" />
          <circle cx="12" cy="6" r="1.5" fill="#38BDF8" />
          <circle cx="52" cy="6" r="1.5" fill="#38BDF8" />
        </svg>
      );

    case 'StudioHeadphones':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Cushioned Headband Arc */}
          <path
            d="M14 34C14 18 20 10 32 10C44 10 50 18 50 34"
            stroke="#0284C7"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <path
            d="M18 26C18 16 23 12 32 12C41 12 46 16 46 26"
            stroke="#38BDF8"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.8"
          />
          {/* Left Earcup */}
          <rect x="9" y="30" width="10" height="20" rx="5" fill="#0F172A" stroke="#0284C7" strokeWidth="2" />
          <rect x="11" y="32" width="6" height="16" rx="3" fill="#38BDF8" opacity="0.8" />
          {/* Right Earcup */}
          <rect x="45" y="30" width="10" height="20" rx="5" fill="#0F172A" stroke="#0284C7" strokeWidth="2" />
          <rect x="47" y="32" width="6" height="16" rx="3" fill="#38BDF8" opacity="0.8" />
          {/* Coiled Audio Cable from Left Cup */}
          <path
            d="M14 50C14 55 18 56 18 59C18 62 22 62 26 62"
            stroke="#64748B"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      );

    case 'DrumKit':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Center Bass Drum */}
          <circle cx="32" cy="38" r="14" fill="#1E293B" stroke="#2563EB" strokeWidth="2" />
          <circle cx="32" cy="38" r="12" fill="#0F172A" />
          <circle cx="36" cy="40" r="3" fill="#020617" stroke="#64748B" strokeWidth="1" />
          {/* Snare (Left) */}
          <ellipse cx="18" cy="34" rx="8" ry="4.5" fill="#E2E8F0" stroke="#475569" strokeWidth="1" />
          {/* High Tom (Left-Center) */}
          <ellipse cx="26" cy="20" rx="6" ry="3.5" fill="#2563EB" stroke="#1D4ED8" strokeWidth="1" />
          {/* Mid Tom (Right-Center) */}
          <ellipse cx="38" cy="20" rx="6.5" ry="3.5" fill="#2563EB" stroke="#1D4ED8" strokeWidth="1" />
          {/* Floor Tom (Right) */}
          <ellipse cx="46" cy="36" rx="8.5" ry="5" fill="#1E40AF" stroke="#1E3A8A" strokeWidth="1" />
          {/* Hi-Hat Cymbals */}
          <ellipse cx="12" cy="22" rx="7" ry="2.5" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />
          <line x1="12" y1="22" x2="12" y2="48" stroke="#94A3B8" strokeWidth="1.5" />
          {/* Crash / Ride Cymbal */}
          <ellipse cx="50" cy="14" rx="10" ry="3" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
          <line x1="50" y1="14" x2="50" y2="46" stroke="#94A3B8" strokeWidth="1.5" />
        </svg>
      );

    case 'GrandPiano':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Grand piano seen from above: straight bass side, curved treble side, keyboard at the front */}
          <path
            d="M13 50V9C13 5.5 15.5 3 19 3C24 3 27 7 29 13C31.5 20.5 37 24 44 27.5C49.5 30.3 52 35 52 41V50Z"
            fill="#111827"
            stroke="#475569"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          {/* Golden soundboard inside the open lid */}
          <path
            d="M16 47V10.5C16 8 17.5 6.5 19.5 6.5C22.5 6.5 24.5 9.5 26 14.5C28.5 22.5 34.5 26.5 42 30.5C46.5 32.8 49 36.5 49 41V47Z"
            fill="#B45309"
            stroke="#78350F"
            strokeWidth="0.6"
          />
          {/* Cast-iron plate & strings */}
          {[18, 21, 24, 27, 30, 33, 36, 39, 42, 45].map((x, i) => (
            <line key={x} x1={x} y1="46" x2={x - 1 + i * 0.2} y2={Math.max(10, 12 + i * 2.6)} stroke="#FCD34D" strokeWidth="0.4" opacity="0.8" />
          ))}
          <path d="M17 44H48" stroke="#78350F" strokeWidth="1.2" />
          {/* Keyboard */}
          <rect x="12" y="50" width="41" height="7" rx="0.8" fill="#F8FAFC" stroke="#1F2937" strokeWidth="0.8" />
          {Array.from({ length: 14 }, (_, i) => 12 + (i + 1) * (41 / 15)).map((x) => (
            <line key={x} x1={x} y1="50" x2={x} y2="57" stroke="#CBD5E1" strokeWidth="0.3" />
          ))}
          {[0, 1, 3, 4, 5, 7, 8, 10, 11, 12].map((k) => (
            <rect key={k} x={12 + (k + 1) * (41 / 15) - 0.8} y="50" width="1.6" height="4" fill="#111827" />
          ))}
          {/* Bench */}
          <rect x="22" y="59.5" width="21" height="3.5" rx="1" fill="#1F2937" stroke="#475569" strokeWidth="0.6" />
        </svg>
      );

    case 'Piano':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Synthesizer Enclosure */}
          <rect x="6" y="16" width="52" height="32" rx="3" fill="#1E293B" stroke="#475569" strokeWidth="1.5" />
          {/* Control Panel / Display Screen */}
          <rect x="10" y="20" width="14" height="6" rx="1" fill="#0284C7" opacity="0.8" />
          <circle cx="28" cy="23" r="1.5" fill="#E2E8F0" />
          <circle cx="33" cy="23" r="1.5" fill="#E2E8F0" />
          <circle cx="38" cy="23" r="1.5" fill="#E2E8F0" />
          {/* Pitch Bend / Mod Wheels */}
          <rect x="8" y="30" width="2.5" height="6" rx="0.5" fill="#0F172A" />
          <rect x="11.5" y="30" width="2.5" height="6" rx="0.5" fill="#0F172A" />
          {/* Keybed */}
          <rect x="16" y="28" width="38" height="16" rx="1" fill="#F8FAFC" stroke="#0F172A" strokeWidth="1" />
          {/* Black Keys */}
          {[19, 23, 29, 33, 37, 43, 47].map((x, i) => (
            <rect key={i} x={x} y="28" width="2.5" height="9" fill="#0F172A" />
          ))}
        </svg>
      );

    case 'Violin':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Wooden Violin Body with C-Bouts */}
          <path
            d="M24 18C20 22 20 26 24 30C21 33 21 37 24 40C20 44 20 50 26 54C32 58 36 58 40 54C46 50 46 44 42 40C45 37 45 33 42 30C46 26 46 22 42 18C38 14 28 14 24 18Z"
            fill="#D97706"
            stroke="#78350F"
            strokeWidth="1.5"
          />
          {/* F-Holes */}
          <path d="M27 30C28 32 28 36 27 38" stroke="#451A03" strokeWidth="1" strokeLinecap="round" />
          <path d="M39 30C38 32 38 36 39 38" stroke="#451A03" strokeWidth="1" strokeLinecap="round" />
          {/* Fingerboard & Scroll */}
          <rect x="31.5" y="6" width="3" height="26" fill="#1C1917" />
          <circle cx="33" cy="5" r="2.5" fill="#78350F" stroke="#451A03" strokeWidth="1" />
          {/* Bridge & Tailpiece */}
          <rect x="30" y="37" width="6" height="1.5" fill="#FEF3C7" />
          <polygon points="31,44 35,44 33,52" fill="#1C1917" />
        </svg>
      );

    case 'Cello':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Cello Resonant Wooden Body with Deep Bouts */}
          <path
            d="M23 16C18 20 18 26 23 30C19 33 19 39 23 42C17 47 17 54 24 58C30 61 34 61 40 58C47 54 47 47 41 42C45 39 45 33 41 30C46 26 46 20 41 16C36 12 28 12 23 16Z"
            fill="#B45309"
            stroke="#78350F"
            strokeWidth="1.5"
          />
          {/* Inner Highlight / Varnish Glow */}
          <path
            d="M25 18C21 22 21 25 24 29C22 32 22 38 24 41C20 45 20 52 26 55C31 57 33 57 38 55C44 52 44 45 40 41C42 38 42 32 40 29C43 25 43 22 39 18C35 15 29 15 25 18Z"
            fill="#D97706"
            opacity="0.5"
          />
          {/* F-Holes */}
          <path d="M26 31C28 33 28 37 26 40" stroke="#451A03" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M38 31C36 33 36 37 38 40" stroke="#451A03" strokeWidth="1.2" strokeLinecap="round" />
          {/* Long Fingerboard & Pegbox/Scroll */}
          <rect x="30.5" y="4" width="3.5" height="30" fill="#1C1917" />
          <circle cx="32.2" cy="3.5" r="2.8" fill="#78350F" stroke="#451A03" strokeWidth="1" />
          <line x1="28" y1="4" x2="36.5" y2="4" stroke="#CBD5E1" strokeWidth="0.8" />
          {/* Wooden Bridge */}
          <rect x="29" y="38" width="6.5" height="2" rx="0.5" fill="#FEF3C7" stroke="#92400E" strokeWidth="0.5" />
          {/* Ebony Tailpiece */}
          <polygon points="30,46 34.5,46 32.2,56" fill="#18181B" />
          {/* Steel Endpin Spike */}
          <line x1="32.2" y1="58" x2="32.2" y2="63" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'DoubleBass':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Sloping Upright Double Bass Shoulders & Deep Resonator Body */}
          <path
            d="M24 14C17 19 16 26 22 31C16 35 16 42 21 46C15 51 15 57 23 60C30 63 34 63 41 60C49 57 49 51 43 46C48 42 48 35 42 31C48 26 47 19 40 14C35 10 29 10 24 14Z"
            fill="#78350F"
            stroke="#451A03"
            strokeWidth="1.5"
          />
          {/* Warm Dark Amber Wood Layer */}
          <path
            d="M26 16C20 20 19 25 24 30C19 34 19 40 23 44C18 48 18 54 25 57C31 59 33 59 39 57C46 54 46 48 41 44C45 40 45 34 40 30C45 25 44 20 38 16C34 13 30 13 26 16Z"
            fill="#92400E"
            opacity="0.6"
          />
          {/* Prominent F-Holes */}
          <path d="M25 32C27 34 27 39 25 42" stroke="#1C1917" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M39 32C37 34 37 39 39 42" stroke="#1C1917" strokeWidth="1.5" strokeLinecap="round" />
          {/* Heavy Neck & Pegbox with Large Brass Tuning Machines */}
          <rect x="30" y="2" width="4" height="34" fill="#1C1917" />
          <circle cx="32" cy="2" r="3" fill="#451A03" stroke="#292524" strokeWidth="1" />
          <circle cx="27" cy="3" r="1.2" fill="#F59E0B" />
          <circle cx="37" cy="3" r="1.2" fill="#F59E0B" />
          {/* Heavy Bass Bridge */}
          <rect x="28" y="41" width="8" height="2.5" rx="0.5" fill="#FEF3C7" stroke="#78350F" strokeWidth="0.8" />
          {/* Heavy Tailpiece */}
          <polygon points="29,48 35,48 32,58" fill="#0F172A" />
          {/* 4 Heavy Steel Strings */}
          <line x1="30.5" y1="2" x2="30.5" y2="48" stroke="#E2E8F0" strokeWidth="0.6" />
          <line x1="31.5" y1="2" x2="31.5" y2="48" stroke="#E2E8F0" strokeWidth="0.6" />
          <line x1="32.5" y1="2" x2="32.5" y2="48" stroke="#E2E8F0" strokeWidth="0.6" />
          <line x1="33.5" y1="2" x2="33.5" y2="48" stroke="#E2E8F0" strokeWidth="0.6" />
          {/* Floor Endpin Peg */}
          <line x1="32" y1="60" x2="32" y2="63.5" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    case 'Trumpet':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Brass Main Tubing */}
          <path d="M8 32H44M8 36H44" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
          {/* Flared Bell */}
          <path d="M44 30L56 22V46L44 38Z" fill="#FBBF24" stroke="#D97706" strokeWidth="1.5" />
          {/* 3 Valves and Finger Buttons */}
          <rect x="24" y="24" width="3" height="16" rx="0.5" fill="#FEF3C7" stroke="#B45309" strokeWidth="0.8" />
          <rect x="29" y="24" width="3" height="16" rx="0.5" fill="#FEF3C7" stroke="#B45309" strokeWidth="0.8" />
          <rect x="34" y="24" width="3" height="16" rx="0.5" fill="#FEF3C7" stroke="#B45309" strokeWidth="0.8" />
          {/* Mouthpiece */}
          <path d="M6 31H8V37H6Z" fill="#CBD5E1" stroke="#64748B" strokeWidth="0.5" />
        </svg>
      );

    case 'Saxophone':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          <defs>
            <linearGradient id="saxBrass" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          {/* Mouthpiece & neck */}
          <path d="M10 8.5L15.5 7.6L16 10.6L10.6 11.4Z" fill="#111827" stroke="#374151" strokeWidth="0.5" />
          <path d="M15.8 9.1C20 8.2 23.6 9 24.6 13" stroke="url(#saxBrass)" strokeWidth="2.8" strokeLinecap="round" />
          {/* Main body tube, bow and rising bell section (gets wider toward the bell) */}
          <path d="M24.6 13L23.4 44C23 51 26.5 56.5 32.5 56.5C38.5 56.5 42 52.5 42 46.5L42.5 40" stroke="#B45309" strokeWidth="7.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M24.6 13L23.4 44C23 51 26.5 56.5 32.5 56.5C38.5 56.5 42 52.5 42 46.5L42.5 40" stroke="url(#saxBrass)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          {/* Flared bell */}
          <path d="M38.8 42L35.5 27.5H52L46.3 42Z" fill="url(#saxBrass)" stroke="#B45309" strokeWidth="0.9" strokeLinejoin="round" />
          <ellipse cx="43.75" cy="27.5" rx="8.5" ry="2.6" fill="#78350F" stroke="#FDE68A" strokeWidth="1.1" />
          {/* Pearl key touches along the body */}
          {[18, 23, 28, 33, 38].map((y, i) => (
            <circle key={y} cx={25.6 - i * 0.25} cy={y} r="1.6" fill="#FEF3C7" stroke="#92400E" strokeWidth="0.5" />
          ))}
          {/* Key rod */}
          <line x1="27.6" y1="17" x2="26.6" y2="40" stroke="#FEF3C7" strokeWidth="0.6" />
          {/* Low key cups on the bow */}
          <circle cx="33" cy="54.5" r="1.4" fill="#D97706" stroke="#FEF3C7" strokeWidth="0.5" />
          <circle cx="39" cy="50" r="1.4" fill="#D97706" stroke="#FEF3C7" strokeWidth="0.5" />
        </svg>
      );

    case 'Flute':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          <defs>
            <linearGradient id="fluteMetalGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="35%" stopColor="#E2E8F0" />
              <stop offset="70%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>
          </defs>
          {/* Main Silver Cylindrical Tube (Angled Transverse Position) */}
          <g transform="rotate(-15 32 32)">
            {/* Crown / End Cap (Left) */}
            <rect x="4" y="29.5" width="3" height="5" rx="1" fill="#CBD5E1" stroke="#475569" strokeWidth="0.6" />
            {/* Headjoint Tube */}
            <rect x="7" y="30" width="14" height="4" fill="url(#fluteMetalGrad)" stroke="#475569" strokeWidth="0.8" />
            {/* Lip Plate & Embouchure Hole */}
            <rect x="11" y="28.5" width="5.5" height="7" rx="1.5" fill="#F1F5F9" stroke="#64748B" strokeWidth="0.6" />
            <ellipse cx="13.7" cy="32" rx="1.4" ry="1.1" fill="#0F172A" stroke="#334155" strokeWidth="0.5" />
            {/* Tenon Joint Ring */}
            <rect x="21" y="29.5" width="1.5" height="5" fill="#E2E8F0" stroke="#475569" strokeWidth="0.5" />
            {/* Body Tube */}
            <rect x="22.5" y="30" width="26" height="4" fill="url(#fluteMetalGrad)" stroke="#475569" strokeWidth="0.8" />
            {/* Steel Mechanism Rod */}
            <line x1="24" y1="29.2" x2="57" y2="29.2" stroke="#CBD5E1" strokeWidth="1" />
            {/* French Open-Hole Key Cups & Posts */}
            {[26, 30, 34, 38, 42, 46].map((x, i) => (
              <g key={i}>
                <line x1={x + 1.5} y1="29.2" x2={x + 1.5} y2="30" stroke="#64748B" strokeWidth="0.8" />
                <circle cx={x + 1.5} cy="32" r="1.8" fill="#F8FAFC" stroke="#475569" strokeWidth="0.7" />
                <circle cx={x + 1.5} cy="32" r="0.7" fill="#64748B" />
              </g>
            ))}
            {/* Footjoint Tenon Ring */}
            <rect x="48.5" y="29.5" width="1.5" height="5" fill="#E2E8F0" stroke="#475569" strokeWidth="0.5" />
            {/* Footjoint Tube & Keys */}
            <rect x="50" y="30" width="10" height="4" fill="url(#fluteMetalGrad)" stroke="#475569" strokeWidth="0.8" />
            <circle cx="53" cy="32" r="1.6" fill="#F8FAFC" stroke="#475569" strokeWidth="0.7" />
            <circle cx="57" cy="32" r="1.6" fill="#F8FAFC" stroke="#475569" strokeWidth="0.7" />
          </g>
        </svg>
      );

    case 'Choir':
      return (
        <svg width={size * 1.8} height={size} viewBox="0 0 115 64" fill="none" className={className}>
          {/* Tiered Choral Risers */}
          <rect x="6" y="28" width="103" height="8" rx="2" fill="#312E81" opacity="0.6" stroke="#4338CA" strokeWidth="0.8" />
          <rect x="12" y="44" width="91" height="8" rx="2" fill="#1E1B4B" opacity="0.8" stroke="#3730A3" strokeWidth="0.8" />

          {/* BACK ROW SINGERS (Higher Riser, 5 vocalists) */}
          {[16, 36, 57, 78, 98].map((cx, i) => (
            <g key={`back-${i}`} opacity="0.85">
              {/* Head */}
              <circle cx={cx} cy={14} r="5.5" fill="#A78BFA" stroke="#6D28D9" strokeWidth="0.8" />
              {/* Robe / Body */}
              <path
                d={`M${cx - 7} 32 C${cx - 7} 23 ${cx - 5} 21 ${cx} 21 C${cx + 5} 21 ${cx + 7} 23 ${cx + 7} 32 Z`}
                fill="#4C1D95"
                stroke="#6D28D9"
                strokeWidth="0.8"
              />
            </g>
          ))}

          {/* FRONT ROW SINGERS (Lower Riser, 4 vocalists with open choral folders) */}
          {[26, 47, 68, 88].map((cx, i) => (
            <g key={`front-${i}`}>
              {/* Head */}
              <circle cx={cx} cy={27} r="6" fill="#C4B5FD" stroke="#7C3AED" strokeWidth="1" />
              {/* Robe / Body */}
              <path
                d={`M${cx - 8} 52 C${cx - 8} 39 ${cx - 6} 36 ${cx} 36 C${cx + 6} 36 ${cx + 8} 39 ${cx + 8} 52 Z`}
                fill="#5B21B6"
                stroke="#7C3AED"
                strokeWidth="1"
              />
              {/* Choral Octavo Sheet Music Folder */}
              <polygon points={`${cx - 5},45 ${cx},43 ${cx + 5},45 ${cx + 4},51 ${cx},49 ${cx - 4},51`} fill="#EDE9FE" stroke="#6D28D9" strokeWidth="0.6" />
            </g>
          ))}

          {/* Harmonized Vocal Acoustic Waves overhead */}
          <path d="M14 6 C24 2 34 2 44 6" stroke="#DDD6FE" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
          <path d="M48 5 C58 1 68 1 78 5" stroke="#DDD6FE" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
          <path d="M82 6 C92 2 102 2 108 6" stroke="#DDD6FE" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        </svg>
      );

    case 'Mic':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Singer / Vocalist Profile with Sound Radiance */}
          <circle cx="26" cy="22" r="10" fill="#F43F5E" opacity="0.8" />
          <path d="M12 50C12 40 20 36 26 36C32 36 40 40 40 50" fill="#E11D48" />
          {/* Vocal Waves */}
          <path d="M42 20C46 22 46 28 42 30" stroke="#FDA4AF" strokeWidth="2" strokeLinecap="round" />
          <path d="M47 16C53 19 53 31 47 34" stroke="#FDA4AF" strokeWidth="2" strokeLinecap="round" />
          <path d="M52 12C60 16 60 34 52 38" stroke="#FDA4AF" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );

    // ==================== AMPLIFIERS & DI ====================
    case 'GuitarAmp':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Tolex Cabinet Outer Shell */}
          <rect x="6" y="10" width="52" height="44" rx="4" fill="#1C1917" stroke="#44403C" strokeWidth="2" />
          {/* Metal Corner Protectors */}
          <rect x="6" y="10" width="5" height="5" fill="#94A3B8" />
          <rect x="53" y="10" width="5" height="5" fill="#94A3B8" />
          <rect x="6" y="49" width="5" height="5" fill="#94A3B8" />
          <rect x="53" y="49" width="5" height="5" fill="#94A3B8" />
          {/* Top Control Faceplate */}
          <rect x="10" y="14" width="44" height="8" fill="#F59E0B" />
          {/* Control Knobs & Red Jewel Pilot Lamp */}
          <circle cx="16" cy="18" r="1.5" fill="#1C1917" />
          <circle cx="21" cy="18" r="1.5" fill="#1C1917" />
          <circle cx="26" cy="18" r="1.5" fill="#1C1917" />
          <circle cx="31" cy="18" r="1.5" fill="#1C1917" />
          {/* 1/4" Input Jack */}
          <circle cx="38" cy="18" r="1.8" fill="#38BDF8" stroke="#0F172A" strokeWidth="0.8" />
          {/* Red Jewel Power Lamp */}
          <circle cx="48" cy="18" r="1.5" fill="#EF4444" className="animate-pulse" />
          {/* Vintage Textured Speaker Grille Cloth */}
          <rect x="10" y="24" width="44" height="26" fill="#78350F" />
          {/* Grille Fabric Weave Lines */}
          <line x1="10" y1="30" x2="54" y2="30" stroke="#92400E" strokeWidth="0.8" strokeDasharray="2 2" />
          <line x1="10" y1="36" x2="54" y2="36" stroke="#92400E" strokeWidth="0.8" strokeDasharray="2 2" />
          <line x1="10" y1="42" x2="54" y2="42" stroke="#92400E" strokeWidth="0.8" strokeDasharray="2 2" />
          {/* 12" Speaker Cone Outline Behind Grille */}
          <circle cx="32" cy="37" r="9" fill="none" stroke="#451A03" strokeWidth="1.5" />
          <circle cx="32" cy="37" r="3" fill="#451A03" />
        </svg>
      );

    case 'BassAmp':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Heavy Bass Cabinet Stack */}
          <rect x="6" y="8" width="52" height="48" rx="3" fill="#0F172A" stroke="#334155" strokeWidth="2" />
          {/* 4x10 Speaker Grille with 4 Speakers */}
          <rect x="10" y="12" width="44" height="40" fill="#1E293B" />
          {/* 4 Heavy Bass Woofers */}
          <circle cx="21" cy="22" r="7" fill="#0F172A" stroke="#475569" strokeWidth="1" />
          <circle cx="21" cy="22" r="2.5" fill="#64748B" />
          <circle cx="43" cy="22" r="7" fill="#0F172A" stroke="#475569" strokeWidth="1" />
          <circle cx="43" cy="22" r="2.5" fill="#64748B" />
          <circle cx="21" cy="42" r="7" fill="#0F172A" stroke="#475569" strokeWidth="1" />
          <circle cx="21" cy="42" r="2.5" fill="#64748B" />
          <circle cx="43" cy="42" r="7" fill="#0F172A" stroke="#475569" strokeWidth="1" />
          <circle cx="43" cy="42" r="2.5" fill="#64748B" />
          {/* 1/4" Input Jack */}
          <circle cx="15" cy="15" r="1.5" fill="#38BDF8" />
        </svg>
      );

    case 'DIBox':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Metal Stompbox Chassis */}
          <rect x="8" y="14" width="48" height="36" rx="4" fill="#059669" stroke="#047857" strokeWidth="2" />
          {/* 1/4" Instrument Input Jack (Left) */}
          <circle cx="16" cy="32" r="4.5" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.5" />
          <circle cx="16" cy="32" r="2" fill="#0284C7" />
          {/* XLR Balanced Output Jack (Right) */}
          <circle cx="48" cy="32" r="6" fill="#1E293B" stroke="#F97316" strokeWidth="1.5" />
          <circle cx="46" cy="30" r="1" fill="#FEF08A" />
          <circle cx="50" cy="30" r="1" fill="#FEF08A" />
          <circle cx="48" cy="35" r="1" fill="#FEF08A" />
          {/* Ground Lift Toggle Switch */}
          <rect x="28" y="26" width="8" height="12" rx="2" fill="#1E293B" />
          <circle cx="32" cy="30" r="2" fill="#E2E8F0" />
        </svg>
      );

    // ==================== MICROPHONES ====================
    case 'MicSM58':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          <defs>
            {/* Mesh Pattern for SM58 Ball Grille */}
            <pattern id="sm58-mesh" width="3" height="3" patternUnits="userSpaceOnUse">
              <path d="M0 1.5L1.5 0L3 1.5L1.5 3Z" fill="none" stroke="#CBD5E1" strokeWidth="0.5" />
            </pattern>
            {/* Chrome Shading Gradient */}
            <linearGradient id="sm58-grille-grad" x1="20" y1="8" x2="44" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="25%" stopColor="#E2E8F0" />
              <stop offset="65%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            {/* Tapered Dark Matte Enamel Handle Gradient */}
            <linearGradient id="sm58-body-grad" x1="24" y1="28" x2="40" y2="28" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="35%" stopColor="#334155" />
              <stop offset="70%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </defs>

          {/* Handheld Tapered Die-Cast Zinc Handle Body */}
          <path d="M26 27L28.5 54H35.5L38 27Z" fill="url(#sm58-body-grad)" stroke="#0F172A" strokeWidth="1" />

          {/* Shure Brand Collar Band Ring */}
          <rect x="25.5" y="24" width="13" height="3" rx="0.5" fill="#E2E8F0" stroke="#475569" strokeWidth="0.6" />

          {/* Iconic Spherical Ball Mesh Grille */}
          <circle cx="32" cy="15" r="11" fill="url(#sm58-grille-grad)" stroke="#475569" strokeWidth="1" />
          <circle cx="32" cy="15" r="11" fill="url(#sm58-mesh)" />

          {/* Center Collision Rib / Ring on Grille */}
          <ellipse cx="32" cy="15" rx="11" ry="3" fill="#94A3B8" stroke="#E2E8F0" strokeWidth="1" fillOpacity="0.4" />
          <line x1="21" y1="15" x2="43" y2="15" stroke="#FFFFFF" strokeWidth="0.8" />

          {/* XLR Bottom Connector Base */}
          <rect x="28.5" y="54" width="7" height="4" rx="0.5" fill="#020617" stroke="#334155" strokeWidth="0.6" />
          {/* 3 Gold Pins in Base */}
          <circle cx="30.5" cy="56" r="0.6" fill="#FBBF24" />
          <circle cx="33.5" cy="56" r="0.6" fill="#FBBF24" />
          <circle cx="32" cy="57" r="0.6" fill="#FBBF24" />
        </svg>
      );

    case 'MicSM57':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          <defs>
            {/* Tapered Dark Matte Enamel Handle Gradient */}
            <linearGradient id="sm57-body-grad" x1="25" y1="24" x2="39" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E293B" />
              <stop offset="35%" stopColor="#334155" />
              <stop offset="70%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            {/* Rotating Plastic Grille Gradient */}
            <linearGradient id="sm57-grille-grad" x1="26" y1="7" x2="38" y2="7" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0F172A" />
              <stop offset="40%" stopColor="#334155" />
              <stop offset="70%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>

          {/* Slender Tapered Die-Cast Zinc Body */}
          <path d="M26.5 22L29 54H35L37.5 22Z" fill="url(#sm57-body-grad)" stroke="#0F172A" strokeWidth="1" />

          {/* Silver/White SHURE SM57 Brand Ring */}
          <rect x="26" y="19" width="12" height="3" rx="0.5" fill="#E2E8F0" stroke="#475569" strokeWidth="0.6" />

          {/* Cylindrical Rotating Polycarbonate Grille Basket */}
          <rect x="25.5" y="7" width="13" height="12" rx="1.5" fill="url(#sm57-grille-grad)" stroke="#475569" strokeWidth="0.8" />

          {/* Flat Top Cap */}
          <rect x="25.5" y="7" width="13" height="2" rx="0.5" fill="#0F172A" stroke="#334155" strokeWidth="0.5" />

          {/* Fine Longitudinal Intake Slits on Rotating Grille */}
          <line x1="28" y1="9" x2="28" y2="18" stroke="#94A3B8" strokeWidth="0.9" strokeLinecap="round" />
          <line x1="30.5" y1="9" x2="30.5" y2="18" stroke="#CBD5E1" strokeWidth="0.9" strokeLinecap="round" />
          <line x1="33.5" y1="9" x2="33.5" y2="18" stroke="#CBD5E1" strokeWidth="0.9" strokeLinecap="round" />
          <line x1="36" y1="9" x2="36" y2="18" stroke="#94A3B8" strokeWidth="0.9" strokeLinecap="round" />

          {/* XLR Base Connector */}
          <rect x="29" y="54" width="6" height="4" rx="0.5" fill="#020617" stroke="#334155" strokeWidth="0.6" />
          {/* 3 Gold Pins in Base */}
          <circle cx="30.5" cy="56" r="0.6" fill="#FBBF24" />
          <circle cx="33.5" cy="56" r="0.6" fill="#FBBF24" />
          <circle cx="32" cy="57" r="0.6" fill="#FBBF24" />
        </svg>
      );

    case 'MicBeta52':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Shure Blue/Enamel Metallic Egg Shell Body */}
          <ellipse cx="32" cy="26" rx="14" ry="12" fill="#1E293B" stroke="#2563EB" strokeWidth="1.5" />
          {/* Heavy Steel Mesh Grille Front */}
          <path d="M18 26C18 18 25 14 32 14C39 14 46 18 46 26" fill="#94A3B8" stroke="#CBD5E1" strokeWidth="1.5" />
          {/* Built-in Stand Pivot Mount & XLR connector */}
          <rect x="27" y="38" width="10" height="12" rx="2" fill="#0F172A" stroke="#334155" strokeWidth="1" />
          <circle cx="32" cy="44" r="2.5" fill="#64748B" />
          {/* XLR Base */}
          <rect x="29" y="50" width="6" height="6" fill="#020617" />
        </svg>
      );

    case 'MicE604':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          <g transform="rotate(-90 32 32)">
            {/* Sennheiser e604 Drum Rim Clip & Compact Mic Body */}
            {/* Drum Hoop Rim Representation */}
            <path d="M8 50C14 50 18 47 24 44" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
            
            {/* MZH 604 Drum Rim Clamp Bracket */}
            <path
              d="M12 46C12 40 16 36 22 36L25 36C25 40 21 44 19 49L13 51C12 50 12 48 12 46Z"
              fill="#1E293B"
              stroke="#475569"
              strokeWidth="1.2"
            />
            {/* Knurled Thumb Screw on clamp */}
            <rect x="8" y="47" width="5" height="7" rx="1.5" fill="#334155" stroke="#64748B" strokeWidth="0.8" />
            <line x1="9" y1="49" x2="12" y2="49" stroke="#94A3B8" strokeWidth="0.6" />
            <line x1="9" y1="52" x2="12" y2="52" stroke="#94A3B8" strokeWidth="0.6" />
            
            {/* Swivel Pivot Arm */}
            <circle cx="23" cy="38" r="3" fill="#0F172A" stroke="#475569" strokeWidth="1" />
            <circle cx="23" cy="38" r="1.2" fill="#94A3B8" />

            {/* Main Angled Mic Capsule Body */}
            <g transform="rotate(-18 36 32)">
              {/* Tapered Barrel */}
              <path
                d="M30 20L42 20C43 20 44 21 44 23L42 42C42 44 40 45 38 45L34 45C32 45 30 44 30 42L28 23C28 21 29 20 30 20Z"
                fill="#18181B"
                stroke="#52525B"
                strokeWidth="1.2"
              />
              {/* Silver / Wire Mesh Front Grille Dome */}
              <path
                d="M29 20C29 14 43 14 43 20Z"
                fill="#3F3F46"
                stroke="#A1A1AA"
                strokeWidth="1.2"
              />
              {/* Mesh pattern lines */}
              <line x1="31" y1="16" x2="41" y2="16" stroke="#D4D4D8" strokeWidth="0.75" />
              <line x1="33" y1="18" x2="39" y2="18" stroke="#D4D4D8" strokeWidth="0.75" />
              <line x1="36" y1="14" x2="36" y2="20" stroke="#D4D4D8" strokeWidth="0.75" />
              
              {/* Blue / Silver Brand Ring Accent */}
              <rect x="28.5" y="20.5" width="15" height="1.5" fill="#38BDF8" />
              
              {/* Side sound-ventilation ports */}
              <line x1="31" y1="24" x2="41" y2="24" stroke="#27272A" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="31.5" y1="27" x2="40.5" y2="27" stroke="#27272A" strokeWidth="1.2" strokeLinecap="round" />
              
              {/* Sennheiser "e604" model badge */}
              <rect x="32" y="32" width="8" height="4.5" rx="0.75" fill="#09090B" stroke="#3F3F46" strokeWidth="0.5" />
              
              {/* XLR Output Connector Base */}
              <path d="M33 45L39 45L38 51L34 51Z" fill="#09090B" stroke="#3F3F46" strokeWidth="0.8" />
              <circle cx="35" cy="48" r="0.6" fill="#A1A1AA" />
              <circle cx="37" cy="48" r="0.6" fill="#A1A1AA" />
              <circle cx="36" cy="49.5" r="0.6" fill="#A1A1AA" />
            </g>
          </g>
        </svg>
      );

    case 'MicC214':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Studio Large Diaphragm Rectangular Body */}
          <rect x="22" y="10" width="20" height="34" rx="4" fill="#1E293B" stroke="#38BDF8" strokeWidth="1.5" />
          {/* Gold/Black Upper Mesh Grille */}
          <rect x="24" y="12" width="16" height="16" rx="2" fill="#CA8A04" opacity="0.8" stroke="#FBBF24" strokeWidth="1" />
          {/* 1" Condenser Gold Sputtered Capsule Center */}
          <circle cx="32" cy="20" r="5" fill="#FEF08A" stroke="#A16207" strokeWidth="1" />
          {/* Pad & Low Cut Switches */}
          <rect x="25" y="32" width="5" height="2" fill="#64748B" />
          <rect x="34" y="32" width="5" height="2" fill="#64748B" />
          {/* Bottom Threaded Base */}
          <rect x="28" y="44" width="8" height="12" fill="#0F172A" stroke="#334155" strokeWidth="1" />
        </svg>
      );

    case 'MicAT2035':
    case 'MicAT2020':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Matte Black Studio Condenser Body */}
          <rect x="23" y="12" width="18" height="38" rx="4" fill="#0F172A" stroke="#475569" strokeWidth="1.5" />
          {/* Wire Mesh Basket Top */}
          <rect x="24" y="14" width="16" height="16" rx="3" fill="#334155" stroke="#64748B" strokeWidth="1" />
          <circle cx="32" cy="22" r="4.5" fill="#1E293B" stroke="#94A3B8" strokeWidth="0.8" />
          {/* Audio-Technica Backplate Logo */}
          <circle cx="32" cy="38" r="2.5" fill="#E2E8F0" />
          {/* Base */}
          <rect x="27" y="50" width="10" height="6" fill="#020617" />
        </svg>
      );

    case 'MicSM81':
    case 'MicADX51':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Small Diaphragm Pencil Condenser Body */}
          <rect x="28" y="10" width="8" height="44" rx="1.5" fill="#CBD5E1" stroke="#475569" strokeWidth="1.5" />
          {/* Capsule End Cap with Side Vents */}
          <rect x="28" y="8" width="8" height="8" rx="1" fill="#475569" stroke="#1E293B" strokeWidth="1" />
          <line x1="28" y1="12" x2="36" y2="12" stroke="#94A3B8" strokeWidth="0.8" />
          {/* Attenuator & Low Cut Ring */}
          <rect x="28" y="24" width="8" height="4" fill="#64748B" />
          {/* XLR Base */}
          <rect x="29" y="54" width="6" height="4" fill="#1E293B" />
        </svg>
      );

    // ==================== ACCESSORIES & MONITORS ====================
    case 'MicStand':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Tripod Base Legs */}
          <path d="M32 46L14 60M32 46L50 60M32 46L32 62" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
          {/* Vertical Shaft with Clutch */}
          <line x1="32" y1="18" x2="32" y2="46" stroke="#94A3B8" strokeWidth="2.5" />
          <rect x="30" y="30" width="4" height="5" rx="1" fill="#1E293B" />
          {/* Adjustable Boom Arm */}
          <line x1="16" y1="12" x2="48" y2="24" stroke="#CBD5E1" strokeWidth="2" />
          <circle cx="32" cy="18" r="3" fill="#1E293B" stroke="#64748B" strokeWidth="1" />
          <rect x="14" y="10" width="4" height="4" rx="1" fill="#475569" />
        </svg>
      );

    case 'PopFilter':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Dual Mesh Ring Pop Shield */}
          <circle cx="32" cy="24" r="16" fill="#10B981" opacity="0.2" stroke="#10B981" strokeWidth="2" />
          <circle cx="32" cy="24" r="13" fill="none" stroke="#34D399" strokeWidth="1" strokeDasharray="2 2" />
          {/* Flexible Gooseneck */}
          <path d="M32 40C32 46 22 46 22 52V60" fill="none" stroke="#64748B" strokeWidth="3" strokeLinecap="round" />
          {/* Stand Clamp */}
          <rect x="18" y="56" width="8" height="6" rx="1" fill="#1E293B" stroke="#475569" strokeWidth="1" />
        </svg>
      );

    case 'StageMonitor':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Angled Wedge Enclosure */}
          <polygon points="8,54 56,54 48,20 16,20" fill="#1E293B" stroke="#475569" strokeWidth="2" />
          {/* Angled Speaker Face */}
          <polygon points="12,50 52,50 45,24 19,24" fill="#0F172A" />
          {/* Coaxial Speaker Cone */}
          <circle cx="32" cy="37" r="9" fill="#1E293B" stroke="#64748B" strokeWidth="1" />
          <circle cx="32" cy="37" r="3.5" fill="#F59E0B" />
        </svg>
      );

    case 'IEMTransmitter':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Half-Rack Metal Chassis */}
          <rect x="6" y="16" width="52" height="32" rx="3" fill="#1E1B4B" stroke="#4338CA" strokeWidth="2" />
          {/* Rack Mount Ear Screws */}
          <circle cx="9" cy="20" r="1.5" fill="#64748B" />
          <circle cx="9" cy="44" r="1.5" fill="#64748B" />
          <circle cx="55" cy="20" r="1.5" fill="#64748B" />
          <circle cx="55" cy="44" r="1.5" fill="#64748B" />
          {/* Front LCD Frequency / Audio Display */}
          <rect x="14" y="22" width="22" height="14" rx="1.5" fill="#0369A1" stroke="#0284C7" strokeWidth="1" />
          <rect x="16" y="32" width="4" height="2" fill="#22C55E" />
          <rect x="21" y="32" width="4" height="2" fill="#22C55E" />
          <rect x="26" y="32" width="4" height="2" fill="#EAB308" />
          <rect x="31" y="32" width="3" height="2" fill="#EF4444" />
          {/* Rotary Level Knob */}
          <circle cx="42" cy="28" r="4.5" fill="#0F172A" stroke="#818CF8" strokeWidth="1.2" />
          <line x1="42" y1="28" x2="42" y2="25" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
          {/* Power Button / Status LED */}
          <circle cx="42" cy="40" r="2" fill="#10B981" />
          {/* Rear / Top Antenna (Angled) */}
          <line x1="50" y1="16" x2="56" y2="4" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" />
          <circle cx="56" cy="4" r="1.5" fill="#A5B4FC" />
        </svg>
      );

    case 'IEMBodypack':
    case 'IEM':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* IEM Wireless Bodypack Receiver */}
          <rect x="16" y="18" width="32" height="40" rx="4" fill="#312E81" stroke="#6366F1" strokeWidth="2" />
          {/* Flexible RF Antenna */}
          <line x1="22" y1="18" x2="22" y2="4" stroke="#818CF8" strokeWidth="2.5" strokeLinecap="round" />
          {/* Volume Wheel on top */}
          <rect x="38" y="14" width="7" height="4" rx="1" fill="#0F172A" stroke="#6366F1" strokeWidth="1" />
          {/* Backlit Display */}
          <rect x="21" y="24" width="22" height="10" rx="1.5" fill="#0284C7" stroke="#38BDF8" strokeWidth="0.8" />
          {/* Battery Status Indicator & LEDs */}
          <rect x="22" y="38" width="10" height="4" rx="1" fill="#065F46" />
          <circle cx="40" cy="40" r="2" fill="#22C55E" />
          {/* Belt Clip Outline */}
          <path d="M20 54H44" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
          {/* High-Fi In-Ear Molded Earpieces */}
          <circle cx="48" cy="10" r="3" fill="#E0E7FF" stroke="#6366F1" strokeWidth="1.2" />
          <path d="M48 13C48 16 42 16 42 14" stroke="#818CF8" strokeWidth="1" strokeLinecap="round" />
        </svg>
      );

    case 'PASpeaker':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          {/* Heavy 2-Way PA Cabinet */}
          <rect x="12" y="6" width="40" height="52" rx="3" fill="#020617" stroke="#334155" strokeWidth="2" />
          {/* High Frequency Horn */}
          <polygon points="20,12 44,12 40,24 24,24" fill="#0F172A" stroke="#64748B" strokeWidth="1" />
          {/* 15" Main Low Woofer */}
          <circle cx="32" cy="38" r="11" fill="#0F172A" stroke="#475569" strokeWidth="1.5" />
          <circle cx="32" cy="38" r="4" fill="#1E293B" />
          {/* Power LED */}
          <circle cx="32" cy="53" r="1.5" fill="#3B82F6" />
        </svg>
      );

    // ==================== CABLE CONNECTORS ====================
    case 'QuarterInchPlug':
      return (
        <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className}>
          <defs>
            <linearGradient id="ts-tip-grad" x1="2" y1="20" x2="14" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="40%" stopColor="#CBD5E1" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>
            <linearGradient id="ts-barrel-grad" x1="22" y1="13" x2="22" y2="27" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="30%" stopColor="#1E293B" />
              <stop offset="70%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
          </defs>
          {/* Bullet Nose Tip with Detent Ring Groove */}
          <path d="M4 20C4 18 6 17 8 17L12 18.5V21.5L8 23C6 23 4 22 4 20Z" fill="url(#ts-tip-grad)" stroke="#475569" strokeWidth="0.6" />
          {/* Black Phenolic Insulator Band */}
          <rect x="12" y="18" width="1.5" height="4" fill="#020617" />
          {/* Nickel Sleeve Cylinder */}
          <rect x="13.5" y="17.5" width="9.5" height="5" fill="#E2E8F0" stroke="#64748B" strokeWidth="0.5" />
          <line x1="13.5" y1="19" x2="23" y2="19" stroke="#FFFFFF" strokeWidth="0.6" />

          {/* Knurled Nickel / Gunmetal Grip Body */}
          <rect x="23" y="14" width="9" height="12" rx="1.5" fill="url(#ts-barrel-grad)" stroke="#64748B" strokeWidth="0.8" />
          {/* Diamond knurling grip ribs */}
          <line x1="25.5" y1="14.5" x2="25.5" y2="25.5" stroke="#94A3B8" strokeWidth="0.6" strokeDasharray="1 1" />
          <line x1="27.5" y1="14.5" x2="27.5" y2="25.5" stroke="#94A3B8" strokeWidth="0.6" strokeDasharray="1 1" />
          <line x1="29.5" y1="14.5" x2="29.5" y2="25.5" stroke="#94A3B8" strokeWidth="0.6" strokeDasharray="1 1" />

          {/* Stepped Tapered Rubber Strain Relief Boot */}
          <path d="M32 16L36 17.5V22.5L32 24Z" fill="#0F172A" stroke="#334155" strokeWidth="0.6" />
          {/* Blue High-Purity Copper Instrument Cable */}
          <path d="M36 20H40" stroke="#38BDF8" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );

    case 'XlrConnector':
      return (
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" className={className}>
          <defs>
            {/* Satin Silver Metal Barrel Gradient */}
            <linearGradient id="xlr-barrel-satin" x1="18" y1="46" x2="40" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#CBD5E1" />
              <stop offset="25%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#94A3B8" />
              <stop offset="85%" stopColor="#475569" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>

            {/* Polished Chrome Clamp Collar Gradient */}
            <linearGradient id="xlr-clamp-chrome" x1="38" y1="26" x2="48" y2="16" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="35%" stopColor="#FFFFFF" />
              <stop offset="70%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#1E293B" />
            </linearGradient>

            {/* Rubber Boot Gradient */}
            <linearGradient id="xlr-boot-grad" x1="44" y1="18" x2="60" y2="4" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="40%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>

            {/* Front Bevel Shadow */}
            <radialGradient id="xlr-socket-depth" cx="17" cy="46" r="10" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#020617" />
              <stop offset="80%" stopColor="#0F172A" />
              <stop offset="100%" stopColor="#1E293B" />
            </radialGradient>
          </defs>

          {/* 1. Black Tapered Rubber Strain Relief Boot at Rear (Top-Right) */}
          <path
            d="M40 18 L55 5 C57 3.5 60 5.5 61 7 L50 24 Z"
            fill="url(#xlr-boot-grad)"
            stroke="#1E293B"
            strokeWidth="0.8"
          />
          {/* Boot segmented ribs */}
          <line x1="45" y1="14" x2="48" y2="17" stroke="#475569" strokeWidth="0.8" />
          <line x1="49" y1="10.5" x2="52" y2="13.5" stroke="#475569" strokeWidth="0.8" />
          <line x1="53" y1="7" x2="56" y2="10" stroke="#475569" strokeWidth="0.8" />

          {/* 2. Chrome Split-Collar Cable Clamp */}
          <path
            d="M36 21.5 C36 17.5 41 13 46 17 L47.5 19 C48.5 22 43.5 27 38 24.5 Z"
            fill="url(#xlr-clamp-chrome)"
            stroke="#475569"
            strokeWidth="0.8"
          />
          {/* Top Clamp Machine Screw with Philips Cross */}
          <circle cx="37.5" cy="16.5" r="2.8" fill="#E2E8F0" stroke="#334155" strokeWidth="0.6" />
          <line x1="36" y1="16.5" x2="39" y2="16.5" stroke="#1E293B" strokeWidth="0.7" />
          <line x1="37.5" y1="15" x2="37.5" y2="18" stroke="#1E293B" strokeWidth="0.7" />

          {/* Bottom/Side Clamp Machine Screw */}
          <circle cx="46.5" cy="24.5" r="2.8" fill="#E2E8F0" stroke="#334155" strokeWidth="0.6" />
          <line x1="45" y1="24.5" x2="48" y2="24.5" stroke="#1E293B" strokeWidth="0.7" />
          <line x1="46.5" y1="23" x2="46.5" y2="26" stroke="#1E293B" strokeWidth="0.7" />

          {/* 3. Main Satin Silver Die-Cast Barrel Cylinder */}
          <path
            d="M9 41.5 L36 17.5 C38 16 43 18.5 45 22 L20 48.5 C16 52 11 50 9 47.5 Z"
            fill="url(#xlr-barrel-satin)"
            stroke="#475569"
            strokeWidth="1"
          />

          {/* Raised Curved Grip Ridges on Rear Barrel */}
          <g stroke="#E2E8F0" strokeWidth="1" opacity="0.9" strokeLinecap="round">
            <path d="M29 23 C31.5 21 34.5 21.5 37 23.5" />
            <path d="M31 21 C33.5 19 36.5 19.5 39 21.5" />
            <path d="M33 19 C35.5 17 38.5 17.5 41 19.5" />
            <path d="M35 17 C37.5 15 40.5 15.5 43 17.5" />
          </g>
          {/* Shadow behind ribs */}
          <g stroke="#334155" strokeWidth="0.6" opacity="0.6" strokeLinecap="round">
            <path d="M29.5 24 C32 22 35 22.5 37.5 24.5" />
            <path d="M31.5 22 C34 20 37 20.5 39.5 22.5" />
            <path d="M33.5 20 C36 18 39 18.5 41.5 20.5" />
            <path d="M35.5 18 C38 16 41 16.5 43.5 18.5" />
          </g>

          {/* Recessed Philips Head Set Screw on Barrel Body */}
          <circle cx="28" cy="30" r="2.8" fill="#CBD5E1" stroke="#334155" strokeWidth="0.6" />
          <circle cx="28" cy="30" r="2.1" fill="#94A3B8" />
          <line x1="26.5" y1="28.5" x2="29.5" y2="31.5" stroke="#0F172A" strokeWidth="0.8" />
          <line x1="29.5" y1="28.5" x2="26.5" y2="31.5" stroke="#0F172A" strokeWidth="0.8" />

          {/* Engraved Alignment Arrow on Lower Front Shell */}
          <path
            d="M18.5 38.5 L21.5 35.5 M20 37 L17.5 39.5 L17 36"
            stroke="#94A3B8"
            strokeWidth="0.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 4. Circular Front Nose Opening & Black Pin Cavity */}
          {/* Outer Rim Lip */}
          <ellipse
            cx="14"
            cy="46"
            rx="8.5"
            ry="11"
            transform="rotate(-38 14 46)"
            fill="#64748B"
            stroke="#94A3B8"
            strokeWidth="1.2"
          />
          {/* Deep Dark Socket Interior */}
          <ellipse
            cx="14"
            cy="46"
            rx="7"
            ry="9.5"
            transform="rotate(-38 14 46)"
            fill="url(#xlr-socket-depth)"
          />

          {/* 5. Three Solid Silver/Chrome XLR Contact Pins (Male Configuration) */}
          {/* Top Pin (Pin 1 - Ground) */}
          <circle cx="12" cy="42" r="1.6" fill="#F1F5F9" stroke="#334155" strokeWidth="0.5" />
          <circle cx="11.6" cy="41.6" r="0.5" fill="#FFFFFF" />

          {/* Bottom Left Pin (Pin 2 - Hot / Signal+) */}
          <circle cx="14" cy="50" r="1.6" fill="#F1F5F9" stroke="#334155" strokeWidth="0.5" />
          <circle cx="13.6" cy="49.6" r="0.5" fill="#FFFFFF" />

          {/* Bottom Right Pin (Pin 3 - Cold / Signal-) */}
          <circle cx="18" cy="47" r="1.6" fill="#F1F5F9" stroke="#334155" strokeWidth="0.5" />
          <circle cx="17.6" cy="46.6" r="0.5" fill="#FFFFFF" />
        </svg>
      );

    default:
      return (
        <div
          style={{ width: size, height: size, backgroundColor: color + '22', color }}
          className={`rounded-xl flex items-center justify-center font-bold text-xs ${className}`}
        >
          {iconType.slice(0, 3)}
        </div>
      );
  }
};
