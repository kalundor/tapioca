import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  KeyRound,
  CreditCard as CardIcon,
  Zap,
  Wifi,
  Building2,
  Triangle,
  Pencil,
  Plus,
  Link2,
  BarChart3,
  TrendingUp,
  ShoppingCart,
  HeartHandshake,
  ChevronRight,
  RefreshCw,
  Bot,
  Copy,
  Table2,
  ArrowUpRight,
} from 'lucide-react';
import {
  calculateHouseSplit,
  calculatePredictedBalance,
  calculateHousingBenchmark,
  buildRecentDailySpendSeries,
  cleanTxDescription,
  isIncomeTransaction,
  formatBRL,
  type BillItem,
  type CoupleProfile,
} from '../utils/financeMath';
import type { TransactionRecord } from './CashFlowReportsView';
import type { SavingsGoalRecord } from './SavingsGoalsView';
import type { PluggyConnectionSlot } from './CardsPluggyView';
import {
  SpotlightBento,
  NumberTicker,
  AnimatedSegmentedControl,
  ShimmerActionButton,
  EDITORIAL_EASE,
} from './MotionPrimitives';
import {
  BankEmblem,
  CardChipSvg,
  CircularGaugeSvg,
} from './BrandAssets';
import { CategorySpendingD3Map } from './CategorySpendingD3Map';

export interface CreditCardRecord {
  id: number;
  name: string;
  brand: string;
  tier: string;
  status: string;
  dueDate: string;
  currentInvoice: number;
  availableLimit: number;
  nextJanInvoice: number;
  nextFebInvoice: number;
  colorTheme: string;
  pluggyItemId?: string | null;
  owner?: 'user' | 'partner';
}

interface OverviewViewProps {
  profile: CoupleProfile;
  pluggyConnections?: PluggyConnectionSlot[];
  bills: BillItem[];
  creditCards: CreditCardRecord[];
  transactions?: TransactionRecord[];
  savingsGoals?: SavingsGoalRecord[];
  onToggleBillPaid: (billId: number, nextPaid: boolean) => void;
  onSettlePix: (settled: boolean) => void;
  onEditSalaryClick: () => void;
  onOpenInvoiceModal: (card: CreditCardRecord) => void;
  onOpenAddBillModal: (defaultCategory?: 'house' | 'personal') => void;
  onNavigateToCards?: () => void;
  onNavigateSection?: (
    sec: 'overview' | 'cashflow' | 'cards' | 'house' | 'savings' | 'income' | 'workspace'
  ) => void;
  onQuickSyncPluggy?: () => Promise<void> | void;
  onOpenCopilot?: () => void;
}

export function OverviewView({
  profile,
  pluggyConnections = [],
  bills,
  creditCards,
  transactions = [],
  savingsGoals = [],
  onToggleBillPaid,
  onSettlePix,
  onEditSalaryClick,
  onOpenInvoiceModal,
  onOpenAddBillModal,
  onNavigateToCards,
  onNavigateSection,
  onQuickSyncPluggy,
  onOpenCopilot,
}: OverviewViewProps) {
  const [casalScope, setCasalScope] = useState<'all' | 'user' | 'partner'>('all');
  const [selectedDayTab, setSelectedDayTab] = useState<number | 'all'>('all');
  const [housingMode, setHousingMode] = useState<'solo' | 'couple'>('solo');
  const [showAllSharedBills, setShowAllSharedBills] = useState(false);
  const [showAllPayableBills, setShowAllPayableBills] = useState(false);
  const [selectedWeekIdx, setSelectedWeekIdx] = useState<number>(6);
  const [isQuickSyncing, setIsQuickSyncing] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);

  const predicted = calculatePredictedBalance(profile, bills);
  const houseSplit = calculateHouseSplit(bills);
  const housingBenchmark = calculateHousingBenchmark(profile, bills, housingMode);

  const userSplitDisplayPct = Number(houseSplit.userPaidPct.toFixed(1));
  const partnerSplitDisplayPct = Number((100 - userSplitDisplayPct).toFixed(1));

  const totalLiquidity =
    savingsGoals.length > 0
      ? savingsGoals.reduce((acc, g) => acc + g.currentAmount, 0)
      : 515.9;

  const consolidatedBalance =
    casalScope === 'partner'
      ? profile.partnerSalary
      : Math.max(0, predicted.predictedLeftover) + totalLiquidity;

  const handleCopyPixSummary = async () => {
    const note = `Acerto 50/50 Tapioca Pay · Valor R$ ${formatBRL(houseSplit.pixSettlementAmount)} (${
      houseSplit.whoOwesWhom === 'partner_owes_user'
        ? `${profile.partnerName.split(' ')[0]} -> Alan`
        : `Alan -> ${profile.partnerName.split(' ')[0]}`
    })`;
    try {
      await navigator.clipboard?.writeText(note);
    } catch {
      // Clipboard API may be blocked in sandboxed preview
    }
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 2200);
  };

  const handleQuickSyncClick = async () => {
    if (!onQuickSyncPluggy) {
      onNavigateToCards?.();
      return;
    }
    setIsQuickSyncing(true);
    try {
      await onQuickSyncPluggy();
    } finally {
      setIsQuickSyncing(false);
    }
  };

  const scopedBills =
    casalScope === 'all' ? bills : bills.filter((b) => b.paidBy === casalScope || b.isShared);
  const scopedCards =
    casalScope === 'all'
      ? creditCards
      : creditCards.filter((c) => (c.owner || 'user') === casalScope);
  const scopedTransactions =
    casalScope === 'all'
      ? transactions
      : transactions.filter((t) => (t.owner || 'user') === casalScope);

  const payableBills = scopedBills
    .filter((b) => (casalScope === 'partner' ? b.paidBy === 'partner' : b.paidBy === 'user'))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  const totalPayableAmount = payableBills.reduce((acc, b) => acc + b.amount, 0);
  const paidBillsCount = payableBills.filter((b) => b.isPaid).length;

  const uniqueDueDays = Array.from(new Set(payableBills.map((b) => b.dueDay))).sort(
    (a, b) => a - b
  );
  const dayTabNumbers =
    uniqueDueDays.length >= 4 ? uniqueDueDays.slice(0, 5) : [7, 10, 14, 15, 16];

  const dayTabs: Array<{ day: number; count: number }> = dayTabNumbers.map((d) => ({
    day: d,
    count: payableBills.filter((b) => b.dueDay === d).length,
  }));

  const filteredPayableBills =
    selectedDayTab === 'all'
      ? payableBills
      : payableBills.filter((b) => b.dueDay === selectedDayTab);
  const displayedPayableBills =
    selectedDayTab === 'all' && !showAllPayableBills
      ? filteredPayableBills.slice(0, 5)
      : filteredPayableBills;

  const cardsToUse = scopedCards.length > 0 ? scopedCards : creditCards;

  const invoiceNov = cardsToUse.reduce((acc, c) => acc + c.currentInvoice, 0);
  const invoiceDez = cardsToUse.reduce((acc, c) => acc + c.nextJanInvoice, 0);
  const invoiceJan = cardsToUse.reduce((acc, c) => acc + c.nextFebInvoice, 0);

  const sharedHouseBills = bills
    .filter((b) => b.isShared && b.category === 'house')
    .sort((a, b) => b.amount - a.amount);
  const visibleSharedBills = showAllSharedBills ? sharedHouseBills : sharedHouseBills.slice(0, 4);

  const alanSlot = pluggyConnections.find((c) => c.slot === 'user');
  const larissaSlot = pluggyConnections.find((c) => c.slot === 'partner');
  const connectedCount = pluggyConnections.filter((c) => c.status === 'connected').length;

  const weeklySummary = useMemo(
    () => buildRecentDailySpendSeries(scopedTransactions),
    [scopedTransactions]
  );

  const weeklyPoints = weeklySummary.points;
  const safeSelectedIdx = Math.min(selectedWeekIdx, Math.max(0, weeklyPoints.length - 1));
  const weeklyMax = Math.max(80, ...weeklyPoints.map((w) => w.spent));
  const chartW = 420;
  const chartH = 112;
  const pointCoords = weeklyPoints.map((pt, i) => {
    const x =
      weeklyPoints.length === 1
        ? chartW / 2
        : 26 + (i / (weeklyPoints.length - 1)) * (chartW - 52);
    const y = chartH - 18 - (pt.spent / weeklyMax) * (chartH - 36);
    return { x, y, ...pt };
  });

  const smoothLinePath = pointCoords.reduce((acc, p, idx, arr) => {
    if (idx === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[idx - 1];
    const cx = (prev.x + p.x) / 2;
    return `${acc} C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`;
  }, '');

  const activeWeekPoint = pointCoords[safeSelectedIdx] || pointCoords[pointCoords.length - 1];

  const renderHousingIcon = (iconType: string) => {
    switch (iconType) {
      case 'key':
        return <KeyRound className="w-3.5 h-3.5 text-[#0B110E] dark:text-[#8CE02C]" />;
      case 'crane':
        return <Triangle className="w-3.5 h-3.5 text-[#0B110E] dark:text-[#8CE02C]" />;
      case 'card':
        return <CardIcon className="w-3.5 h-3.5 text-[#0B110E] dark:text-[#8CE02C]" />;
      case 'building':
        return <Building2 className="w-3.5 h-3.5 text-[#0B110E] dark:text-[#8CE02C]" />;
      case 'zap':
        return <Zap className="w-3.5 h-3.5 text-[#0B110E] dark:text-[#8CE02C]" />;
      case 'wifi':
        return <Wifi className="w-3.5 h-3.5 text-[#0B110E] dark:text-[#8CE02C]" />;
      default:
        return <Building2 className="w-3.5 h-3.5 text-[#0B110E] dark:text-[#8CE02C]" />;
    }
  };

  const renderTxIcon = (tx: TransactionRecord) => {
    const desc = tx.description.toLowerCase();
    if (desc.includes('nubank') || desc.includes('inter') || desc.includes('santander')) {
      return <BankEmblem institution={tx.accountName} size="md" />;
    }
    if (desc.includes('carioca') || desc.includes('supermercado') || tx.category === 'Groceries') {
      return (
        <span className="w-8 h-8 rounded-lg bg-[#F1F3F2] dark:bg-[#141C17] text-[#0B110E] dark:text-[#8CE02C] flex items-center justify-center shrink-0">
          <ShoppingCart className="w-3.5 h-3.5" />
        </span>
      );
    }
    if (tx.category === 'Investments' || desc.includes('cdb')) {
      return (
        <span className="w-8 h-8 rounded-lg bg-[#ECF7E1] dark:bg-[#142919] text-[#458B12] dark:text-[#8CE02C] flex items-center justify-center shrink-0">
          <TrendingUp className="w-3.5 h-3.5" />
        </span>
      );
    }
    if (isIncomeTransaction(tx)) {
      return (
        <span className="w-8 h-8 rounded-lg bg-[#ECF7E1] dark:bg-[#142919] text-[#458B12] dark:text-[#8CE02C] flex items-center justify-center shrink-0">
          <HeartHandshake className="w-3.5 h-3.5" />
        </span>
      );
    }
    return <BankEmblem institution={tx.accountName} size="md" />;
  };

  const cardDisplaySalary =
    casalScope === 'partner'
      ? profile.partnerSalary
      : casalScope === 'user'
        ? profile.userSalary
        : profile.userSalary + profile.partnerSalary;

  const balanceLabel =
    casalScope === 'partner'
      ? 'Saldo consolidado · Larissa'
      : casalScope === 'user'
        ? 'Saldo consolidado · Alan'
        : 'Saldo total consolidado';

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* BAND 1: SCULPTURAL CARBON COMMAND HERO — ASYMMETRIC ARCHITECTURAL ANCHOR */}
      <motion.section
        aria-label="Resumo financeiro principal"
        initial={{ opacity: 0, scale: 0.98, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.36, ease: EDITORIAL_EASE }}
        className="relative overflow-hidden rounded-2xl bg-[#090E0C] text-[#F3F5F4] border border-[#1E2823] p-5 sm:p-7"
      >
        {/* Minimalist Architectural Mesh & Rim Line (No Generic Blobs) */}
        <svg
          viewBox="0 0 1200 380"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 w-full h-full opacity-50"
        >
          <defs>
            <radialGradient id="carbonHeroRim" cx="12%" cy="10%" r="58%">
              <stop offset="0%" stopColor="#8CE02C" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#090E0C" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="1200" height="380" fill="url(#carbonHeroRim)" />
          <path d="M0 295 H1200" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <path d="M720 0 V380" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <path d="M880 0 L1200 220" stroke="rgba(140,224,44,0.08)" strokeWidth="1" />
        </svg>

        {/* Top Identity & Scope Strip */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex -space-x-2 shrink-0">
              <div className="w-9 h-9 rounded-full bg-[#8CE02C] text-[#060807] font-editorial font-extrabold text-xs flex items-center justify-center ring-2 ring-[#090E0C]">
                AL
              </div>
              <div className="w-9 h-9 rounded-full bg-[#D97706] text-white font-editorial font-extrabold text-xs flex items-center justify-center ring-2 ring-[#090E0C]">
                LF
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="font-editorial text-lg sm:text-xl font-bold text-white truncate leading-tight">
                {profile.displayName.split(' ')[0]} &amp;{' '}
                <span className="font-accent-serif text-[#8CE02C] font-semibold">
                  {profile.partnerName.split(' ')[0]}
                </span>
              </h1>
              <p className="text-xs text-[#8C9891] truncate mt-0.5">
                {profile.displayName} (Titular) &amp; {profile.partnerName} (Namorada) ·{' '}
                {connectedCount}/2 Pluggy conectado
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:w-auto">
            <AnimatedSegmentedControl
              layoutId="overview-scope-control"
              ariaLabel="Filtrar visão por pessoa"
              variant="hero"
              className="w-full sm:w-auto justify-between sm:justify-start"
              value={casalScope}
              onChange={(next) => {
                setCasalScope(next);
                setSelectedDayTab('all');
              }}
              options={[
                { id: 'all', label: 'Todo o casal' },
                { id: 'user', label: 'Alan' },
                { id: 'partner', label: 'Larissa' },
              ]}
            />

            {onNavigateToCards && (
              <button
                type="button"
                onClick={onNavigateToCards}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.11] border border-white/10 text-xs font-medium text-[#D5E0D9] flex items-center justify-between sm:justify-start gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>
                  Alan ({alanSlot?.status === 'pending' ? 'Pendente' : 'Ativo'})
                </span>
                <span className="text-white/25">/</span>
                <span className="text-white">
                  Larissa ({larissaSlot?.status === 'connected' ? 'Ativo' : 'Conectar'})
                </span>
                <Link2 className="w-3.5 h-3.5 text-[#8CE02C] shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Asymmetric Split: Massive Consolidated Balance (7 cols) + Projection & Actions (5 cols) */}
        <div className="relative z-10 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
          <div className="lg:col-span-7 flex items-center justify-between sm:justify-start gap-6 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-[#8C9891]">
                <span>{balanceLabel}</span>
                <button
                  type="button"
                  onClick={onEditSalaryClick}
                  aria-label="Editar renda e orçamento"
                  className="p-1 rounded-md hover:bg-white/10 text-[#8CE02C] transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-2 font-display-num text-[42px] sm:text-[56px] font-extrabold tracking-tight text-white leading-none tabular-nums">
                <NumberTicker
                  value={consolidatedBalance}
                  prefix="R$ "
                  centsClassName="text-[0.46em] font-medium opacity-55"
                />
              </div>

              <p className="text-xs text-[#98A69E] mt-3 tabular-nums">
                Saldo livre R$ {formatBRL(predicted.predictedLeftover)} · Reservas CDB R${' '}
                {formatBRL(totalLiquidity)} (100% CDI)
              </p>
            </div>

            <div className="shrink-0 pl-2 sm:pl-6 sm:border-l sm:border-white/10">
              <CircularGaugeSvg
                valuePct={predicted.predictedLeftoverPct}
                size={68}
                strokeWidth={5}
                label={`${predicted.predictedLeftoverPct}%`}
                sublabel="livre"
              />
            </div>
          </div>

          {/* Right 5 Cols: Projection Ledger + Full-Width Mobile Quick Actions */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="rounded-xl bg-white/[0.04] border border-white/10 grid grid-cols-3 divide-x divide-white/10">
              <div className="p-3 min-w-0">
                <div className="text-[10px] text-[#8C9891]">Fatura Nov</div>
                <div className="font-display-num text-sm sm:text-base font-bold text-white tabular-nums truncate mt-0.5">
                  R$ {formatBRL(invoiceNov)}
                </div>
              </div>

              <div className="p-3 min-w-0">
                <div className="text-[10px] text-[#8C9891]">Projeção Dez</div>
                <div className="font-display-num text-sm sm:text-base font-bold text-[#D5E0D9] tabular-nums truncate mt-0.5">
                  R$ {formatBRL(invoiceDez)}
                </div>
              </div>

              <div className="p-3 min-w-0">
                <div className="text-[10px] text-[#8CE02C]">Alívio Jan</div>
                <div className="font-display-num text-sm sm:text-base font-bold text-[#8CE02C] tabular-nums truncate mt-0.5">
                  R$ {formatBRL(invoiceJan)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <ShimmerActionButton
                type="button"
                variant="lime"
                onClick={() => onOpenAddBillModal('house')}
                className="min-h-[44px] w-full px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Nova Despesa</span>
              </ShimmerActionButton>

              <button
                type="button"
                disabled={isQuickSyncing}
                onClick={handleQuickSyncClick}
                className="min-h-[44px] w-full px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] disabled:opacity-60 border border-white/12 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-4 h-4 text-[#8CE02C] ${isQuickSyncing ? 'animate-spin' : ''}`}
                />
                <span>{isQuickSyncing ? 'Sincronizando...' : 'Sync Pluggy'}</span>
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* BAND 2: UNIFIED MERCURY-STYLE HAIRLINE KPI STRIP (ZERO BOX REPETITION) */}
      <motion.section
        aria-label="Indicadores de saldo e equilíbrio"
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.34, delay: 0.04, ease: EDITORIAL_EASE }}
        className="bento-card rounded-2xl bg-white dark:bg-[#0D1210] border border-[#E4E7E5] dark:border-[#1B231F] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E4E7E5] dark:divide-[#1B231F] overflow-hidden"
      >
        <button
          type="button"
          onClick={onEditSalaryClick}
          className="w-full p-5 sm:p-6 text-left flex flex-col justify-between gap-4 hover:bg-[#F7F8F7]/80 dark:hover:bg-[#111714]/70 transition-colors cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#5C6660] dark:text-[#8C9891]">
                Saldo livre previsto
              </div>
              <div className="mt-1.5 font-display-num text-[30px] font-bold text-[#0B110E] dark:text-white leading-none tabular-nums">
                <NumberTicker
                  value={predicted.predictedLeftover}
                  prefix="R$ "
                  centsClassName="text-[0.55em] font-medium opacity-55"
                />
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#5C6660] group-hover:text-[#56AD17] dark:group-hover:text-[#8CE02C] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#5C6660] dark:text-[#8C9891] tabular-nums">
            <span>Entradas R$ {formatBRL(predicted.salary)}</span>
            <span className="font-semibold text-[#56AD17] dark:text-[#8CE02C]">
              Ajustar renda
            </span>
          </div>
        </button>

        <div className="w-full p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#5C6660] dark:text-[#8C9891]">
                Acerto 50/50 · Casa
              </div>
              <div className="mt-1.5 font-display-num text-[30px] font-bold text-[#D97706] dark:text-[#F59E0B] leading-none tabular-nums">
                <NumberTicker
                  value={houseSplit.pixSettlementAmount}
                  prefix="R$ "
                  centsClassName="text-[0.55em] font-medium opacity-60"
                />
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyPixSummary}
                aria-label="Copiar resumo do acerto Pix 50/50"
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#F1F3F2] dark:bg-[#141C17] hover:bg-[#E4E7E5] dark:hover:bg-[#1C2720] text-[11px] font-semibold text-[#0B110E] dark:text-[#F3F5F4] flex items-center gap-1 cursor-pointer transition-colors"
              >
                {pixCopied ? (
                  <Check className="w-3 h-3 text-[#56AD17] dark:text-[#8CE02C]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{pixCopied ? 'Copiado' : 'Pix'}</span>
              </button>
              <button
                type="button"
                onClick={() => onSettlePix(!profile.pixSettled)}
                className={`min-h-[34px] px-3 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  profile.pixSettled
                    ? 'bg-[#ECF7E1] dark:bg-[#142919] text-[#3B7A1E] dark:text-[#8CE02C]'
                    : 'bg-[#0B130F] dark:bg-[#8CE02C] text-[#F3F5F4] dark:text-[#060807]'
                }`}
              >
                {profile.pixSettled ? 'Quitado ✓' : 'Quitar'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#5C6660] dark:text-[#8C9891]">
            <span>Direção do Pix</span>
            <span className="font-semibold text-[#0B110E] dark:text-[#F3F5F4]">
              {profile.pixSettled
                ? 'Equilíbrio quitado'
                : houseSplit.whoOwesWhom === 'partner_owes_user'
                  ? `${profile.partnerName.split(' ')[0]} → Alan`
                  : `Alan → ${profile.partnerName.split(' ')[0]}`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateSection?.('savings')}
          className="w-full p-5 sm:p-6 text-left flex flex-col justify-between gap-4 hover:bg-[#F7F8F7]/80 dark:hover:bg-[#111714]/70 transition-colors cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#5C6660] dark:text-[#8C9891]">
                Liquidez CDB (100% CDI)
              </div>
              <div className="mt-1.5 font-display-num text-[30px] font-bold text-[#0B110E] dark:text-white leading-none tabular-nums">
                <NumberTicker
                  value={totalLiquidity}
                  prefix="R$ "
                  centsClassName="text-[0.55em] font-medium opacity-55"
                />
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#5C6660] group-hover:text-[#D97706] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#5C6660] dark:text-[#8C9891] tabular-nums">
            <span>
              Contas {paidBillsCount}/{payableBills.length} (R$ {formatBRL(totalPayableAmount)})
            </span>
            <span className="font-semibold text-[#D97706] dark:text-[#F59E0B]">Ver reserva</span>
          </div>
        </button>
      </motion.section>

      {/* BAND 3: MATTE ARCHITECTURAL FINTECH CARDS (RESPONSIVE 1 -> 2 -> 4 COLS, 24PX GAP) */}
      <section aria-label="Cartões e contas Pluggy" className="grid grid-cols-1 gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
          <div>
            <h2 className="font-editorial text-base font-bold text-[#0B110E] dark:text-[#F3F5F4]">
              Cartões &amp; Contas Pluggy
            </h2>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
              Entradas e faturas sincronizadas via Open Finance
            </p>
          </div>
          {onNavigateToCards && (
            <button
              type="button"
              onClick={onNavigateToCards}
              className="min-h-[34px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D1210] border border-[#E4E7E5] dark:border-[#1B231F] hover:border-[#0B110E]/25 text-xs font-semibold text-[#0B110E] dark:text-[#8CE02C] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Gerenciar 2 Contas</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Chartreuse-Obsidian Signature Income Card */}
          <motion.button
            type="button"
            onClick={onEditSalaryClick}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            whileHover={{ y: -2, transition: { duration: 0.2, ease: EDITORIAL_EASE } }}
            whileTap={{ scale: 0.985, transition: { duration: 0.1 } }}
            transition={{ duration: 0.36, delay: 0.08, ease: EDITORIAL_EASE }}
            className="w-full min-h-[144px] rounded-2xl p-5 text-left relative overflow-hidden bg-[#0D1A12] border border-[#8CE02C]/40 flex flex-col justify-between cursor-pointer"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-10 w-36 h-36 rounded-full bg-[#8CE02C]/15 blur-2xl"
            />
            <div className="relative z-10 flex items-center justify-between w-full">
              <span className="text-[11px] font-semibold text-[#8CE02C]">
                Entradas · PIX 50/50
              </span>
              <Wifi className="w-4 h-4 rotate-90 text-[#8CE02C]/80" />
            </div>

            <div className="relative z-10 my-2">
              <div className="text-xs text-[#98A69E] font-medium">
                {casalScope === 'all'
                  ? 'Renda do casal'
                  : casalScope === 'partner'
                    ? 'Renda Larissa'
                    : 'Renda Alan'}
              </div>
              <div className="font-display-num text-2xl font-bold text-white tabular-nums mt-1 leading-none">
                <NumberTicker
                  value={cardDisplaySalary}
                  prefix="R$ "
                  centsClassName="text-[0.58em] font-medium opacity-70"
                />
              </div>
            </div>

            <div className="relative z-10 flex items-center justify-between text-[11px] font-code text-[#8C9891] w-full">
              <span>•• 6917</span>
              <span className="text-[#8CE02C]">Editar renda →</span>
            </div>
          </motion.button>

          {/* Matte Metal Institution Cards */}
          {cardsToUse.map((card, cardIdx) => {
            const accentStroke =
              card.colorTheme === 'orange'
                ? 'border-[#D97706]/35'
                : card.colorTheme === 'purple'
                  ? 'border-[#8B5CF6]/35'
                  : 'border-[#334139]';

            return (
              <motion.button
                key={card.id}
                type="button"
                onClick={() => onOpenInvoiceModal(card)}
                initial={{ opacity: 0, scale: 0.98, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                whileHover={{ y: -2, transition: { duration: 0.2, ease: EDITORIAL_EASE } }}
                whileTap={{ scale: 0.985, transition: { duration: 0.1 } }}
                transition={{
                  duration: 0.36,
                  delay: Math.min(0.11 + cardIdx * 0.03, 0.22),
                  ease: EDITORIAL_EASE,
                }}
                className={`w-full min-h-[144px] rounded-2xl p-5 text-left relative overflow-hidden bg-[#111714] border ${accentStroke} flex flex-col justify-between cursor-pointer`}
              >
                <div className="relative z-10 flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <BankEmblem institution={card.name} size="sm" />
                    <span className="text-xs font-semibold text-white truncate">{card.name}</span>
                  </div>
                  <CardChipSvg className="w-6 h-4 shrink-0 opacity-75" />
                </div>

                <div className="relative z-10 my-2">
                  <div className="text-xs text-[#8C9891] truncate">
                    {card.owner === 'partner' ? 'Larissa' : 'Alan'} · {card.status}
                  </div>
                  <div className="font-display-num text-2xl font-bold text-white tabular-nums mt-1 leading-none">
                    <NumberTicker
                      value={card.currentInvoice}
                      prefix="R$ "
                      centsClassName="text-[0.58em] font-medium opacity-70"
                    />
                  </div>
                </div>

                <div className="relative z-10 flex items-center justify-between text-[11px] font-mono-num text-[#8C9891] w-full">
                  <span>Venc. {card.dueDate}</span>
                  <span>Lim. R$ {formatBRL(card.availableLimit)}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* BAND 4: 12-COLUMN ARCHITECTURAL BENTO WORKBENCH (24PX EDITORIAL GUTTERS) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT 7 COLUMNS */}
        <div className="xl:col-span-7 grid grid-cols-1 gap-6">
          {/* 1. ÚLTIMAS MOVIMENTAÇÕES PLUGGY */}
          <SpotlightBento
            as="section"
            delay={0.04}
            aria-label="Últimas movimentações Pluggy"
            className="p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="font-editorial text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                  Últimas Movimentações
                </h2>
                <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
                  {scopedTransactions.length} lançamentos reais sincronizados via Pluggy
                </p>
              </div>
              {onNavigateToCards && (
                <button
                  type="button"
                  onClick={onNavigateToCards}
                  className="min-h-[34px] px-3 py-1.5 text-xs font-semibold text-[#56AD17] dark:text-[#8CE02C] hover:bg-[#F1F3F2] dark:hover:bg-[#141C17] rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>Extrato completo</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {scopedTransactions.length === 0 ? (
              <div className="py-8 border-t border-dashed border-[#E4E7E5] dark:border-[#1B231F] text-center space-y-2.5">
                <p className="text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4]">
                  {casalScope === 'partner'
                    ? `Conta Pluggy de ${profile.partnerName} ainda não conectada`
                    : 'Nenhuma movimentação neste filtro'}
                </p>
                {casalScope === 'partner' && onNavigateToCards && (
                  <button
                    type="button"
                    onClick={onNavigateToCards}
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-[#0B130F] dark:bg-[#8CE02C] text-[#F3F5F4] dark:text-[#060807] text-xs font-semibold cursor-pointer"
                  >
                    Conectar Conta da Larissa
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#EEF0EE] dark:divide-[#18201C] text-xs">
                {scopedTransactions.slice(0, 7).map((tx) => {
                  const isPartnerTx = tx.owner === 'partner';
                  const positive = isIncomeTransaction(tx);
                  return (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {renderTxIcon(tx)}
                        <div className="min-w-0">
                          <div className="font-semibold text-[#0B110E] dark:text-[#F3F5F4] truncate">
                            {cleanTxDescription(tx.description)}
                          </div>
                          <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] truncate mt-0.5">
                            {tx.date} · {isPartnerTx ? profile.partnerName.split(' ')[0] : 'Alan'} ·{' '}
                            {tx.accountName}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`font-display-num text-sm font-bold whitespace-nowrap tabular-nums ${
                            positive
                              ? 'text-[#458B12] dark:text-[#8CE02C]'
                              : 'text-[#0B110E] dark:text-[#F3F5F4]'
                          }`}
                        >
                          <NumberTicker
                            value={tx.amount}
                            prefix={positive ? '+ R$ ' : '– R$ '}
                            centsClassName="text-[0.72em] font-medium opacity-60"
                          />
                        </div>
                        <div className="text-[10px] text-[#5C6660] dark:text-[#78847D]">
                          {tx.category === 'Investments'
                            ? 'investimento'
                            : positive
                              ? 'entrada'
                              : 'pagamento'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SpotlightBento>

          {/* 2. RITMO SEMANAL REAL */}
          <SpotlightBento
            as="section"
            delay={0.08}
            aria-label="Visão Semanal de Gastos"
            className="p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-editorial text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                  Ritmo Semanal de Gastos
                </h2>
                <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
                  Últimos 7 dias ativos nas contas Pluggy · Toque para detalhar
                </p>
              </div>
              <span className="text-xs font-mono-num text-[#5C6660] dark:text-[#8C9891]">
                {weeklySummary.rangeLabel}
              </span>
            </div>

            {activeWeekPoint && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs">
                  <span className="font-display-num font-bold text-[#0B110E] dark:text-white">
                    R$ {formatBRL(activeWeekPoint.spent)}
                  </span>
                  <span className="text-[#5C6660] dark:text-[#8C9891]">
                    em {activeWeekPoint.dateLabel} ({activeWeekPoint.day})
                  </span>
                </div>

                <div className="text-xs font-mono-num text-[#5C6660] dark:text-[#8C9891]">
                  Total 7d:{' '}
                  <strong className="text-[#0B110E] dark:text-white">
                    R$ {formatBRL(weeklySummary.weeklyTotal)}
                  </strong>
                </div>
              </div>
            )}

            <div className="mt-3 w-full overflow-hidden">
              <svg
                viewBox={`0 0 ${chartW} ${chartH + 20}`}
                className="w-full h-40 select-none overflow-visible"
                role="img"
                aria-label="Gráfico de gastos nos últimos 7 dias ativos"
              >
                <defs>
                  <linearGradient id="archBarActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#65C91D" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="#65C91D" stopOpacity="0.06" />
                  </linearGradient>
                  <linearGradient id="archLineGlow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#0B130F" />
                    <stop offset="100%" stopColor="#65C91D" />
                  </linearGradient>
                </defs>

                {pointCoords.map((pt, idx) => {
                  const isActive = idx === safeSelectedIdx;
                  return (
                    <g
                      key={pt.id}
                      onClick={() => setSelectedWeekIdx(idx)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={pt.x - 14}
                        y={8}
                        width={28}
                        height={chartH - 12}
                        rx={8}
                        fill={isActive ? 'url(#archBarActive)' : 'rgba(11, 17, 14, 0.035)'}
                      />
                      <text
                        x={pt.x}
                        y={chartH + 14}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight={isActive ? '700' : '500'}
                        fill={isActive ? '#458B12' : '#5C6660'}
                      >
                        {pt.day}
                      </text>
                    </g>
                  );
                })}

                {smoothLinePath && (
                  <path
                    d={smoothLinePath}
                    fill="none"
                    stroke="url(#archLineGlow)"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                )}

                {pointCoords.map((pt, idx) => {
                  const isActive = idx === safeSelectedIdx;
                  return (
                    <g
                      key={`dot-${pt.id}`}
                      onClick={() => setSelectedWeekIdx(idx)}
                      className="cursor-pointer"
                    >
                      {isActive && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="8"
                          fill="#65C91D"
                          fillOpacity="0.22"
                        />
                      )}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isActive ? 4.5 : 3.2}
                        fill={isActive ? '#8CE02C' : '#FFFFFF'}
                        stroke="#0B130F"
                        strokeWidth="1.8"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="mt-3 pt-3 border-t border-[#EEF0EE] dark:border-[#1B231F] flex items-center justify-between gap-4">
              <div
                className={`font-display-num text-2xl font-extrabold shrink-0 ${
                  weeklySummary.deltaPct <= 0
                    ? 'text-[#458B12] dark:text-[#8CE02C]'
                    : 'text-[#D97706] dark:text-[#F59E0B]'
                }`}
              >
                {weeklySummary.deltaPct > 0 ? '+' : ''}
                {weeklySummary.deltaPct}%
              </div>
              <p className="text-xs text-[#5C6660] dark:text-[#8C9891] leading-relaxed">
                {weeklySummary.deltaPct <= 0
                  ? `Ritmo de gastos ${Math.abs(weeklySummary.deltaPct)}% menor que a janela anterior.`
                  : `Ritmo de gastos ${weeklySummary.deltaPct}% acima da janela anterior (inclui aportes/compras).`}
              </p>
            </div>
          </SpotlightBento>

          {/* 3. DISTRIBUIÇÃO DAS ENTRADAS */}
          <SpotlightBento
            as="section"
            delay={0.12}
            aria-label="Distribuição das entradas"
            className="p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="font-editorial text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                  Distribuição das Entradas
                </h2>
                <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
                  Alocação mensal entre casa, cartões, reservas e dia a dia
                </p>
              </div>
              <button
                type="button"
                onClick={onEditSalaryClick}
                className="min-h-[34px] px-3 py-1.5 rounded-lg bg-[#F1F3F2] dark:bg-[#141C17] border border-[#E4E7E5] dark:border-[#1B231F] text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] hover:border-[#0B110E]/25 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3 text-[#56AD17]" />
                <span>Ajustar Renda</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-2.5 bg-[#F1F3F2] dark:bg-[#141C17] rounded-full overflow-hidden flex">
                <div
                  style={{
                    width: `${Math.min(100, Math.round((predicted.userHouseSharePct / Math.max(1, 100 - predicted.predictedLeftoverPct)) * 100))}%`,
                  }}
                  className="bg-[#0B130F] dark:bg-[#3A4D42] h-full transition-all duration-300"
                  title={`Sua metade da casa: R$ ${formatBRL(predicted.userHouseShare)}`}
                />
                <div
                  style={{
                    width: `${Math.min(100, Math.round((predicted.personalBillsPct / Math.max(1, 100 - predicted.predictedLeftoverPct)) * 100))}%`,
                  }}
                  className="bg-[#D97706] h-full transition-all duration-300"
                  title={`Cartões & CDB: R$ ${formatBRL(predicted.personalBillsTotal)}`}
                />
                <div
                  style={{
                    width: `${Math.max(5, Math.round((predicted.dayToDayPct / Math.max(1, 100 - predicted.predictedLeftoverPct)) * 100))}%`,
                  }}
                  className="bg-[#94A39B] h-full transition-all duration-300"
                  title={`Dia a dia: R$ ${formatBRL(predicted.dayToDayBudget)}`}
                />
              </div>
              <div
                style={{ width: `${Math.max(14, predicted.predictedLeftoverPct)}%` }}
                className="h-2.5 bg-[#65C91D] dark:bg-[#8CE02C] rounded-full transition-all duration-300"
                title={`Sobra prevista: R$ ${formatBRL(predicted.predictedLeftover)}`}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-[#EEF0EE] dark:border-[#1B231F] text-xs">
              <div>
                <div className="text-[#5C6660] dark:text-[#8C9891] text-[11px]">
                  Entradas líquidas
                </div>
                <div className="font-display-num font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-0.5">
                  R$ {formatBRL(predicted.salary)}
                </div>
              </div>

              <div>
                <div className="text-[#5C6660] dark:text-[#8C9891] text-[11px]">
                  Metade da casa
                </div>
                <div className="font-mono-num font-semibold text-[#0B110E] dark:text-[#E2E6E3] mt-0.5">
                  – R$ {formatBRL(predicted.userHouseShare)}
                </div>
              </div>

              <div>
                <div className="text-[#5C6660] dark:text-[#8C9891] text-[11px]">
                  Cartões &amp; CDB
                </div>
                <div className="font-mono-num font-semibold text-[#D97706] dark:text-[#F59E0B] mt-0.5">
                  – R$ {formatBRL(predicted.personalBillsTotal)}
                </div>
              </div>

              <div>
                <div className="text-[#5C6660] dark:text-[#8C9891] text-[11px]">
                  Dia a dia
                </div>
                <div className="font-mono-num font-semibold text-[#5C6660] dark:text-[#A4B0A9] mt-0.5">
                  – R$ {formatBRL(predicted.dayToDayBudget)}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#EEF0EE] dark:border-[#1B231F] flex sm:block items-center justify-between">
                <div className="text-[#0B110E] dark:text-[#F3F5F4] font-semibold text-[11px]">
                  Sobra livre
                </div>
                <div className="font-display-num font-bold text-[#458B12] dark:text-[#8CE02C] sm:mt-0.5">
                  R$ {formatBRL(predicted.predictedLeftover)}
                </div>
              </div>
            </div>
          </SpotlightBento>
        </div>

        {/* RIGHT 5 COLUMNS: DIVISÃO 50/50 + CONTAS & AGENDA + COMPROMETIMENTO FIXO */}
        <div className="xl:col-span-5 grid grid-cols-1 gap-6">
          {/* 1. DIVISÃO DA CASA (50/50) */}
          <SpotlightBento
            as="section"
            delay={0.06}
            id="divisao-casa"
            aria-label="Divisão da casa"
            className="p-5 sm:p-6 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-editorial text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                    Divisão da Casa (50/50)
                  </h2>
                  <p className="text-xs text-[#5C6660] dark:text-[#8C9891] mt-0.5">
                    Total compartilhado no mês
                  </p>
                </div>
                <div className="font-display-num text-xl font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                  <NumberTicker
                    value={houseSplit.totalHouseBills}
                    prefix="R$ "
                    centsClassName="text-[0.65em] font-medium opacity-55"
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <div>
                    <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">Alan paga</div>
                    <div className="font-display-num font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                      R$ {formatBRL(houseSplit.userPaidTotal)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                      {profile.partnerName.split(' ')[0]} (Namorada)
                    </div>
                    <div className="font-display-num font-bold text-[#D97706] dark:text-[#F59E0B]">
                      R$ {formatBRL(houseSplit.partnerPaidTotal)}
                    </div>
                  </div>
                </div>

                <div className="relative h-5 rounded-lg overflow-hidden flex text-[10px] font-bold text-white select-none">
                  <div
                    style={{ width: `${userSplitDisplayPct}%` }}
                    className="bg-[#0B130F] dark:bg-[#243B2E] flex items-center pl-2.5 transition-all duration-300"
                  >
                    {userSplitDisplayPct.toFixed(1).replace('.', ',')}%
                  </div>
                  <div
                    style={{ width: `${partnerSplitDisplayPct}%` }}
                    className="bg-[#D97706] text-white flex items-center justify-end pr-2.5 transition-all duration-300"
                  >
                    {partnerSplitDisplayPct.toFixed(1).replace('.', ',')}%
                  </div>
                  <div
                    className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-white dark:bg-[#0D1210] z-10"
                    title="Equilíbrio 50% / 50%"
                  />
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-[#5C6660] dark:text-[#8C9891]">
                    Contas compartilhadas ({sharedHouseBills.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => onOpenAddBillModal('house')}
                    className="min-h-[32px] px-2 -mr-2 text-xs font-semibold text-[#56AD17] dark:text-[#8CE02C] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nova despesa
                  </button>
                </div>

                <ul className="divide-y divide-[#EEF0EE] dark:divide-[#18201C] text-xs">
                  {visibleSharedBills.map((item) => (
                    <li
                      key={item.id}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-[10px] font-mono-num font-bold shrink-0 ${
                            item.paidBy === 'user'
                              ? 'text-[#0B110E] dark:text-[#8CE02C]'
                              : 'text-[#D97706]'
                          }`}
                        >
                          {item.paidBy === 'user' ? 'AL' : 'LF'}
                        </span>
                        <span className="text-[#0B110E] dark:text-[#E2E6E3] truncate">
                          {item.title}
                        </span>
                      </div>
                      <span className="font-mono-num font-semibold text-[#0B110E] dark:text-[#F3F5F4] whitespace-nowrap">
                        R$ {formatBRL(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>

                {sharedHouseBills.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSharedBills((prev) => !prev)}
                    className="mt-1.5 text-[11px] font-semibold text-[#56AD17] dark:text-[#8CE02C] hover:underline cursor-pointer"
                  >
                    {showAllSharedBills
                      ? 'Mostrar resumo'
                      : `Ver todas (${sharedHouseBills.length})`}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-[#EEF0EE] dark:border-[#1B231F] flex items-center justify-between gap-2">
              <p className="text-xs text-[#5C6660] dark:text-[#A4B0A9] truncate">
                {profile.pixSettled
                  ? `Pix de R$ ${formatBRL(houseSplit.pixSettlementAmount)} acertado`
                  : houseSplit.whoOwesWhom === 'partner_owes_user'
                    ? `${profile.partnerName.split(' ')[0]} devolve R$ ${formatBRL(
                        houseSplit.pixSettlementAmount
                      )}`
                    : `Você devolve R$ ${formatBRL(houseSplit.pixSettlementAmount)}`}
              </p>
              <button
                type="button"
                onClick={() => onSettlePix(!profile.pixSettled)}
                className={`min-h-[36px] px-3.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  profile.pixSettled
                    ? 'bg-[#ECF7E1] dark:bg-[#142919] border-[#8CE02C]/45 text-[#3B7A1E] dark:text-[#8CE02C]'
                    : 'bg-[#F1F3F2] dark:bg-[#141C17] border-[#E4E7E5] dark:border-[#1B231F] text-[#0B110E] dark:text-[#F3F5F4]'
                }`}
              >
                {profile.pixSettled ? 'Feito ✓' : 'Marcar feito'}
              </button>
            </div>
          </SpotlightBento>

          {/* 2. CONTAS & AGENDA */}
          <SpotlightBento
            as="section"
            delay={0.1}
            id="contas-agenda"
            aria-label="Contas e compromissos"
            className="p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-editorial text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                  Contas &amp; Agenda
                </h2>
                <p className="text-xs text-[#5C6660] dark:text-[#8C9891] mt-0.5">
                  {selectedDayTab === 'all'
                    ? 'Todos os vencimentos do mês'
                    : `Vencimento dia ${selectedDayTab < 10 ? `0${selectedDayTab}` : selectedDayTab}`}
                </p>
              </div>
              <div className="text-right">
                <div className="font-display-num text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                  R$ {formatBRL(totalPayableAmount)}
                </div>
                <div className="text-[11px] font-semibold text-[#56AD17] dark:text-[#8CE02C]">
                  {paidBillsCount}/{payableBills.length} quitadas
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setSelectedDayTab('all')}
                className={`min-w-[60px] min-h-[44px] px-2.5 py-1.5 rounded-lg flex flex-col items-center justify-center transition-all text-[11px] font-bold cursor-pointer shrink-0 ${
                  selectedDayTab === 'all'
                    ? 'bg-[#0B130F] dark:bg-[#8CE02C] text-[#F3F5F4] dark:text-[#060807]'
                    : 'bg-[#F1F3F2] dark:bg-[#141C17] text-[#5C6660] dark:text-[#A4B0A9]'
                }`}
              >
                <span>Todas</span>
                <span className="text-[10px] font-normal opacity-80">{payableBills.length}</span>
              </button>
              {dayTabs.map(({ day, count }) => {
                const isSelected = selectedDayTab === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDayTab(isSelected ? 'all' : day)}
                    aria-label={`Filtrar contas do dia ${day}`}
                    className={`min-w-[50px] min-h-[44px] px-2.5 py-1.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? 'bg-[#0B130F] dark:bg-[#8CE02C] text-[#F3F5F4] dark:text-[#060807]'
                        : 'bg-[#F1F3F2] dark:bg-[#141C17] text-[#5C6660] dark:text-[#A4B0A9]'
                    }`}
                  >
                    <span className="font-mono-num text-xs font-bold">
                      {day < 10 ? `0${day}` : day}
                    </span>
                    <span className="text-[9px] opacity-75">{count}x</span>
                  </button>
                );
              })}
            </div>

            <ul className="mt-3 divide-y divide-[#EEF0EE] dark:divide-[#18201C] text-xs">
              {displayedPayableBills.map((bill) => (
                <li key={bill.id} className="group">
                  <button
                    type="button"
                    onClick={() => onToggleBillPaid(bill.id, !bill.isPaid)}
                    className="w-full min-h-[44px] py-2.5 flex items-center justify-between gap-2.5 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                          bill.isPaid
                            ? 'bg-[#8CE02C] border-[#8CE02C] text-[#060807]'
                            : 'border-[#CFD5D1] dark:border-[#2E3D35] group-hover:border-[#0B110E]'
                        }`}
                      >
                        {bill.isPaid && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <div className="min-w-0">
                        <span
                          className={`block truncate transition-colors ${
                            bill.isPaid
                              ? 'text-[#5C6660] dark:text-[#78847D] font-normal'
                              : 'text-[#0B110E] dark:text-[#F3F5F4] font-semibold'
                          }`}
                        >
                          {bill.title}
                        </span>
                        <span className="text-[11px] text-[#5C6660] dark:text-[#78847D]">
                          Dia {bill.dueDay < 10 ? `0${bill.dueDay}` : bill.dueDay} ·{' '}
                          {bill.isPaid ? 'Quitada' : 'Em aberto'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`font-mono-num font-semibold whitespace-nowrap shrink-0 ${
                        bill.isPaid
                          ? 'text-[#458B12] dark:text-[#8CE02C]'
                          : 'text-[#0B110E] dark:text-[#F3F5F4]'
                      }`}
                    >
                      R$ {formatBRL(bill.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {selectedDayTab === 'all' && filteredPayableBills.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllPayableBills((prev) => !prev)}
                className="mt-2 text-[11px] font-semibold text-[#56AD17] dark:text-[#8CE02C] hover:underline cursor-pointer"
              >
                {showAllPayableBills
                  ? 'Mostrar resumo'
                  : `Ver todas (${filteredPayableBills.length})`}
              </button>
            )}
          </SpotlightBento>

          {/* 3. COMPROMETIMENTO FIXO */}
          <SpotlightBento
            as="section"
            delay={0.14}
            aria-label="Moradia e Custos Fixos"
            className="p-5 sm:p-6"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-editorial text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                  Comprometimento Fixo
                </h2>
                <p className="text-xs text-[#5C6660] dark:text-[#8C9891] mt-0.5">
                  R$ {formatBRL(housingBenchmark.activeHousingCost)} · Meta saudável até 30%
                </p>
              </div>
              <CircularGaugeSvg
                valuePct={Math.min(100, Math.round((housingBenchmark.housingPctOfSalary / 30) * 100))}
                size={52}
                strokeWidth={4.5}
                trackColor="rgba(101,201,29,0.16)"
                fillColor={housingBenchmark.isWithinRecommended30Pct ? '#65C91D' : '#D97706'}
                label={`${housingBenchmark.housingPctOfSalary}%`}
                labelClassName="text-[#0B110E] dark:text-[#F3F5F4]"
              />
            </div>

            <div className="mt-4">
              <AnimatedSegmentedControl
                layoutId="housing-benchmark-mode"
                ariaLabel="Base salarial do índice fixo"
                className="w-full grid grid-cols-2"
                value={housingMode}
                onChange={setHousingMode}
                options={[
                  { id: 'solo', label: 'Renda Alan' },
                  { id: 'couple', label: 'Renda do casal' },
                ]}
              />
            </div>

            <div className="mt-4">
              <div className="relative h-2 bg-[#F1F3F2] dark:bg-[#141C17] rounded-full overflow-visible flex items-center">
                <div
                  style={{
                    width: `${Math.min(100, Math.round((housingBenchmark.housingPctOfSalary / 60) * 100))}%`,
                  }}
                  className={`h-full rounded-l-full transition-all duration-300 ${
                    housingBenchmark.isWithinRecommended30Pct ? 'bg-[#65C91D]' : 'bg-[#D97706]'
                  }`}
                />
                <div className="absolute left-1/2 -top-1 -bottom-1 w-0.5 bg-[#0B110E] dark:bg-white" />
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#5C6660] dark:text-[#78847D] mt-1.5">
                <span>0%</span>
                <span>30% ideal</span>
                <span>60%</span>
              </div>
            </div>

            <ul className="mt-4 pt-2 border-t border-[#EEF0EE] dark:border-[#1B231F] divide-y divide-[#EEF0EE] dark:divide-[#18201C]">
              {housingBenchmark.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-[#F1F3F2] dark:bg-[#141C17] flex items-center justify-center shrink-0">
                      {renderHousingIcon(item.iconType)}
                    </span>
                    <span className="text-xs font-medium text-[#0B110E] dark:text-[#E2E6E3] truncate">
                      {item.title}
                    </span>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-[#0B110E] dark:text-[#F3F5F4] whitespace-nowrap shrink-0">
                    R$ {formatBRL(item.displayAmount)}
                  </span>
                </li>
              ))}
            </ul>
          </SpotlightBento>
        </div>
      </div>

      {/* BAND 5: D3.JS CATEGORY SPENDING TREEMAP & CIRCLE PACKING DASHBOARD */}
      <CategorySpendingD3Map
        transactions={scopedTransactions}
        bills={scopedBills}
        partnerName={profile.partnerName}
        instanceId="overview"
      />

      {/* BAND 6: ARCHITECTURAL BRIDGE TO FLUXO & PLANILHA VIVA / COPILOTO AI */}
      <SpotlightBento
        as="section"
        delay={0.14}
        aria-label="Estúdio Analítico e Copiloto AI"
        className="p-5 sm:p-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-[#F1F3F2] dark:bg-[#141C17] text-[#458B12] dark:text-[#8CE02C] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-editorial text-base sm:text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                Estúdio de Gráficos, Planilha Viva &amp; Simulador CDI
              </h2>
              <p className="text-xs text-[#5C6660] dark:text-[#8C9891] mt-0.5">
                Explore os 5 motores de gráficos anuais, edite a matriz orçamentária para Excel e
                simule projeções em 100% CDI com seus {scopedTransactions.length} lançamentos reais.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onOpenCopilot && (
              <button
                type="button"
                onClick={onOpenCopilot}
                className="min-h-[38px] px-4 py-2 rounded-lg bg-[#F1F3F2] dark:bg-[#141C17] border border-[#E4E7E5] dark:border-[#1B231F] hover:border-[#0B110E]/25 text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Bot className="w-3.5 h-3.5 text-[#56AD17] dark:text-[#8CE02C]" />
                <span>Resumir com Copiloto AI</span>
              </button>
            )}

            {onNavigateSection && (
              <button
                type="button"
                onClick={() => onNavigateSection('cashflow')}
                className="min-h-[38px] px-4 py-2 rounded-lg bg-[#0B130F] dark:bg-[#8CE02C] hover:opacity-90 text-[#F3F5F4] dark:text-[#060807] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-opacity"
              >
                <Table2 className="w-3.5 h-3.5 text-[#8CE02C] dark:text-[#060807]" />
                <span>Abrir Fluxo &amp; Planilha</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </SpotlightBento>
    </div>
  );
}
