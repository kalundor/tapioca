import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBRL } from '../utils/financeMath';

/**
 * Curvas de easing personalizadas em harmonia com a tipografia editorial Swiss Broadsheet:
 * Abertura decisiva seguida de desaceleração arquitetônica precisa.
 */
export const EDITORIAL_EASE = [0.22, 1, 0.36, 1] as const;
export const EDITORIAL_EXIT_EASE = [0.4, 0, 1, 1] as const;
export const EDITORIAL_SPRING = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 34,
  mass: 0.8,
};

interface NumberTickerProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  centsClassName?: string;
  splitCents?: boolean;
  durationMs?: number;
}

/**
 * Smooth tabular number ticker with split-cents editorial typography.
 */
export function NumberTicker({
  value,
  prefix = '',
  suffix = '',
  className = '',
  centsClassName = 'text-[0.58em] font-medium opacity-55',
  splitCents = true,
  durationMs = 360,
}: NumberTickerProps) {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    const startVal = prevValueRef.current;
    const endVal = value;
    if (Math.abs(endVal - startVal) < 0.01) {
      setDisplayValue(endVal);
      prevValueRef.current = endVal;
      return;
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplayValue(endVal);
      prevValueRef.current = endVal;
      return;
    }

    let frameId = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startVal + (endVal - startVal) * eased);
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      } else {
        setDisplayValue(endVal);
        prevValueRef.current = endVal;
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, durationMs]);

  const formatted = formatBRL(displayValue);

  if (!splitCents) {
    return (
      <span className={`font-display-num tabular-nums ${className}`}>
        {prefix}
        {formatted}
        {suffix}
      </span>
    );
  }

  const commaIdx = formatted.lastIndexOf(',');
  const integerPart = commaIdx >= 0 ? formatted.slice(0, commaIdx) : formatted;
  const decimalPart = commaIdx >= 0 ? formatted.slice(commaIdx) : '';

  return (
    <span className={`font-display-num tabular-nums ${className}`}>
      {prefix}
      <span>{integerPart}</span>
      {decimalPart && <span className={centsClassName}>{decimalPart}</span>}
      {suffix}
    </span>
  );
}

interface SpotlightBentoProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
  as?: 'section' | 'div';
  delay?: number;
  hoverLift?: boolean;
}

/**
 * Swiss Architectural Hairline Bento Surface with smooth Framer Motion scale (0.98 -> 1)
 * and restrained Klein Cobalt spotlight sweep.
 */
export function SpotlightBento({
  children,
  className = '',
  as = 'section',
  delay = 0,
  hoverLift = false,
  ...rest
}: SpotlightBentoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      visible: true,
    });
  };

  const MotionTag = as === 'div' ? motion.div : motion.section;
  const cappedDelay = Math.min(delay, 0.24);

  return (
    <MotionTag
      ref={containerRef as any}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setCoords((prev) => ({ ...prev, visible: false }))}
      initial={{ opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={
        hoverLift
          ? {
              y: -1,
              transition: { duration: 0.2, ease: EDITORIAL_EASE },
            }
          : undefined
      }
      transition={{
        duration: 0.34,
        delay: cappedDelay,
        ease: EDITORIAL_EASE,
      }}
      className={`bento-card bg-white dark:bg-[#111113] rounded-sm border border-[#E2E2DC] dark:border-[#242429] overflow-hidden ${className}`}
      {...(rest as any)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: coords.visible ? 1 : 0,
          background: `radial-gradient(360px circle at ${coords.x}px ${coords.y}px, rgba(140, 224, 44, 0.12), transparent 65%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </MotionTag>
  );
}

interface BentoMotionTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export function BentoMotionTile({
  children,
  delay = 0,
  className = '',
  ...props
}: BentoMotionTileProps) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.98, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={{ y: -1, transition: { duration: 0.18, ease: EDITORIAL_EASE } }}
      whileTap={{ scale: 0.985, transition: { duration: 0.1 } }}
      transition={{ duration: 0.32, delay: Math.min(delay, 0.24), ease: EDITORIAL_EASE }}
      className={`bento-card ${className}`}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}

interface EditorialModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  variant?: 'dialog' | 'palette' | 'sheet';
  containerClassName?: string;
  zIndexClass?: string;
}

export function EditorialModalShell({
  isOpen,
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  variant = 'dialog',
  containerClassName = '',
  zIndexClass = 'z-50',
}: EditorialModalShellProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const panelVariants =
    variant === 'sheet'
      ? {
          initial: { opacity: 0, y: '100%' },
          animate: {
            opacity: 1,
            y: 0,
            transition: { duration: 0.34, ease: EDITORIAL_EASE },
          },
          exit: {
            opacity: 0,
            y: '100%',
            transition: { duration: 0.22, ease: EDITORIAL_EXIT_EASE },
          },
        }
      : variant === 'palette'
        ? {
            initial: { opacity: 0, y: -12, scale: 0.98 },
            animate: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.26, ease: EDITORIAL_EASE },
            },
            exit: {
              opacity: 0,
              y: -8,
              scale: 0.985,
              transition: { duration: 0.16, ease: EDITORIAL_EXIT_EASE },
            },
          }
        : {
            initial: { opacity: 0, y: 16, scale: 0.98 },
            animate: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.3, ease: EDITORIAL_EASE },
            },
            exit: {
              opacity: 0,
              y: 10,
              scale: 0.985,
              transition: { duration: 0.18, ease: EDITORIAL_EXIT_EASE },
            },
          };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={`fixed inset-0 ${zIndexClass} ${containerClassName}`}
        >
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.22, ease: EDITORIAL_EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.16, ease: EDITORIAL_EXIT_EASE } }}
            onClick={onClose}
            className="fixed inset-0 bg-[#09090B]/60 backdrop-blur-[2px]"
          />
          <motion.div
            initial={panelVariants.initial}
            animate={panelVariants.animate}
            exit={panelVariants.exit}
            className="relative z-10 w-full flex justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-full flex justify-center">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export interface SegmentedOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

interface AnimatedSegmentedControlProps<T extends string> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (next: T) => void;
  layoutId: string;
  ariaLabel: string;
  variant?: 'surface' | 'hero';
  className?: string;
}

/**
 * Razor-crisp Swiss architectural segmented switch with shared spring indicator.
 */
export function AnimatedSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  ariaLabel,
  variant = 'surface',
  className = '',
}: AnimatedSegmentedControlProps<T>) {
  const isHero = variant === 'hero';
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`p-0.5 rounded-sm inline-flex max-w-full flex-wrap sm:flex-nowrap items-center gap-0.5 ${
        isHero
          ? 'bg-[#F3F3EF] dark:bg-[#161619] border border-[#D4D4CC] dark:border-[#28282E]'
          : 'bg-[#F3F3EF] dark:bg-[#161619] border border-[#E2E2DC] dark:border-[#242429]'
      } ${className}`}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`relative min-h-[32px] px-3 py-1 rounded-xs text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 cursor-pointer ${
              active
                ? isHero
                  ? 'text-white dark:text-[#09090B]'
                  : 'text-[#111110] dark:text-[#F5F5F2]'
                : 'text-[#5A5A54] dark:text-[#8E8E96] hover:text-[#111110] dark:hover:text-white'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={EDITORIAL_SPRING}
                className={`absolute inset-0 rounded-xs ${
                  isHero
                    ? 'bg-[#111110] dark:bg-[#F5F5F2]'
                    : 'bg-white dark:bg-[#222228] border border-[#D4D4CC] dark:border-[#32323A]'
                }`}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {opt.icon}
              <span>{opt.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface SlideViewTransitionProps {
  viewKey: string;
  children: React.ReactNode;
}

export function SlideViewTransition({ viewKey, children }: SlideViewTransitionProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: 0.24, ease: EDITORIAL_EASE },
        }}
        exit={{
          opacity: 0,
          y: -5,
          transition: { duration: 0.14, ease: EDITORIAL_EXIT_EASE },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

interface ShimmerActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'lime' | 'forest' | 'cobalt';
}

/**
 * Architectural tactile primary action button in Klein Cobalt or Obsidian Ink.
 */
export function ShimmerActionButton({
  children,
  variant = 'forest',
  className = '',
  ...props
}: ShimmerActionButtonProps) {
  const isCobalt = variant === 'lime' || variant === 'cobalt';
  return (
    <motion.button
      whileHover={{ y: -1, transition: { duration: 0.18, ease: EDITORIAL_EASE } }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.14, ease: EDITORIAL_EASE }}
      className={`relative overflow-hidden group cursor-pointer ${
        isCobalt
          ? 'bg-[#8CE02C] hover:bg-[#65C91D] dark:bg-[#8CE02C] dark:hover:bg-[#A6F04A] text-[#0B130F] dark:text-[#0B130F]'
          : 'bg-[#0B130F] hover:bg-[#14231A] dark:bg-[#F5F5F2] dark:hover:bg-white text-[#FAFAF8] dark:text-[#0B130F]'
      } ${className}`}
      {...(props as any)}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </motion.button>
  );
}
