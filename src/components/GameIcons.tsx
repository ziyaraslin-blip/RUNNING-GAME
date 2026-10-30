import React from 'react';

/**
 * Bespoke inline SVG Title Lockup for "GHATS OF WAYANAD"
 * Styled in warm Malabar gold (#f4c553), cardamom ivory (#f3efe6), and highland brass.
 */
export const WayanadTitleLockup: React.FC = () => (
  <svg
    viewBox="0 0 520 132"
    className="w-full max-w-[460px] h-auto select-none drop-shadow-[0_6px_20px_rgba(0,0,0,0.65)]"
    role="img"
    aria-label="Ghats of Wayanad — Endless Highland Runner"
  >
    <defs>
      <linearGradient id="brassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffe28a" />
        <stop offset="50%" stopColor="#d4a853" />
        <stop offset="100%" stopColor="#9e7329" />
      </linearGradient>
      <linearGradient id="ivoryGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#dfd6c3" />
      </linearGradient>
    </defs>

    {/* Malabar Gold Coin & Mountain Crest Emblem */}
    <g transform="translate(8, 10)">
      <circle
        cx="30"
        cy="30"
        r="22"
        fill="none"
        stroke="url(#brassGrad)"
        strokeWidth="2.2"
      />
      <circle
        cx="30"
        cy="30"
        r="15"
        fill="none"
        stroke="#d4a853"
        strokeWidth="1.2"
        strokeDasharray="3 3"
      />
      <path
        d="M19 36 L26 22 L31 29 L36 20 L42 36 Z"
        fill="url(#brassGrad)"
        opacity="0.95"
      />
    </g>

    {/* Editorial Kicker */}
    <text
      x="82"
      y="28"
      fill="#e5bc67"
      fontSize="12"
      fontWeight="600"
      letterSpacing="2.2"
      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
    >
      NH-766 Western Ghats · 4D Highway Runner
    </text>

    <line
      x1="82"
      y1="37"
      x2="412"
      y2="37"
      stroke="url(#brassGrad)"
      strokeWidth="1"
      opacity="0.55"
    />

    {/* Main Display Title */}
    <text
      x="80"
      y="84"
      fill="url(#ivoryGrad)"
      fontSize="44"
      fontWeight="700"
      letterSpacing="-0.5"
      style={{ fontFamily: 'Fraunces, Georgia, serif' }}
    >
      Ghats of Wayanad
    </text>

    {/* Winding Hairpin Pass Underline Flourish */}
    <path
      d="M82 99 C 155 99, 175 109, 235 104 C 295 99, 330 110, 448 102"
      fill="none"
      stroke="url(#brassGrad)"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <circle cx="82" cy="99" r="3" fill="#ffe28a" />
    <circle cx="448" cy="102" r="3.5" fill="#ffe28a" />

    <text
      x="82"
      y="123"
      fill="#c4d3ca"
      fontSize="13.5"
      fontWeight="500"
      style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
    >
      Real-Life Churam Route · 4D Time-Shift &amp; Monsoon Chase
    </text>
  </svg>
);

export const IconGoldCoin: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <circle
      cx="10"
      cy="10"
      r="7.5"
      fill="#f5c445"
      stroke="#ffe699"
      strokeWidth="1.4"
    />
    <circle
      cx="10"
      cy="10"
      r="4.5"
      stroke="#9c6b16"
      strokeWidth="1.2"
    />
  </svg>
);

export const IconDistance: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="M4 16L8.2 4H11.8L16 16"
      stroke="#d4a853"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M10 7V9.5M10 12.5V15"
      stroke="#f3efe6"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const IconChrono4d: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <circle
      cx="10"
      cy="10"
      r="7.2"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeDasharray="11 3"
    />
    <path
      d="M10 6.2V10.2L12.8 11.9"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M2.5 10H4.5M15.5 10H17.5"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
);

export const IconMonsterHorn: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="M3 6C3 11 6.2 15.5 10 15.5C13.8 15.5 17 11 17 6L13.5 9.2L10 7.2L6.5 9.2L3 6Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="11.5" r="1" fill="currentColor" />
    <circle cx="12" cy="11.5" r="1" fill="currentColor" />
  </svg>
);

export const IconSound: React.FC<{ muted: boolean; className?: string }> = ({
  muted,
  className = 'w-4 h-4',
}) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path
      d="M3.5 8H6.8L11 4.5V15.5L6.8 12H3.5V8Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    {muted ? (
      <path
        d="M14 7.5L17.5 12.5M17.5 7.5L14 12.5"
        stroke="#ef4444"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    ) : (
      <path
        d="M14 7.2C15.1 8.1 15.6 9 15.6 10C15.6 11 15.1 11.9 14 12.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    )}
  </svg>
);
