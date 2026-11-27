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
        return <KeyRound className="w-3.5 h-3.5 text-[#111110] dark:text-[#6088FF]" />;
      case 'crane':
        return <Triangle className="w-3.5 h-3.5 text-[#111110] dark:text-[#6088FF]" />;
      case 'card':
        return <CardIcon className="w-3.5 h-3.5 text-[#111110] dark:text-[#6088FF]" />;
      case 'building':
        return <Building2 className="w-3.5 h-3.5 text-[#111110] dark:text-[#6088FF]" />;
      case 'zap':
        return <Zap className="w-3.5 h-3.5 text-[#111110] dark:text-[#6088FF]" />;
      case 'wifi':
        return <Wifi className="w-3.5 h-3.5 text-[#111110] dark:text-[#6088FF]" />;
      default:
        return <Building2 className="w-3.5 h-3.5 text-[#111110] dark:text-[#6088FF]" />;
    }
  };

  const renderTxIcon = (tx: TransactionRecord) => {
    const desc = tx.description.toLowerCase();
    if (desc.includes('nubank') || desc.includes('inter') || desc.includes('santander')) {
      return <BankEmblem institution={tx.accountName} size="md" />;
    }
    if (desc.includes('carioca') || desc.includes('supermercado') || tx.category === 'Groceries') {
      return (
        <span className="w-8 h-8 rounded-xs bg-[#F3F3EF] dark:bg-[#161619] border border-[#E2E2DC] dark:border-[#242429] text-[#111110] dark:text-[#F5F5F2] flex items-center justify-center shrink-0">
          <ShoppingCart className="w-3.5 h-3.5" />
        </span>
      );
    }
    if (tx.category === 'Investments' || desc.includes('cdb')) {
      return (
        <span className="w-8 h-8 rounded-xs bg-[#0F766E]/10 dark:bg-[#2DD4BF]/15 text-[#0F766E] dark:text-[#2DD4BF] flex items-center justify-center shrink-0">
          <TrendingUp className="w-3.5 h-3.5" />
        </span>
      );
    }
    if (isIncomeTransaction(tx)) {
      return (
        <span className="w-8 h-8 rounded-xs bg-[#1D4ED8]/10 dark:bg-[#6088FF]/15 text-[#1D4ED8] dark:text-[#6088FF] flex items-center justify-center shrink-0">
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
      {/* BAND 1: OPEN SWISS BROADSHEET HERO (No Dark Box Cliché — Monumental Paper & Ink Architecture) */}
      <motion.section
        aria-label="Resumo financeiro principal"
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.34, ease: EDITORIAL_EASE }}
        className="border-t-2 border-[#111110] dark:border-[#F5F5F2] border-b border-b-[#E2E2DC] dark:border-b-[#242429] pt-5 pb-7"
      >
        {/* Broadsheet Masthead Strip */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-[#E2E2DC] dark:border-[#242429]">
          <div className="min-w-0">
            <div className="text-[11px] font-mono-num uppercase tracking-[0.12em] text-[#5A5A54] dark:text-[#8E8E96]">
              Patrimônio &amp; Fluxo do Casal · {connectedCount}/2 Pluggy ativo
            </div>
            <h1 className="font-broadsheet text-3xl sm:text-4xl font-semibold text-[#111110] dark:text-[#F5F5F2] leading-[1.08] mt-1">
              {profile.displayName.split(' ')[0]}{' '}
              <span className="font-accent-serif text-[#1D4ED8] dark:text-[#6088FF] font-normal">
                &amp;
              </span>{' '}
              {profile.partnerName.split(' ')[0]}
            </h1>
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
                className="min-h-[36px] px-3 py-1.5 rounded-sm bg-white dark:bg-[#111113] hover:border-[#111110] dark:hover:border-[#6088FF] border border-[#D8D8D0] dark:border-[#242429] text-xs font-medium text-[#111110] dark:text-[#F5F5F2] flex items-center justify-between sm:justify-start gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span className="text-[#5A5A54] dark:text-[#8E8E96]">
                  Alan ({alanSlot?.status === 'pending' ? 'Pendente' : 'Ativo'})
                </span>
                <span className="text-[#D0D0C8] dark:text-[#2E2E36]">/</span>
                <span className="font-semibold text-[#1D4ED8] dark:text-[#6088FF]">
                  Larissa ({larissaSlot?.status === 'connected' ? 'Ativo' : 'Conectar'})
                </span>
                <Link2 className="w-3.5 h-3.5 text-[#1D4ED8] dark:text-[#6088FF] shrink-0" />
              </button>
            )}
          </div>
        </div>

        {/* Monumental Asymmetric Ledger Split: 7 Cols Giant Figure | 5 Cols Projection & Actions */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-7 flex items-center justify-between sm:justify-start gap-8 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-medium text-[#5A5A54] dark:text-[#8E8E96]">
                <span className="uppercase tracking-[0.08em] font-mono-num text-[11px]">
                  {balanceLabel}
                </span>
                <button
                  type="button"
                  onClick={onEditSalaryClick}
                  aria-label="Editar renda e orçamento"
                  className="p-1 rounded-xs hover:bg-[#EAEAE4] dark:hover:bg-[#1B1B20] text-[#1D4ED8] dark:text-[#6088FF] transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="mt-2 font-display-num text-[44px] sm:text-[62px] font-extrabold tracking-tight text-[#111110] dark:text-[#F5F5F2] leading-[0.98] tabular-nums">
                <NumberTicker
                  value={consolidatedBalance}
                  prefix="R$ "
                  centsClassName="text-[0.44em] font-semibold text-[#5A5A54] dark:text-[#8E8E96]"
                />
              </div>

              <p className="text-xs font-mono-num text-[#5A5A54] dark:text-[#8E8E96] mt-3.5">
                Livre <strong className="text-[#111110] dark:text-[#F5F5F2]">R$ {formatBRL(predicted.predictedLeftover)}</strong> · Reservas CDB{' '}
                <strong className="text-[#0F766E] dark:text-[#2DD4BF]">R$ {formatBRL(totalLiquidity)}</strong> (100% CDI)
              </p>
            </div>

            <div className="shrink-0 pl-4 sm:pl-8 border-l border-[#E2E2DC] dark:border-[#242429]">
              <CircularGaugeSvg
                valuePct={predicted.predictedLeftoverPct}
                size={74}
                strokeWidth={4.5}
                trackColor="rgba(128,128,128,0.16)"
                fillColor="#1D4ED8"
                label={`${predicted.predictedLeftoverPct}%`}
                sublabel="livre"
              />
            </div>
          </div>

          {/* Right 5 Cols: Engraved Invoice Projection Ledger + Razor-Edged Primary Actions */}
          <div className="lg:col-span-5 lg:border-l lg:border-[#E2E2DC] lg:dark:border-[#242429] lg:pl-8 flex flex-col gap-4">
            <div className="grid grid-cols-3 divide-x divide-[#E2E2DC] dark:divide-[#242429] border-y border-[#E2E2DC] dark:border-[#242429] py-3">
              <div className="pr-3 min-w-0">
                <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#5A5A54] dark:text-[#8E8E96]">
                  Fatura Nov
                </div>
                <div className="font-mono-num text-sm sm:text-base font-bold text-[#111110] dark:text-[#F5F5F2] truncate mt-1">
                  R$ {formatBRL(invoiceNov)}
                </div>
              </div>

              <div className="px-3 min-w-0">
                <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#5A5A54] dark:text-[#8E8E96]">
                  Projeção Dez
                </div>
                <div className="font-mono-num text-sm sm:text-base font-bold text-[#5A5A54] dark:text-[#B4B4BC] truncate mt-1">
                  R$ {formatBRL(invoiceDez)}
                </div>
              </div>

              <div className="pl-3 min-w-0">
                <div className="text-[10px] font-mono-num uppercase tracking-wider text-[#0F766E] dark:text-[#2DD4BF]">
                  Alívio Jan
                </div>
                <div className="font-mono-num text-sm sm:text-base font-bold text-[#0F766E] dark:text-[#2DD4BF] truncate mt-1">
                  R$ {formatBRL(invoiceJan)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <ShimmerActionButton
                type="button"
                variant="cobalt"
                onClick={() => onOpenAddBillModal('house')}
                className="min-h-[42px] w-full px-4 py-2 rounded-sm text-xs sm:text-[13px] font-semibold whitespace-nowrap"
              >
                <Plus className="w-4 h-4 stroke-[2.2]" />
                <span>Nova Despesa</span>
              </ShimmerActionButton>

              <button
                type="button"
                disabled={isQuickSyncing}
                onClick={handleQuickSyncClick}
                className="min-h-[42px] w-full px-4 py-2 rounded-sm bg-white dark:bg-[#111113] hover:border-[#111110] dark:hover:border-[#6088FF] disabled:opacity-60 border border-[#D4D4CC] dark:border-[#2C2C34] text-[#111110] dark:text-[#F5F5F2] text-xs sm:text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#1D4ED8] dark:text-[#6088FF] ${isQuickSyncing ? 'animate-spin' : ''}`}
                />
                <span>{isQuickSyncing ? 'Sincronizando...' : 'Sync Pluggy'}</span>
              </button>
            </div>
          </div>
        </div>
      </motion.section>

      {/* BAND 2: ARCHITECTURAL 3-COLUMN BROADSHEET KPI LEDGER */}
      <motion.section
        aria-label="Indicadores de saldo e equilíbrio"
        initial={{ opacity: 0, scale: 0.98, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.34, delay: 0.04, ease: EDITORIAL_EASE }}
        className="bento-card rounded-sm bg-white dark:bg-[#111113] border border-[#E2E2DC] dark:border-[#242429] grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2E2DC] dark:divide-[#242429] overflow-hidden"
      >
        <button
          type="button"
          onClick={onEditSalaryClick}
          className="w-full p-5 sm:p-6 text-left flex flex-col justify-between gap-4 hover:bg-[#FAFAF8] dark:hover:bg-[#161619] transition-colors cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-mono-num uppercase tracking-wider text-[#5A5A54] dark:text-[#8E8E96]">
                Saldo livre previsto
              </div>
              <div className="mt-2 font-display-num text-[30px] font-bold text-[#111110] dark:text-white leading-none tabular-nums">
                <NumberTicker
                  value={predicted.predictedLeftover}
                  prefix="R$ "
                  centsClassName="text-[0.55em] font-medium opacity-55"
                />
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#5A5A54] group-hover:text-[#1D4ED8] dark:group-hover:text-[#6088FF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono-num text-[#5A5A54] dark:text-[#8E8E96]">
            <span>Entradas R$ {formatBRL(predicted.salary)}</span>
            <span className="font-sans font-semibold text-[#1D4ED8] dark:text-[#6088FF]">
              Ajustar renda
            </span>
          </div>
        </button>

        <div className="w-full p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-mono-num uppercase tracking-wider text-[#5A5A54] dark:text-[#8E8E96]">
                Acerto 50/50 · Casa
              </div>
              <div className="mt-2 font-display-num text-[30px] font-bold text-[#C83E2B] dark:text-[#F9735B] leading-none tabular-nums">
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
                className="min-h-[32px] px-2.5 py-1 rounded-xs bg-[#F3F3EF] dark:bg-[#161619] border border-[#E2E2DC] dark:border-[#242429] hover:border-[#111110] text-[11px] font-semibold text-[#111110] dark:text-[#F5F5F2] flex items-center gap-1 cursor-pointer transition-colors"
              >
                {pixCopied ? (
                  <Check className="w-3 h-3 text-[#0F766E] dark:text-[#2DD4BF]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{pixCopied ? 'Copiado' : 'Pix'}</span>
              </button>
              <button
                type="button"
                onClick={() => onSettlePix(!profile.pixSettled)}
                className={`min-h-[32px] px-3 py-1 rounded-xs text-[11px] font-bold cursor-pointer transition-colors ${
                  profile.pixSettled
                    ? 'bg-[#0F766E]/12 dark:bg-[#2DD4BF]/15 text-[#0F766E] dark:text-[#2DD4BF]'
                    : 'bg-[#111110] dark:bg-[#F5F5F2] text-white dark:text-[#09090B]'
                }`}
              >
                {profile.pixSettled ? 'Quitado ✓' : 'Quitar'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#5A5A54] dark:text-[#8E8E96]">
            <span>Direção do Pix</span>
            <span className="font-semibold text-[#111110] dark:text-[#F5F5F2]">
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
          className="w-full p-5 sm:p-6 text-left flex flex-col justify-between gap-4 hover:bg-[#FAFAF8] dark:hover:bg-[#161619] transition-colors cursor-pointer group"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-mono-num uppercase tracking-wider text-[#5A5A54] dark:text-[#8E8E96]">
                Liquidez CDB (100% CDI)
              </div>
              <div className="mt-2 font-display-num text-[30px] font-bold text-[#0F766E] dark:text-[#2DD4BF] leading-none tabular-nums">
                <NumberTicker
                  value={totalLiquidity}
                  prefix="R$ "
                  centsClassName="text-[0.55em] font-medium opacity-55"
                />
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#5A5A54] group-hover:text-[#0F766E] dark:group-hover:text-[#2DD4BF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono-num text-[#5A5A54] dark:text-[#8E8E96]">
            <span>
              Contas {paidBillsCount}/{payableBills.length} (R$ {formatBRL(totalPayableAmount)})
            </span>
            <span className="font-sans font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
              Ver reserva
            </span>
          </div>
        </button>
      </motion.section>

      {/* BAND 3: TACTILE BRUSHED-PLATE BANK CARDS (RESPONSIVE 1 -> 2 -> 4 COLS, 24PX EDITORIAL GAP) */}
      <section aria-label="Cartões e contas Pluggy" className="grid grid-cols-1 gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2 pb-2 border-b border-[#E2E2DC] dark:border-[#242429]">
          <div>
            <h2 className="font-broadsheet text-xl font-semibold text-[#111110] dark:text-[#F5F5F2]">
              Cartões &amp; Contas <span className="font-accent-serif text-[#1D4ED8] dark:text-[#6088FF] font-normal">Pluggy</span>
            </h2>
            <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] mt-0.5">
              Entradas e faturas sincronizadas via Open Finance
            </p>
          </div>
          {onNavigateToCards && (
            <button
              type="button"
              onClick={onNavigateToCards}
              className="min-h-[34px] px-3 py-1 rounded-xs bg-white dark:bg-[#111113] border border-[#D4D4CC] dark:border-[#242429] hover:border-[#111110] dark:hover:border-[#6088FF] text-xs font-semibold text-[#111110] dark:text-[#F5F5F2] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#1D4ED8] dark:text-[#6088FF]" />
              <span>Gerenciar 2 Contas</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Klein Cobalt Signature Income Plate */}
          <motion.button
            type="button"
            onClick={onEditSalaryClick}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            whileHover={{ y: -2, transition: { duration: 0.2, ease: EDITORIAL_EASE } }}
            whileTap={{ scale: 0.985, transition: { duration: 0.1 } }}
            transition={{ duration: 0.34, delay: 0.06, ease: EDITORIAL_EASE }}
            className="w-full min-h-[146px] rounded-md p-5 text-left relative overflow-hidden bg-[#1D4ED8] dark:bg-[#1E3A8A] border border-[#1E40AF] dark:border-[#3B5FD9] text-white flex flex-col justify-between cursor-pointer"
          >
            <div className="relative z-10 flex items-center justify-between w-full">
              <span className="text-[10px] font-mono-num uppercase tracking-[0.12em] text-white/80">
                Entradas · PIX 50/50
              </span>
              <Wifi className="w-4 h-4 rotate-90 text-white/75" />
            </div>

            <div className="relative z-10 my-2">
              <div className="text-xs text-white/75 font-medium">
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

            <div className="relative z-10 flex items-center justify-between text-[11px] font-code text-white/80 w-full">
              <span>•• 6917</span>
              <span className="font-sans font-semibold text-white">Editar renda →</span>
            </div>
          </motion.button>

          {/* Architectural Obsidian Institution Plates */}
          {cardsToUse.map((card, cardIdx) => {
            const topBarColor =
              card.colorTheme === 'orange'
                ? 'bg-[#EA580C]'
                : card.colorTheme === 'purple'
                  ? 'bg-[#7C3AED]'
                  : 'bg-[#C83E2B]';

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
                  duration: 0.34,
                  delay: Math.min(0.09 + cardIdx * 0.03, 0.2),
                  ease: EDITORIAL_EASE,
                }}
                className="w-full min-h-[146px] rounded-md p-5 text-left relative overflow-hidden bg-[#141416] dark:bg-[#141418] border border-[#2A2A32] flex flex-col justify-between cursor-pointer"
              >
                <span aria-hidden="true" className={`absolute top-0 left-0 right-0 h-[2px] ${topBarColor}`} />

                <div className="relative z-10 flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <BankEmblem institution={card.name} size="sm" />
                    <span className="text-xs font-semibold text-white truncate">{card.name}</span>
                  </div>
                  <CardChipSvg className="w-6 h-4 shrink-0 opacity-75" />
                </div>

                <div className="relative z-10 my-2">
                  <div className="text-xs text-[#9A9AA4] truncate">
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

                <div className="relative z-10 flex items-center justify-between text-[11px] font-mono-num text-[#9A9AA4] w-full">
                  <span>Venc. {card.dueDate}</span>
                  <span>Lim. R$ {formatBRL(card.availableLimit)}</span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* BAND 4: 12-COLUMN ARCHITECTURAL LEDGER WORKBENCH (24PX EDITORIAL GUTTERS) */}
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
            <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-[#E2E2DC] dark:border-[#242429]">
              <div>
                <h2 className="font-broadsheet text-xl font-semibold text-[#111110] dark:text-[#F5F5F2]">
                  Últimas Movimentações
                </h2>
                <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] mt-0.5">
                  {scopedTransactions.length} lançamentos reais sincronizados via Pluggy
                </p>
              </div>
              {onNavigateToCards && (
                <button
                  type="button"
                  onClick={onNavigateToCards}
                  className="min-h-[34px] px-3 py-1 text-xs font-semibold text-[#1D4ED8] dark:text-[#6088FF] hover:bg-[#F3F3EF] dark:hover:bg-[#161619] rounded-xs transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>Extrato completo</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {scopedTransactions.length === 0 ? (
              <div className="py-8 text-center space-y-2.5">
                <p className="text-xs font-semibold text-[#111110] dark:text-[#F5F5F2]">
                  {casalScope === 'partner'
                    ? `Conta Pluggy de ${profile.partnerName} ainda não conectada`
                    : 'Nenhuma movimentação neste filtro'}
                </p>
                {casalScope === 'partner' && onNavigateToCards && (
                  <button
                    type="button"
                    onClick={onNavigateToCards}
                    className="min-h-[38px] px-4 py-2 rounded-xs bg-[#111110] dark:bg-[#F5F5F2] text-white dark:text-[#09090B] text-xs font-semibold cursor-pointer"
                  >
                    Conectar Conta da Larissa
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#ECECE6] dark:divide-[#1D1D22] text-xs mt-1">
                {scopedTransactions.slice(0, 7).map((tx) => {
                  const isPartnerTx = tx.owner === 'partner';
                  const positive = isIncomeTransaction(tx);
                  return (
                    <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {renderTxIcon(tx)}
                        <div className="min-w-0">
                          <div className="font-semibold text-[#111110] dark:text-[#F5F5F2] truncate">
                            {cleanTxDescription(tx.description)}
                          </div>
                          <div className="text-[11px] font-mono-num text-[#5A5A54] dark:text-[#8E8E96] truncate mt-0.5">
                            {tx.date} · {isPartnerTx ? profile.partnerName.split(' ')[0] : 'Alan'} ·{' '}
                            {tx.accountName}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono-num text-sm font-bold whitespace-nowrap tabular-nums ${
                            positive
                              ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                              : 'text-[#111110] dark:text-[#F5F5F2]'
                          }`}
                        >
                          <NumberTicker
                            value={tx.amount}
                            prefix={positive ? '+ R$ ' : '– R$ '}
                            centsClassName="text-[0.72em] font-medium opacity-60"
                          />
                        </div>
                        <div className="text-[10px] text-[#5A5A54] dark:text-[#8E8E96]">
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
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E2E2DC] dark:border-[#242429]">
              <div>
                <h2 className="font-broadsheet text-xl font-semibold text-[#111110] dark:text-[#F5F5F2]">
                  Ritmo Semanal de Gastos
                </h2>
                <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] mt-0.5">
                  Últimos 7 dias ativos nas contas Pluggy · Toque para detalhar
                </p>
              </div>
              <span className="text-xs font-mono-num text-[#5A5A54] dark:text-[#8E8E96]">
                {weeklySummary.rangeLabel}
              </span>
            </div>

            {activeWeekPoint && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs">
                  <span className="font-mono-num font-bold text-[#1D4ED8] dark:text-[#6088FF]">
                    R$ {formatBRL(activeWeekPoint.spent)}
                  </span>
                  <span className="text-[#5A5A54] dark:text-[#8E8E96]">
                    em {activeWeekPoint.dateLabel} ({activeWeekPoint.day})
                  </span>
                </div>

                <div className="text-xs font-mono-num text-[#5A5A54] dark:text-[#8E8E96]">
                  Total 7d:{' '}
                  <strong className="text-[#111110] dark:text-white">
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
                    <stop offset="0%" stopColor="#1D4ED8" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.03" />
                  </linearGradient>
                  <linearGradient id="archLineGlow" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#111110" />
                    <stop offset="100%" stopColor="#1D4ED8" />
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
                        rx={2}
                        fill={isActive ? 'url(#archBarActive)' : 'rgba(17, 17, 16, 0.03)'}
                      />
                      <text
                        x={pt.x}
                        y={chartH + 14}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight={isActive ? '700' : '500'}
                        fill={isActive ? '#1D4ED8' : '#74746C'}
                        className="font-mono-num"
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
                    strokeWidth="2.2"
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
                          fill="#1D4ED8"
                          fillOpacity="0.18"
                        />
                      )}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isActive ? 4.5 : 3}
                        fill={isActive ? '#1D4ED8' : '#FFFFFF'}
                        stroke="#111110"
                        strokeWidth="1.8"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="mt-3 pt-3 border-t border-[#E2E2DC] dark:border-[#242429] flex items-center justify-between gap-4">
              <div
                className={`font-mono-num text-2xl font-bold shrink-0 ${
                  weeklySummary.deltaPct <= 0
                    ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                    : 'text-[#C83E2B] dark:text-[#F9735B]'
                }`}
              >
                {weeklySummary.deltaPct > 0 ? '+' : ''}
                {weeklySummary.deltaPct}%
              </div>
              <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] leading-relaxed">
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
                <h2 className="font-broadsheet text-xl font-semibold text-[#111110] dark:text-[#F5F5F2]">
                  Distribuição das Entradas
                </h2>
                <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] mt-0.5">
                  Alocação mensal entre casa, cartões, reservas e dia a dia
                </p>
              </div>
              <button
                type="button"
                onClick={onEditSalaryClick}
                className="min-h-[34px] px-3 py-1 rounded-xs bg-[#F3F3EF] dark:bg-[#161619] border border-[#E2E2DC] dark:border-[#242429] text-xs font-semibold text-[#111110] dark:text-[#F5F5F2] hover:border-[#111110] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3 text-[#1D4ED8] dark:text-[#6088FF]" />
                <span>Ajustar Renda</span>
              </button>
            </div>

            <div className="flex items-center gap-1">
              <div className="flex-1 h-2.5 bg-[#F3F3EF] dark:bg-[#161619] rounded-xs overflow-hidden flex">
                <div
                  style={{
                    width: `${Math.min(100, Math.round((predicted.userHouseSharePct / Math.max(1, 100 - predicted.predictedLeftoverPct)) * 100))}%`,
                  }}
                  className="bg-[#111110] dark:bg-[#4B4B57] h-full transition-all duration-300"
                  title={`Sua metade da casa: R$ ${formatBRL(predicted.userHouseShare)}`}
                />
                <div
                  style={{
                    width: `${Math.min(100, Math.round((predicted.personalBillsPct / Math.max(1, 100 - predicted.predictedLeftoverPct)) * 100))}%`,
                  }}
                  className="bg-[#C83E2B] dark:bg-[#F9735B] h-full transition-all duration-300"
                  title={`Cartões & CDB: R$ ${formatBRL(predicted.personalBillsTotal)}`}
                />
                <div
                  style={{
                    width: `${Math.max(5, Math.round((predicted.dayToDayPct / Math.max(1, 100 - predicted.predictedLeftoverPct)) * 100))}%`,
                  }}
                  className="bg-[#9A9A92] h-full transition-all duration-300"
                  title={`Dia a dia: R$ ${formatBRL(predicted.dayToDayBudget)}`}
                />
              </div>
              <div
                style={{ width: `${Math.max(14, predicted.predictedLeftoverPct)}%` }}
                className="h-2.5 bg-[#1D4ED8] dark:bg-[#6088FF] rounded-xs transition-all duration-300"
                title={`Sobra prevista: R$ ${formatBRL(predicted.predictedLeftover)}`}
              />
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-[#E2E2DC] dark:border-[#242429] text-xs">
              <div>
                <div className="text-[#5A5A54] dark:text-[#8E8E96] text-[11px]">
                  Entradas líquidas
                </div>
                <div className="font-mono-num font-bold text-[#111110] dark:text-[#F5F5F2] mt-0.5">
                  R$ {formatBRL(predicted.salary)}
                </div>
              </div>

              <div>
                <div className="text-[#5A5A54] dark:text-[#8E8E96] text-[11px]">
                  Metade da casa
                </div>
                <div className="font-mono-num font-semibold text-[#111110] dark:text-[#D4D4DC] mt-0.5">
                  – R$ {formatBRL(predicted.userHouseShare)}
                </div>
              </div>

              <div>
                <div className="text-[#5A5A54] dark:text-[#8E8E96] text-[11px]">
                  Cartões &amp; CDB
                </div>
                <div className="font-mono-num font-semibold text-[#C83E2B] dark:text-[#F9735B] mt-0.5">
                  – R$ {formatBRL(predicted.personalBillsTotal)}
                </div>
              </div>

              <div>
                <div className="text-[#5A5A54] dark:text-[#8E8E96] text-[11px]">
                  Dia a dia
                </div>
                <div className="font-mono-num font-semibold text-[#5A5A54] dark:text-[#8E8E96] mt-0.5">
                  – R$ {formatBRL(predicted.dayToDayBudget)}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E2E2DC] dark:border-[#242429] flex sm:block items-center justify-between">
                <div className="text-[#111110] dark:text-[#F5F5F2] font-semibold text-[11px]">
                  Sobra livre
                </div>
                <div className="font-mono-num font-bold text-[#1D4ED8] dark:text-[#6088FF] sm:mt-0.5">
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
              <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-[#E2E2DC] dark:border-[#242429]">
                <div>
                  <h2 className="font-broadsheet text-xl font-semibold text-[#111110] dark:text-[#F5F5F2]">
                    Divisão da Casa (50/50)
                  </h2>
                  <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] mt-0.5">
                    Total compartilhado no mês
                  </p>
                </div>
                <div className="font-mono-num text-lg font-bold text-[#111110] dark:text-[#F5F5F2]">
                  <NumberTicker
                    value={houseSplit.totalHouseBills}
                    prefix="R$ "
                    centsClassName="text-[0.68em] font-medium opacity-55"
                  />
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <div>
                    <div className="text-[11px] text-[#5A5A54] dark:text-[#8E8E96]">Alan paga</div>
                    <div className="font-mono-num font-bold text-[#111110] dark:text-[#F5F5F2]">
                      R$ {formatBRL(houseSplit.userPaidTotal)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[#5A5A54] dark:text-[#8E8E96]">
                      {profile.partnerName.split(' ')[0]} (Namorada)
                    </div>
                    <div className="font-mono-num font-bold text-[#C83E2B] dark:text-[#F9735B]">
                      R$ {formatBRL(houseSplit.partnerPaidTotal)}
                    </div>
                  </div>
                </div>

                <div className="relative h-5 rounded-xs overflow-hidden flex text-[10px] font-mono-num font-bold text-white select-none">
                  <div
                    style={{ width: `${userSplitDisplayPct}%` }}
                    className="bg-[#111110] dark:bg-[#1D4ED8] flex items-center pl-2.5 transition-all duration-300"
                  >
                    {userSplitDisplayPct.toFixed(1).replace('.', ',')}%
                  </div>
                  <div
                    style={{ width: `${partnerSplitDisplayPct}%` }}
                    className="bg-[#C83E2B] dark:bg-[#F9735B] text-white dark:text-[#09090B] flex items-center justify-end pr-2.5 transition-all duration-300"
                  >
                    {partnerSplitDisplayPct.toFixed(1).replace('.', ',')}%
                  </div>
                  <div
                    className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-white dark:bg-[#111113] z-10"
                    title="Equilíbrio 50% / 50%"
                  />
                </div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-[#5A5A54] dark:text-[#8E8E96]">
                    Contas compartilhadas ({sharedHouseBills.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => onOpenAddBillModal('house')}
                    className="min-h-[32px] px-2 -mr-2 text-xs font-semibold text-[#1D4ED8] dark:text-[#6088FF] hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Nova despesa
                  </button>
                </div>

                <ul className="divide-y divide-[#ECECE6] dark:divide-[#1D1D22] text-xs">
                  {visibleSharedBills.map((item) => (
                    <li
                      key={item.id}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-[10px] font-mono-num font-bold shrink-0 ${
                            item.paidBy === 'user'
                              ? 'text-[#1D4ED8] dark:text-[#6088FF]'
                              : 'text-[#C83E2B] dark:text-[#F9735B]'
                          }`}
                        >
                          {item.paidBy === 'user' ? 'AL' : 'LF'}
                        </span>
                        <span className="text-[#111110] dark:text-[#E4E4EA] truncate">
                          {item.title}
                        </span>
                      </div>
                      <span className="font-mono-num font-semibold text-[#111110] dark:text-[#F5F5F2] whitespace-nowrap">
                        R$ {formatBRL(item.amount)}
                      </span>
                    </li>
                  ))}
                </ul>

                {sharedHouseBills.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowAllSharedBills((prev) => !prev)}
                    className="mt-1.5 text-[11px] font-semibold text-[#1D4ED8] dark:text-[#6088FF] hover:underline cursor-pointer"
                  >
                    {showAllSharedBills
                      ? 'Mostrar resumo'
                      : `Ver todas (${sharedHouseBills.length})`}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3.5 border-t border-[#E2E2DC] dark:border-[#242429] flex items-center justify-between gap-2">
              <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] truncate">
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
                className={`min-h-[34px] px-3.5 py-1 text-xs font-semibold rounded-xs border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  profile.pixSettled
                    ? 'bg-[#0F766E]/10 dark:bg-[#2DD4BF]/15 border-[#0F766E]/35 text-[#0F766E] dark:text-[#2DD4BF]'
                    : 'bg-[#F3F3EF] dark:bg-[#161619] border-[#D8D8D0] dark:border-[#28282E] text-[#111110] dark:text-[#F5F5F2]'
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
            <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-[#E2E2DC] dark:border-[#242429]">
              <div>
                <h2 className="font-broadsheet text-xl font-semibold text-[#111110] dark:text-[#F5F5F2]">
                  Contas &amp; Agenda
                </h2>
                <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] mt-0.5">
                  {selectedDayTab === 'all'
                    ? 'Todos os vencimentos do mês'
                    : `Vencimento dia ${selectedDayTab < 10 ? `0${selectedDayTab}` : selectedDayTab}`}
                </p>
              </div>
              <div className="text-right">
                <div className="font-mono-num text-base font-bold text-[#111110] dark:text-[#F5F5F2]">
                  R$ {formatBRL(totalPayableAmount)}
                </div>
                <div className="text-[11px] font-semibold text-[#0F766E] dark:text-[#2DD4BF]">
                  {paidBillsCount}/{payableBills.length} quitadas
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              <button
                type="button"
                onClick={() => setSelectedDayTab('all')}
                className={`min-w-[60px] min-h-[42px] px-2.5 py-1.5 rounded-xs flex flex-col items-center justify-center transition-all text-[11px] font-bold cursor-pointer shrink-0 border ${
                  selectedDayTab === 'all'
                    ? 'bg-[#111110] dark:bg-[#F5F5F2] text-white dark:text-[#09090B] border-[#111110] dark:border-[#F5F5F2]'
                    : 'bg-[#F3F3EF] dark:bg-[#161619] text-[#5A5A54] dark:text-[#8E8E96] border-[#E2E2DC] dark:border-[#242429]'
                }`}
              >
                <span>Todas</span>
                <span className="text-[10px] font-mono-num font-normal opacity-80">
                  {payableBills.length}
                </span>
              </button>
              {dayTabs.map(({ day, count }) => {
                const isSelected = selectedDayTab === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDayTab(isSelected ? 'all' : day)}
                    aria-label={`Filtrar contas do dia ${day}`}
                    className={`min-w-[50px] min-h-[42px] px-2.5 py-1.5 rounded-xs flex flex-col items-center justify-center transition-all cursor-pointer shrink-0 border ${
                      isSelected
                        ? 'bg-[#111110] dark:bg-[#F5F5F2] text-white dark:text-[#09090B] border-[#111110] dark:border-[#F5F5F2]'
                        : 'bg-[#F3F3EF] dark:bg-[#161619] text-[#5A5A54] dark:text-[#8E8E96] border-[#E2E2DC] dark:border-[#242429]'
                    }`}
                  >
                    <span className="font-mono-num text-xs font-bold">
                      {day < 10 ? `0${day}` : day}
                    </span>
                    <span className="text-[9px] font-mono-num opacity-75">{count}x</span>
                  </button>
                );
              })}
            </div>

            <ul className="mt-3 divide-y divide-[#ECECE6] dark:divide-[#1D1D22] text-xs">
              {displayedPayableBills.map((bill) => (
                <li key={bill.id} className="group">
                  <button
                    type="button"
                    onClick={() => onToggleBillPaid(bill.id, !bill.isPaid)}
                    className="w-full min-h-[44px] py-2.5 flex items-center justify-between gap-2.5 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`w-4 h-4 rounded-xs border flex items-center justify-center transition-colors shrink-0 ${
                          bill.isPaid
                            ? 'bg-[#0F766E] dark:bg-[#2DD4BF] border-[#0F766E] dark:border-[#2DD4BF] text-white dark:text-[#09090B]'
                            : 'border-[#C4C4BC] dark:border-[#34343E] group-hover:border-[#111110] dark:group-hover:border-[#6088FF]'
                        }`}
                      >
                        {bill.isPaid && <Check className="w-3 h-3 stroke-[3]" />}
                      </span>
                      <div className="min-w-0">
                        <span
                          className={`block truncate transition-colors ${
                            bill.isPaid
                              ? 'text-[#5A5A54] dark:text-[#8E8E96] font-normal'
                              : 'text-[#111110] dark:text-[#F5F5F2] font-semibold'
                          }`}
                        >
                          {bill.title}
                        </span>
                        <span className="text-[11px] font-mono-num text-[#5A5A54] dark:text-[#8E8E96]">
                          Dia {bill.dueDay < 10 ? `0${bill.dueDay}` : bill.dueDay} ·{' '}
                          {bill.isPaid ? 'Quitada' : 'Em aberto'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`font-mono-num font-semibold whitespace-nowrap shrink-0 ${
                        bill.isPaid
                          ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                          : 'text-[#111110] dark:text-[#F5F5F2]'
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
                className="mt-2 text-[11px] font-semibold text-[#1D4ED8] dark:text-[#6088FF] hover:underline cursor-pointer"
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
                <h2 className="font-broadsheet text-xl font-semibold text-[#111110] dark:text-[#F5F5F2]">
                  Comprometimento Fixo
                </h2>
                <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] mt-0.5">
                  R$ {formatBRL(housingBenchmark.activeHousingCost)} · Meta saudável até 30%
                </p>
              </div>
              <CircularGaugeSvg
                valuePct={Math.min(100, Math.round((housingBenchmark.housingPctOfSalary / 30) * 100))}
                size={52}
                strokeWidth={4}
                trackColor="rgba(128,128,128,0.16)"
                fillColor={housingBenchmark.isWithinRecommended30Pct ? '#0F766E' : '#C83E2B'}
                label={`${housingBenchmark.housingPctOfSalary}%`}
                labelClassName="text-[#111110] dark:text-[#F5F5F2]"
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
              <div className="relative h-2 bg-[#F3F3EF] dark:bg-[#161619] rounded-xs overflow-visible flex items-center">
                <div
                  style={{
                    width: `${Math.min(100, Math.round((housingBenchmark.housingPctOfSalary / 60) * 100))}%`,
                  }}
                  className={`h-full transition-all duration-300 ${
                    housingBenchmark.isWithinRecommended30Pct
                      ? 'bg-[#0F766E] dark:bg-[#2DD4BF]'
                      : 'bg-[#C83E2B] dark:bg-[#F9735B]'
                  }`}
                />
                <div className="absolute left-1/2 -top-1 -bottom-1 w-0.5 bg-[#111110] dark:bg-white" />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono-num text-[#5A5A54] dark:text-[#8E8E96] mt-1.5">
                <span>0%</span>
                <span>30% ideal</span>
                <span>60%</span>
              </div>
            </div>

            <ul className="mt-4 pt-2 border-t border-[#E2E2DC] dark:border-[#242429] divide-y divide-[#ECECE6] dark:divide-[#1D1D22]">
              {housingBenchmark.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-xs bg-[#F3F3EF] dark:bg-[#161619] flex items-center justify-center shrink-0">
                      {renderHousingIcon(item.iconType)}
                    </span>
                    <span className="text-xs font-medium text-[#111110] dark:text-[#E4E4EA] truncate">
                      {item.title}
                    </span>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-[#111110] dark:text-[#F5F5F2] whitespace-nowrap shrink-0">
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
            <span className="w-10 h-10 rounded-xs bg-[#1D4ED8]/10 dark:bg-[#6088FF]/15 text-[#1D4ED8] dark:text-[#6088FF] flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-broadsheet text-lg sm:text-xl font-semibold text-[#111110] dark:text-[#F5F5F2]">
                Estúdio de Gráficos, Planilha Viva &amp; Simulador CDI
              </h2>
              <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] mt-0.5">
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
                className="min-h-[38px] px-4 py-2 rounded-sm bg-white dark:bg-[#161619] border border-[#D4D4CC] dark:border-[#2C2C34] hover:border-[#1D4ED8] dark:hover:border-[#6088FF] text-xs font-semibold text-[#111110] dark:text-[#F5F5F2] flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Bot className="w-3.5 h-3.5 text-[#1D4ED8] dark:text-[#6088FF]" />
                <span>Resumir com Copiloto AI</span>
              </button>
            )}

            {onNavigateSection && (
              <button
                type="button"
                onClick={() => onNavigateSection('cashflow')}
                className="min-h-[38px] px-4 py-2 rounded-sm bg-[#111110] dark:bg-[#F5F5F2] hover:opacity-90 text-white dark:text-[#09090B] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-opacity"
              >
                <Table2 className="w-3.5 h-3.5" />
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
