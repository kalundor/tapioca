import React from 'react';

export function BankEmblem({
  institution,
  size = 'md',
}: {
  institution: string;
  size?: 'sm' | 'md';
}) {
  const lower = institution.toLowerCase();
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';

  if (lower.includes('nu')) {
    return (
      <span
        aria-hidden="true"
        className={`${dim} rounded-xl bg-gradient-to-br from-[#820AD1] to-[#4C057A] text-white font-editorial font-extrabold flex items-center justify-center shrink-0 shadow-xs`}
      >
        Nu
      </span>
    );
  }
  if (lower.includes('inter')) {
    return (
      <span
        aria-hidden="true"
        className={`${dim} rounded-xl bg-gradient-to-br from-[#FF7A00] to-[#C84E00] text-white font-editorial font-extrabold flex items-center justify-center shrink-0 shadow-xs`}
      >
        in
      </span>
    );
  }
  if (lower.includes('santander')) {
    return (
      <span
        aria-hidden="true"
        className={`${dim} rounded-xl bg-gradient-to-br from-[#EC0000] to-[#9E0000] text-white font-editorial font-extrabold flex items-center justify-center shrink-0 shadow-xs`}
      >
        S
      </span>
    );
  }
  if (lower.includes('itaú') || lower.includes('itau')) {
    return (
      <span
        aria-hidden="true"
        className={`${dim} rounded-xl bg-gradient-to-br from-[#FF6200] to-[#003399] text-white font-editorial font-extrabold flex items-center justify-center shrink-0 shadow-xs`}
      >
        i
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${dim} rounded-xl bg-[#0B130F] text-[#8CE02C] font-editorial font-extrabold flex items-center justify-center shrink-0 shadow-xs`}
    >
      TP
    </span>
  );
}

/**
 * Geometric metallic EMV chip SVG for connected Pluggy bank/credit cards.
 */
export function CardChipSvg({ className = 'w-6 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 28" fill="none" className={className} aria-hidden="true">
      <rect
        x="1"
        y="1"
        width="34"
        height="26"
        rx="5"
        fill="rgba(255,255,255,0.18)"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.2"
      />
      <path
        d="M1 10H13M23 10H35M1 18H13M23 18H35M13 1V27M23 1V27"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1"
      />
    </svg>
  );
}

/**
 * Faceted vector polygon prism overlay inspired by Onyx Bank card craftsmanship.
 */
export function OnyxCardFacetSvg({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 220 130"
      fill="none"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 w-full h-full ${className}`}
      aria-hidden="true"
    >
      <polygon points="120,0 220,0 220,90 152,48" fill="rgba(255,255,255,0.11)" />
      <polygon points="152,48 220,90 184,130 112,86" fill="rgba(255,255,255,0.06)" />
      <polygon points="88,0 120,0 152,48 96,42" fill="rgba(255,255,255,0.05)" />
      <line x1="120" y1="0" x2="152" y2="48" stroke="rgba(255,255,255,0.16)" strokeWidth="0.8" />
      <line x1="152" y1="48" x2="220" y2="90" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />
    </svg>
  );
}

/**
 * Crisp SVG Radial Gauge Ring for savings ratio, housing 30% benchmark, and goal progress.
 */
export function CircularGaugeSvg({
  valuePct,
  size = 54,
  strokeWidth = 5,
  trackColor = 'rgba(255,255,255,0.14)',
  fillColor = '#8CE02C',
  label,
  sublabel,
  labelClassName = 'text-white',
}: {
  valuePct: number;
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  fillColor?: string;
  label?: string;
  sublabel?: string;
  labelClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, valuePct));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c - (clamped / 100) * c;

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={fillColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
          {label && (
            <span className={`font-display-num text-[11px] font-bold ${labelClassName}`}>
              {label}
            </span>
          )}
          {sublabel && (
            <span className="text-[8px] opacity-75 mt-0.5">{sublabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Bespoke Tapioca Pay empty-state architectural illustration for pending connections or empty lists.
 */
export function EmptyStateVaultIllustration({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <rect
        x="8"
        y="16"
        width="64"
        height="48"
        rx="14"
        className="fill-[#F1F3F2] dark:fill-[#111714]"
      />
      <rect
        x="16"
        y="24"
        width="48"
        height="32"
        rx="10"
        className="fill-white dark:fill-[#0D1210] stroke-[#0B110E]/15 dark:stroke-[#8CE02C]/30"
        strokeWidth="1.5"
      />
      <circle
        cx="40"
        cy="40"
        r="10"
        className="fill-[#65C91D]/18 stroke-[#56AD17] dark:stroke-[#8CE02C]"
        strokeWidth="2"
      />
      <path
        d="M36.5 40L39 42.5L44 37.5"
        className="stroke-[#0B110E] dark:stroke-[#8CE02C]"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
