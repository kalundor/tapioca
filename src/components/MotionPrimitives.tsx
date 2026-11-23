import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { formatBRL } from '../utils/financeMath';

/**
 * Curvas de easing personalizadas em harmonia com a tipografia Bricolage Grotesque & Fraunces:
 * Abertura decisiva seguida de desaceleração editorial sedosa ("folha arquitectônica assentando").
 */
export const EDITORIAL_EASE = [0.22, 1, 0.36, 1] as const;
export const EDITORIAL_EXIT_EASE = [0.4, 0, 1, 1] as const;
export const EDITORIAL_SPRING = {
  type: 'spring' as const,
  stiffness: 360,
  damping: 32,
  mass: 0.85,
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
 * MagicUI / Onyx smooth tabular number ticker.
 * Renders crisp split-cents typography by default (bold integer + muted decimal ",85")
 * while respecting prefers-reduced-motion with zero layout shift.
 */
export function NumberTicker({
  value,
  prefix = '',
  suffix = '',
  className = '',
  centsClassName = 'text-[0.58em] font-medium opacity-60',
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
 * 21st.dev / MagicUI spotlight bento surface with Framer Motion editorial transition
 * using Papel Atelier & Obsidian Floresta styling and custom EDITORIAL_EASE curve.
 */
export function SpotlightBento({
  children,
  className = '',
  as = 'section',
  delay = 0,
  hoverLift = true,
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
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      whileHover={
        hoverLift
          ? {
              y: -2,
              transition: { duration: 0.22, ease: EDITORIAL_EASE },
            }
          : undefined
      }
      transition={{
        duration: 0.38,
        delay: cappedDelay,
        ease: EDITORIAL_EASE,
      }}
      className={`bento-card bg-white dark:bg-[#0D1210] rounded-2xl border border-[#E4E7E5] dark:border-[#1B231F] overflow-hidden ${className}`}
      {...(rest as any)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          opacity: coords.visible ? 1 : 0,
          background: `radial-gradient(380px circle at ${coords.x}px ${coords.y}px, rgba(101, 201, 29, 0.065), transparent 65%)`,
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

/**
 * Tactile Framer Motion tile for compact bento action cards using EDITORIAL_EASE.
 */
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
      whileHover={{ y: -2, transition: { duration: 0.2, ease: EDITORIAL_EASE } }}
      whileTap={{ scale: 0.982, transition: { duration: 0.1 } }}
      transition={{ duration: 0.34, delay: Math.min(delay, 0.24), ease: EDITORIAL_EASE }}
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

/**
 * Editorial Framer Motion dialog / bottom-sheet / command-palette backdrop & container.
 * Handles Escape key, backdrop dismiss, smooth enter/exit under AnimatePresence.
 */
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
            transition: { duration: 0.38, ease: EDITORIAL_EASE },
          },
          exit: {
            opacity: 0,
            y: '100%',
            transition: { duration: 0.24, ease: EDITORIAL_EXIT_EASE },
          },
        }
      : variant === 'palette'
        ? {
            initial: { opacity: 0, y: -14, scale: 0.975 },
            animate: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.3, ease: EDITORIAL_EASE },
            },
            exit: {
              opacity: 0,
              y: -10,
              scale: 0.985,
              transition: { duration: 0.18, ease: EDITORIAL_EXIT_EASE },
            },
          }
        : {
            initial: { opacity: 0, y: 20, scale: 0.975 },
            animate: {
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: 0.34, ease: EDITORIAL_EASE },
            },
            exit: {
              opacity: 0,
              y: 12,
              scale: 0.985,
              transition: { duration: 0.2, ease: EDITORIAL_EXIT_EASE },
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
            animate={{ opacity: 1, transition: { duration: 0.24, ease: EDITORIAL_EASE } }}
            exit={{ opacity: 0, transition: { duration: 0.18, ease: EDITORIAL_EXIT_EASE } }}
            onClick={onClose}
            className="fixed inset-0 bg-black/58 backdrop-blur-xs"
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
 * ReactBits / Mobbin inspired spring-animated segmented control with shared layoutId indicator.
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
      className={`p-1 rounded-xl inline-flex max-w-full flex-wrap sm:flex-nowrap items-center gap-0.5 ${
        isHero
          ? 'bg-white/[0.06] backdrop-blur-xs border border-white/10'
          : 'bg-[#F1F3F2] dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F]'
      } ${className}`}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`relative min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 cursor-pointer ${
              active
                ? isHero
                  ? 'text-[#060807]'
                  : 'text-[#0B110E] dark:text-[#F3F5F4]'
                : isHero
                  ? 'text-[#A8B5AE] hover:text-white'
                  : 'text-[#5C6660] dark:text-[#8C9891] hover:text-[#0B110E] dark:hover:text-white'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={EDITORIAL_SPRING}
                className={`absolute inset-0 rounded-lg ${
                  isHero
                    ? 'bg-[#8CE02C] shadow-xs'
                    : 'bg-white dark:bg-[#19221D] shadow-2xs border border-[#E4E7E5] dark:border-[#27332D]'
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

/**
 * Smooth compositor-only editorial page transition between navigation views.
 */
export function SlideViewTransition({ viewKey, children }: SlideViewTransitionProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={viewKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { duration: 0.28, ease: EDITORIAL_EASE },
        }}
        exit={{
          opacity: 0,
          y: -6,
          transition: { duration: 0.16, ease: EDITORIAL_EXIT_EASE },
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

interface ShimmerActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'lime' | 'forest';
}

/**
 * MagicUI / Uiverse inspired crisp tactile primary action button with subtle highlight sweep.
 */
export function ShimmerActionButton({
  children,
  variant = 'lime',
  className = '',
  ...props
}: ShimmerActionButtonProps) {
  return (
    <motion.button
      whileHover={{ y: -1, transition: { duration: 0.2, ease: EDITORIAL_EASE } }}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.14, ease: EDITORIAL_EASE }}
      className={`relative overflow-hidden group cursor-pointer ${
        variant === 'lime'
          ? 'bg-[#8CE02C] hover:bg-[#9AE83C] text-[#060807]'
          : 'bg-[#0B130F] hover:bg-[#15221B] dark:bg-[#8CE02C] dark:hover:bg-[#9AE83C] text-[#F3F5F4] dark:text-[#060807]'
      } ${className}`}
      {...(props as any)}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </motion.button>
  );
}
