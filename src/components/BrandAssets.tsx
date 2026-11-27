import React from 'react';

export function BankEmblem({
  institution,
  size = 'md',
}: {
  institution: string;
  size?: 'sm' | 'md';
}) {
  const lower = institution.toLowerCase();
  const dim = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-8 h-8 text-xs';

  if (lower.includes('nu')) {
    return (
      <span
        aria-hidden="true"
        className={`${dim} rounded-xs bg-[#6D28D9] text-white font-editorial font-extrabold flex items-center justify-center shrink-0`}
      >
        Nu
      </span>
    );
  }
  if (lower.includes('inter')) {
    return (
      <span
        aria-hidden="true"
        className={`${dim} rounded-xs bg-[#EA580C] text-white font-editorial font-extrabold flex items-center justify-center shrink-0`}
      >
        in
      </span>
    );
  }
  if (lower.includes('santander')) {
    return (
      <span
        aria-hidden="true"
        className={`${dim} rounded-xs bg-[#C83E2B] text-white font-editorial font-extrabold flex items-center justify-center shrink-0`}
      >
        S
      </span>
    );
  }
  if (lower.includes('itaú') || lower.includes('itau')) {
    return (
      <span
        aria-hidden="true"
        className={`${dim} rounded-xs bg-[#0B130F] text-[#8CE02C] font-editorial font-extrabold flex items-center justify-center shrink-0`}
      >
        i
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${dim} rounded-xs bg-[#111110] dark:bg-[#F5F5F2] text-white dark:text-[#09090B] font-editorial font-extrabold flex items-center justify-center shrink-0`}
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
        rx="3"
        fill="rgba(255,255,255,0.12)"
        stroke="rgba(255,255,255,0.32)"
        strokeWidth="1.2"
      />
      <path
        d="M1 10H13M23 10H35M1 18H13M23 18H35M13 1V27M23 1V27"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth="1"
      />
    </svg>
  );
}

/**
 * Crisp SVG Radial Gauge Ring for savings ratio, housing 30% benchmark, and goal progress.
 */
export function CircularGaugeSvg({
  valuePct,
  size = 54,
  strokeWidth = 4,
  trackColor = 'rgba(17,17,16,0.1)',
  fillColor = '#65C91D',
  label,
  sublabel,
  labelClassName = 'text-[#111110] dark:text-[#F5F5F2]',
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
          strokeLinecap="butt"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
          {label && (
            <span className={`font-display-num text-xs font-bold tabular-nums ${labelClassName}`}>
              {label}
            </span>
          )}
          {sublabel && (
            <span className="text-[8px] uppercase tracking-wider opacity-65 mt-0.5">{sublabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Bespoke Tapioca Pay architectural vault illustration for pending connections or empty lists.
 */
export function EmptyStateVaultIllustration({ className = 'w-16 h-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 80" fill="none" className={className} aria-hidden="true">
      <rect
        x="8"
        y="16"
        width="64"
        height="48"
        rx="3"
        className="fill-[#F3F3EF] dark:fill-[#161619]"
      />
      <rect
        x="16"
        y="24"
        width="48"
        height="32"
        rx="2"
        className="fill-white dark:fill-[#111113] stroke-[#111110]/20 dark:stroke-[#8CE02C]/35"
        strokeWidth="1.5"
      />
      <circle
        cx="40"
        cy="40"
        r="10"
        className="fill-[#65C91D]/15 dark:fill-[#8CE02C]/15 stroke-[#56AD17] dark:stroke-[#8CE02C]"
        strokeWidth="1.8"
      />
      <path
        d="M36.5 40L39 42.5L44 37.5"
        className="stroke-[#56AD17] dark:stroke-[#8CE02C]"
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}
