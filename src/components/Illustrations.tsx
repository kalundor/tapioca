import React from 'react';

export function WalletIllustration() {
  return (
    <svg viewBox="0 0 110 100" className="w-20 h-20 shrink-0 select-none" aria-hidden="true">
      <defs>
        <linearGradient id="walletBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="50%" stopColor="#1F2937" />
          <stop offset="100%" stopColor="#111827" />
        </linearGradient>
        <linearGradient id="billGreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
        <linearGradient id="billGreenDark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>
      </defs>
      {/* Soft shadow */}
      <ellipse cx="56" cy="88" rx="34" ry="7" fill="rgba(15, 23, 42, 0.14)" />
      {/* Back banknote */}
      <g transform="rotate(-10 52 30)">
        <rect x="28" y="10" width="48" height="28" rx="4" fill="url(#billGreenDark)" />
        <rect x="31" y="13" width="42" height="22" rx="2" fill="none" stroke="#86EFAC" strokeWidth="1" strokeDasharray="2 2" />
      </g>
      {/* Front banknote with 100 */}
      <g transform="rotate(-4 58 34)">
        <rect x="32" y="14" width="50" height="30" rx="4" fill="url(#billGreen)" />
        <rect x="35" y="17" width="44" height="24" rx="2" fill="none" stroke="#BBF7D0" strokeWidth="1.2" />
        <circle cx="57" cy="29" r="7" fill="#15803D" opacity="0.35" />
        <text x="64" y="27" fill="#064E3B" fontSize="9" fontWeight="800" fontFamily="Bricolage Grotesque">100</text>
      </g>
      {/* Leather wallet body */}
      <rect x="22" y="32" width="64" height="50" rx="12" fill="url(#walletBody)" />
      <rect x="25" y="35" width="58" height="44" rx="9" fill="none" stroke="#4B5563" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" />
      {/* Wallet clasp */}
      <rect x="66" y="49" width="24" height="16" rx="6" fill="#111827" stroke="#374151" strokeWidth="1.5" />
      <circle cx="74" cy="57" r="3.5" fill="#9CA3AF" />
      <circle cx="74" cy="57" r="1.5" fill="#374151" />
    </svg>
  );
}

export function CalendarCoinIllustration() {
  return (
    <svg viewBox="0 0 110 100" className="w-20 h-20 shrink-0 select-none" aria-hidden="true">
      <defs>
        <linearGradient id="calHeader" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8CE02C" />
          <stop offset="100%" stopColor="#56AD17" />
        </linearGradient>
        <linearGradient id="goldCoin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>
      <ellipse cx="56" cy="86" rx="34" ry="7" fill="rgba(15, 23, 42, 0.12)" />
      {/* Calendar stand */}
      <g transform="rotate(-6 56 48)">
        <rect x="28" y="20" width="56" height="58" rx="10" fill="#CBD5E1" />
        <rect x="25" y="18" width="56" height="56" rx="10" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
        <path d="M25 28 C25 22.5 29.5 18 35 18 L71 18 C76.5 18 81 22.5 81 28 L81 34 L25 34 Z" fill="url(#calHeader)" />
        {/* Rings */}
        <rect x="36" y="12" width="5" height="12" rx="2.5" fill="#64748B" />
        <rect x="51" y="12" width="5" height="12" rx="2.5" fill="#64748B" />
        <rect x="66" y="12" width="5" height="12" rx="2.5" fill="#64748B" />
        {/* Grid cells */}
        <rect x="33" y="40" width="9" height="7" rx="2" fill="#BCEF7E" />
        <rect x="45" y="40" width="9" height="7" rx="2" fill="#E2E8F0" />
        <rect x="57" y="40" width="9" height="7" rx="2" fill="#65C91D" />
        <rect x="69" y="40" width="6" height="7" rx="2" fill="#E2E8F0" />
        <rect x="33" y="51" width="9" height="7" rx="2" fill="#E2E8F0" />
        <rect x="45" y="51" width="9" height="7" rx="2" fill="#8CE02C" />
        <rect x="57" y="51" width="9" height="7" rx="2" fill="#E2E8F0" />
        <rect x="33" y="61" width="9" height="6" rx="2" fill="#56AD17" />
        <rect x="45" y="61" width="9" height="6" rx="2" fill="#E2E8F0" />
      </g>
      {/* Gold Coin */}
      <circle cx="30" cy="70" r="13" fill="url(#goldCoin)" stroke="#FEF08A" strokeWidth="1.5" />
      <circle cx="30" cy="70" r="9.5" fill="none" stroke="#FDE047" strokeWidth="1" />
      <text x="30" y="74" textAnchor="middle" fill="#78350F" fontSize="10" fontWeight="800" fontFamily="Bricolage Grotesque">$</text>
    </svg>
  );
}

export function ScaleIllustration() {
  return (
    <svg viewBox="0 0 100 90" className="w-16 h-16 shrink-0 select-none" aria-hidden="true">
      <ellipse cx="50" cy="78" rx="26" ry="6" fill="rgba(15, 23, 42, 0.14)" />
      {/* Base */}
      <ellipse cx="50" cy="74" rx="18" ry="6" fill="#475569" />
      <ellipse cx="50" cy="72" rx="14" ry="4.5" fill="#94A3B8" />
      {/* Center pillar */}
      <rect x="47.5" y="20" width="5" height="52" rx="2.5" fill="#64748B" />
      <circle cx="50" cy="18" r="5" fill="#334155" />
      {/* Crossbar */}
      <path d="M18 28 Q50 20 82 28" stroke="#475569" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* Left pan (Brand Green) */}
      <line x1="22" y1="27" x2="15" y2="50" stroke="#94A3B8" strokeWidth="1.5" />
      <line x1="22" y1="27" x2="29" y2="50" stroke="#94A3B8" strokeWidth="1.5" />
      <path d="M11 50 Q22 60 33 50 Z" fill="#56AD17" />
      <ellipse cx="22" cy="50" rx="11" ry="3" fill="#8CE02C" />
      {/* Right pan (Pink/Rose) */}
      <line x1="78" y1="27" x2="71" y2="50" stroke="#94A3B8" strokeWidth="1.5" />
      <line x1="78" y1="27" x2="85" y2="50" stroke="#94A3B8" strokeWidth="1.5" />
      <path d="M67 50 Q78 60 89 50 Z" fill="#E11D48" />
      <ellipse cx="78" cy="50" rx="11" ry="3" fill="#FB7185" />
    </svg>
  );
}

export function CardIllustration() {
  return (
    <svg viewBox="0 0 100 84" className="w-16 h-14 shrink-0 select-none" aria-hidden="true">
      <defs>
        <linearGradient id="tapiocaCard3D" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1E3526" />
          <stop offset="50%" stopColor="#0B130F" />
          <stop offset="100%" stopColor="#070C09" />
        </linearGradient>
      </defs>
      <ellipse cx="52" cy="72" rx="28" ry="6" fill="rgba(101, 201, 29, 0.22)" />
      <g transform="rotate(-12 50 42)">
        <rect x="16" y="18" width="66" height="42" rx="7" fill="url(#tapiocaCard3D)" stroke="#8CE02C" strokeWidth="1" />
        <rect x="23" y="28" width="12" height="9" rx="2" fill="#8CE02C" />
        <line x1="23" y1="32.5" x2="35" y2="32.5" stroke="#0B130F" strokeWidth="0.8" />
        <rect x="23" y="45" width="24" height="3.5" rx="1.5" fill="#8CE02C" opacity="0.7" />
        <circle cx="67" cy="48" r="5" fill="#EF4444" opacity="0.85" />
        <circle cx="72" cy="48" r="5" fill="#F59E0B" opacity="0.85" />
      </g>
    </svg>
  );
}

export function HouseIllustration() {
  return (
    <svg viewBox="0 0 100 90" className="w-16 h-16 shrink-0 select-none" aria-hidden="true">
      <ellipse cx="50" cy="78" rx="30" ry="7" fill="rgba(15, 23, 42, 0.12)" />
      {/* Green lawn base */}
      <ellipse cx="50" cy="74" rx="28" ry="6" fill="#22C55E" />
      {/* House walls */}
      <rect x="28" y="40" width="44" height="33" rx="3" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
      {/* Roof */}
      <path d="M20 43 L50 17 L80 43 Z" fill="#0B130F" stroke="#56AD17" strokeWidth="2" strokeLinejoin="round" />
      {/* Chimney */}
      <rect x="62" y="22" width="8" height="14" rx="1.5" fill="#56AD17" />
      {/* Door */}
      <rect x="44" y="53" width="12" height="20" rx="2" fill="#F59E0B" />
      <circle cx="53" cy="63" r="1.2" fill="#78350F" />
      {/* Windows */}
      <rect x="32" y="48" width="8" height="8" rx="1.5" fill="#8CE02C" stroke="#56AD17" strokeWidth="1" />
      <rect x="60" y="48" width="8" height="8" rx="1.5" fill="#8CE02C" stroke="#56AD17" strokeWidth="1" />
      {/* Bushes */}
      <circle cx="27" cy="71" r="5" fill="#16A34A" />
      <circle cx="73" cy="71" r="5" fill="#16A34A" />
    </svg>
  );
}

export function ConstructionIllustration() {
  return (
    <svg viewBox="0 0 100 90" className="w-16 h-16 shrink-0 select-none" aria-hidden="true">
      <ellipse cx="52" cy="80" rx="28" ry="6" fill="rgba(15, 23, 42, 0.14)" />
      {/* Concrete / Cinder blocks */}
      <rect x="26" y="56" width="26" height="18" rx="2.5" fill="#64748B" stroke="#475569" strokeWidth="1.2" />
      <rect x="30" y="60" width="7" height="10" rx="1" fill="#334155" />
      <rect x="41" y="60" width="7" height="10" rx="1" fill="#334155" />
      <rect x="48" y="58" width="26" height="18" rx="2.5" fill="#94A3B8" stroke="#64748B" strokeWidth="1.2" />
      <rect x="52" y="62" width="7" height="10" rx="1" fill="#475569" />
      <rect x="63" y="62" width="7" height="10" rx="1" fill="#475569" />
      {/* Yellow Hardhat */}
      <path d="M30 48 C30 30 70 30 70 48 Z" fill="#F59E0B" />
      <path d="M35 46 C35 33 65 33 65 46 Z" fill="#FBBF24" />
      <rect x="46" y="29" width="8" height="17" rx="3" fill="#FDE047" />
      <path d="M25 47 L75 47 C77 47 78 51 74 52 L26 52 C22 51 23 47 25 47 Z" fill="#D97706" />
    </svg>
  );
}
