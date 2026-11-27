import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { motion } from 'motion/react';
import {
  LayoutGrid,
  CircleDot,
  Calendar,
  Filter,
  RotateCcw,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import {
  cleanTxDescription,
  formatBRL,
  isIncomeTransaction,
  isInternalTransferTransaction,
  roundCents,
  type BillItem,
} from '../utils/financeMath';
import type { TransactionRecord } from './CashFlowReportsView';
import {
  AnimatedSegmentedControl,
  EDITORIAL_EASE,
  NumberTicker,
  SpotlightBento,
} from './MotionPrimitives';

export type D3LayoutMode = 'treemap' | 'pack';

export type SpendingCategoryKey =
  | 'alimentacao'
  | 'restaurantes'
  | 'moradia'
  | 'transporte'
  | 'compras'
  | 'reserva'
  | 'outros';

interface CategoryMeta {
  id: SpendingCategoryKey;
  label: string;
  shortLabel: string;
  fill: string;
  fillDark: string;
  surfaceTint: string;
  surfaceTintDark: string;
  textOnFill: string;
}

const CATEGORY_CATALOG: Record<SpendingCategoryKey, CategoryMeta> = {
  alimentacao: {
    id: 'alimentacao',
    label: 'Mercado & Padaria',
    shortLabel: 'Mercado',
    fill: '#0F766E',
    fillDark: '#14B8A6',
    surfaceTint: 'rgba(15, 118, 110, 0.06)',
    surfaceTintDark: 'rgba(20, 184, 166, 0.14)',
    textOnFill: '#FFFFFF',
  },
  restaurantes: {
    id: 'restaurantes',
    label: 'Restaurantes & Café',
    shortLabel: 'Restaurantes',
    fill: '#B45309',
    fillDark: '#D97706',
    surfaceTint: 'rgba(180, 83, 9, 0.06)',
    surfaceTintDark: 'rgba(217, 119, 6, 0.14)',
    textOnFill: '#FFFFFF',
  },
  moradia: {
    id: 'moradia',
    label: 'Casa, Telecom & Saúde',
    shortLabel: 'Casa & Saúde',
    fill: '#18181B',
    fillDark: '#3F3F46',
    surfaceTint: 'rgba(17, 17, 16, 0.05)',
    surfaceTintDark: 'rgba(63, 63, 70, 0.28)',
    textOnFill: '#F5F5F2',
  },
  transporte: {
    id: 'transporte',
    label: 'Transporte & Apps',
    shortLabel: 'Transporte',
    fill: '#1D4ED8',
    fillDark: '#3B82F6',
    surfaceTint: 'rgba(29, 78, 216, 0.06)',
    surfaceTintDark: 'rgba(59, 130, 246, 0.16)',
    textOnFill: '#FFFFFF',
  },
  compras: {
    id: 'compras',
    label: 'Compras & Digital',
    shortLabel: 'Compras',
    fill: '#4338CA',
    fillDark: '#6366F1',
    surfaceTint: 'rgba(67, 56, 202, 0.06)',
    surfaceTintDark: 'rgba(99, 102, 241, 0.16)',
    textOnFill: '#FFFFFF',
  },
  reserva: {
    id: 'reserva',
    label: 'Reservas & CDB',
    shortLabel: 'Reservas',
    fill: '#0E7490',
    fillDark: '#06B6D4',
    surfaceTint: 'rgba(14, 116, 144, 0.06)',
    surfaceTintDark: 'rgba(6, 182, 212, 0.16)',
    textOnFill: '#FFFFFF',
  },
  outros: {
    id: 'outros',
    label: 'Pix & Despesas Gerais',
    shortLabel: 'Outros & Pix',
    fill: '#C83E2B',
    fillDark: '#E05A47',
    surfaceTint: 'rgba(200, 62, 43, 0.06)',
    surfaceTintDark: 'rgba(224, 90, 71, 0.16)',
    textOnFill: '#FFFFFF',
  },
};

const MONTH_PT_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function formatMonthChip(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  if (!y || !m) return monthKey;
  const label = MONTH_PT_LABELS[m - 1] || monthKey;
  return `${label}/${String(y).slice(-2)}`;
}

function classifyTransactionCategory(tx: TransactionRecord): SpendingCategoryKey {
  const cat = (tx.category || '').toLowerCase();
  const desc = (tx.description || '').toLowerCase();
  const merch = (tx.merchant || '').toLowerCase();
  const combined = `${cat} ${desc} ${merch}`;

  if (
    cat.includes('invest') ||
    combined.includes('cdb') ||
    combined.includes('porquinho') ||
    combined.includes('reserva')
  ) {
    return 'reserva';
  }
  if (
    cat.includes('grocer') ||
    combined.includes('supermercado') ||
    combined.includes('carioca') ||
    combined.includes('hortifruti') ||
    combined.includes('padaria') ||
    combined.includes('mercado')
  ) {
    return 'alimentacao';
  }
  if (
    cat.includes('eating') ||
    cat.includes('food') ||
    combined.includes('ifood') ||
    combined.includes('restaurante') ||
    combined.includes('cafe') ||
    combined.includes('lanchonete') ||
    combined.includes('starbucks')
  ) {
    return 'restaurantes';
  }
  if (
    cat.includes('housing') ||
    cat.includes('telecom') ||
    cat.includes('internet') ||
    cat.includes('health') ||
    cat.includes('pharm') ||
    cat.includes('houseware') ||
    combined.includes('claro') ||
    combined.includes('aluguel') ||
    combined.includes('drogaria') ||
    combined.includes('farmacia')
  ) {
    return 'moradia';
  }
  if (
    cat.includes('taxi') ||
    cat.includes('transport') ||
    cat.includes('fuel') ||
    combined.includes('uber') ||
    combined.includes('99') ||
    combined.includes('posto') ||
    combined.includes('estacionamento')
  ) {
    return 'transporte';
  }
  if (
    cat.includes('shop') ||
    cat.includes('service') ||
    cat.includes('leisure') ||
    cat.includes('entertainment') ||
    cat.includes('digital') ||
    combined.includes('amazon') ||
    combined.includes('americanas') ||
    combined.includes('mercado livre') ||
    combined.includes('apple') ||
    combined.includes('spotify') ||
    combined.includes('netflix') ||
    combined.includes('ggmax')
  ) {
    return 'compras';
  }
  return 'outros';
}

const INSTITUTION_NAMES = ['banco inter', 'inter', 'nubank', 'santander', 'banco santander'];

function normalizeMerchantLabel(tx: TransactionRecord): string {
  const merchantRaw = (tx.merchant || '').trim();
  const isBankAlias =
    !merchantRaw ||
    INSTITUTION_NAMES.some(
      (bank) =>
        merchantRaw.toLowerCase() === bank ||
        merchantRaw.toLowerCase().startsWith(`${bank} `)
    );

  const sourceText = isBankAlias ? cleanTxDescription(tx.description) : merchantRaw;
  const cleaned = sourceText
    .replace(
      /^(compra\s+(no\s+)?(cart[aã]o(\s+cr[eé]dito|\s+d[eé]bito)?|d[eé]bito|cr[eé]dito)|pagamento(\s+efetuado)?|pix\s+enviado(\s+interno)?|pix\s+enviado|deb\.?\s*aut\.?|aplica[cç][aã]o|transfer[êe]ncia\s+enviada)\s*[-–·:]?\s*/i,
      ''
    )
    .replace(/\s+\d+\/\d+$/, '')
    .replace(/\s*[-–·]\s*(banco inter|nubank|santander).*$/i, '')
    .trim();

  if (!cleaned) return 'Lançamento diverso';
  // Collapse noisy Uber/99 trip codes into clean brand names
  const lower = cleaned.toLowerCase();
  if (lower.startsWith('uber') || lower.includes('uber *')) return 'Uber';
  if (lower.startsWith('99app') || lower.startsWith('99*') || lower.includes('99 pop')) return '99 App';
  if (lower.includes('ifood')) return 'iFood';
  if (lower.includes('cdb porq')) return 'CDB Porquinho';
  if (lower.includes('carioca')) return 'H B Carioca';
  if (lower.includes('rd saude') || lower.includes('raia')) return 'RD Saúde';
  if (lower.includes('obramax')) return 'Obramax';
  if (lower.includes('claro')) return 'Claro S.A.';

  return cleaned.length > 22 ? `${cleaned.slice(0, 20)}…` : cleaned;
}

interface HierarchyDatum {
  name: string;
  id: string;
  depthType: 'root' | 'category' | 'merchant';
  categoryKey?: SpendingCategoryKey;
  value?: number;
  txCount?: number;
  sampleTxs?: TransactionRecord[];
  children?: HierarchyDatum[];
}

interface CategorySpendingD3MapProps {
  transactions: TransactionRecord[];
  bills?: BillItem[];
  partnerName?: string;
  instanceId?: string;
}

export function CategorySpendingD3Map({
  transactions,
  bills = [],
  partnerName = 'Larissa',
  instanceId = 'overview',
}: CategorySpendingD3MapProps) {
  const [layoutMode, setLayoutMode] = useState<D3LayoutMode>('treemap');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<SpendingCategoryKey | 'all'>('all');
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(false);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({
    width: 720,
    height: 390,
  });

  // Track theme polarity cleanly so SVG stroke/fill tokens stay synchronized
  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    checkDark();
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Measure SVG host via ResizeObserver for responsive D3 treemap & circle packing
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 120) {
        const nextWidth = Math.round(rect.width);
        const nextHeight = nextWidth < 460 ? 340 : 400;
        setCanvasSize((prev) =>
          prev.width === nextWidth && prev.height === nextHeight
            ? prev
            : { width: nextWidth, height: nextHeight }
        );
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Extract normalized real outflow transactions + optional bill synthesis when empty
  const outflowTransactions = useMemo(() => {
    const filtered = transactions.filter(
      (tx) =>
        tx.date &&
        Math.abs(tx.amount) > 0.01 &&
        !isIncomeTransaction(tx) &&
        !isInternalTransferTransaction(tx)
    );

    if (filtered.length > 0) return filtered;

    // Fallback gracefully to active monthly bills if partner Pluggy is isolated with 0 transactions
    return bills.map((bill) => ({
      id: 90000 + bill.id,
      description: bill.title,
      merchant: bill.title,
      amount: bill.amount,
      category: bill.isHousingCost
        ? 'Housing'
        : bill.category === 'savings'
          ? 'Investments'
          : 'Shopping',
      date: `${bill.monthKey || '2026-11'}-${String(Math.min(28, Math.max(1, bill.dueDay))).padStart(2, '0')}`,
      accountName: bill.paidBy === 'partner' ? partnerName : 'Contas da Casa',
      source: 'bills',
      isRecurring: true,
      owner: bill.paidBy,
    }));
  }, [transactions, bills, partnerName]);

  // Dynamic sorted list of months found in real transactions
  const availableMonths = useMemo(() => {
    const counts = new Map<string, { count: number; total: number }>();
    for (const tx of outflowTransactions) {
      const mk = tx.date.slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(mk)) continue;
      const cur = counts.get(mk) || { count: 0, total: 0 };
      cur.count += 1;
      cur.total = roundCents(cur.total + Math.abs(tx.amount));
      counts.set(mk, cur);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([monthKey, meta]) => ({
        monthKey,
        label: formatMonthChip(monthKey),
        count: meta.count,
        total: meta.total,
      }));
  }, [outflowTransactions]);

  // Keep selectedMonth valid if dataset changes (e.g., switching Alan / Larissa scope)
  useEffect(() => {
    if (
      selectedMonth !== 'all' &&
      !availableMonths.some((m) => m.monthKey === selectedMonth)
    ) {
      setSelectedMonth('all');
    }
  }, [availableMonths, selectedMonth]);

  // Filter transactions by active month first (to compute category pills)
  const monthScopedTxs = useMemo(() => {
    if (selectedMonth === 'all') return outflowTransactions;
    return outflowTransactions.filter((tx) => tx.date.startsWith(selectedMonth));
  }, [outflowTransactions, selectedMonth]);

  // Compute per-category aggregates within the selected month
  const categorySummaries = useMemo(() => {
    const map = new Map<
      SpendingCategoryKey,
      { amount: number; count: number; txs: TransactionRecord[] }
    >();

    for (const tx of monthScopedTxs) {
      const key = classifyTransactionCategory(tx);
      const cur = map.get(key) || { amount: 0, count: 0, txs: [] };
      cur.amount = roundCents(cur.amount + Math.abs(tx.amount));
      cur.count += 1;
      cur.txs.push(tx);
      map.set(key, cur);
    }

    const grand = Math.max(
      0.01,
      Array.from(map.values()).reduce((acc, item) => acc + item.amount, 0)
    );

    return Array.from(map.entries())
      .map(([key, info]) => ({
        meta: CATEGORY_CATALOG[key],
        amount: info.amount,
        count: info.count,
        pct: Math.round((info.amount / grand) * 1000) / 10,
        txs: info.txs.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthScopedTxs]);

  // Reset selectedCategory if current month has no entries for it
  useEffect(() => {
    if (
      selectedCategory !== 'all' &&
      !categorySummaries.some((c) => c.meta.id === selectedCategory)
    ) {
      setSelectedCategory('all');
    }
  }, [categorySummaries, selectedCategory]);

  // Apply category filter on top of month filter for the D3 hierarchy
  const filteredTxs = useMemo(() => {
    if (selectedCategory === 'all') return monthScopedTxs;
    return monthScopedTxs.filter(
      (tx) => classifyTransactionCategory(tx) === selectedCategory
    );
  }, [monthScopedTxs, selectedCategory]);

  const filteredTotal = useMemo(
    () => roundCents(filteredTxs.reduce((acc, tx) => acc + Math.abs(tx.amount), 0)),
    [filteredTxs]
  );

  // Build hierarchical tree for D3: Root -> Category -> Merchant
  const hierarchyData = useMemo<HierarchyDatum>(() => {
    const byCategory = new Map<
      SpendingCategoryKey,
      Map<string, { total: number; txs: TransactionRecord[] }>
    >();

    for (const tx of filteredTxs) {
      const catKey = classifyTransactionCategory(tx);
      const merchLabel = normalizeMerchantLabel(tx);
      const merchMap = byCategory.get(catKey) || new Map();
      const cur = merchMap.get(merchLabel) || { total: 0, txs: [] };
      cur.total = roundCents(cur.total + Math.abs(tx.amount));
      cur.txs.push(tx);
      merchMap.set(merchLabel, cur);
      byCategory.set(catKey, merchMap);
    }

    const categoryChildren: HierarchyDatum[] = Array.from(byCategory.entries())
      .map(([catKey, merchMap]) => {
        const sortedMerchants = Array.from(merchMap.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 12);

        const remainder = Array.from(merchMap.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .slice(12);

        const children: HierarchyDatum[] = sortedMerchants.map(([mName, info], idx) => ({
          id: `leaf-${catKey}-${idx}-${mName}`,
          name: mName,
          depthType: 'merchant',
          categoryKey: catKey,
          value: Math.max(0.5, info.total),
          txCount: info.txs.length,
          sampleTxs: info.txs.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
        }));

        if (remainder.length > 0) {
          const restTxs = remainder.flatMap(([, info]) => info.txs);
          const restTotal = roundCents(
            remainder.reduce((acc, [, info]) => acc + info.total, 0)
          );
          children.push({
            id: `leaf-${catKey}-rest`,
            name: `+${remainder.length} estabelecimentos`,
            depthType: 'merchant',
            categoryKey: catKey,
            value: Math.max(0.5, restTotal),
            txCount: restTxs.length,
            sampleTxs: restTxs.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
          });
        }

        return {
          id: `cat-${catKey}`,
          name: CATEGORY_CATALOG[catKey].label,
          depthType: 'category' as const,
          categoryKey: catKey,
          txCount: children.reduce((acc, c) => acc + (c.txCount || 0), 0),
          children,
        };
      })
      .sort((a, b) => {
        const sumA = (a.children || []).reduce((s, c) => s + (c.value || 0), 0);
        const sumB = (b.children || []).reduce((s, c) => s + (c.value || 0), 0);
        return sumB - sumA;
      });

    return {
      id: 'root',
      name: 'Gastos Filtrados',
      depthType: 'root',
      children: categoryChildren,
    };
  }, [filteredTxs]);

  // Compute D3 Treemap layout nodes cleanly via d3.treemap()
  const treemapNodes = useMemo(() => {
    if (!hierarchyData.children || hierarchyData.children.length === 0) {
      return { groups: [], leaves: [] };
    }
    const root = d3
      .hierarchy<HierarchyDatum>(hierarchyData)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemapLayout = d3
      .treemap<HierarchyDatum>()
      .tile(d3.treemapSquarify.ratio(1.35))
      .size([canvasSize.width, canvasSize.height])
      .paddingTop(26)
      .paddingRight(6)
      .paddingBottom(6)
      .paddingLeft(6)
      .paddingInner(5)
      .round(true);

    const laidOut = treemapLayout(root);
    return {
      groups: laidOut.children || [],
      leaves: laidOut.leaves(),
    };
  }, [hierarchyData, canvasSize.width, canvasSize.height]);

  // Compute D3 Circle Packing layout nodes cleanly via d3.pack()
  const packNodes = useMemo(() => {
    if (!hierarchyData.children || hierarchyData.children.length === 0) {
      return { groups: [], leaves: [] };
    }
    const root = d3
      .hierarchy<HierarchyDatum>(hierarchyData)
      .sum((d) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const packLayout = d3
      .pack<HierarchyDatum>()
      .size([canvasSize.width, canvasSize.height - 20])
      .padding((node) => (node.depth === 0 ? 28 : 5));

    const laidOut = packLayout(root);
    return {
      groups: laidOut.children || [],
      leaves: laidOut.leaves(),
    };
  }, [hierarchyData, canvasSize.width, canvasSize.height]);

  // Lookup inspected node (hovered takes precedence over clicked, else top category)
  const inspectedInfo = useMemo(() => {
    const targetId = hoveredNodeId || activeNodeId;
    const allNodes =
      layoutMode === 'treemap'
        ? [...treemapNodes.leaves, ...treemapNodes.groups]
        : [...packNodes.leaves, ...packNodes.groups];

    const matched = targetId
      ? allNodes.find((n) => n.data.id === targetId)
      : treemapNodes.groups[0] || null;

    if (!matched) return null;

    const catKey = matched.data.categoryKey || 'outros';
    const meta = CATEGORY_CATALOG[catKey];
    const value = roundCents(matched.value || 0);
    const sharePct = filteredTotal > 0 ? Math.round((value / filteredTotal) * 1000) / 10 : 0;

    let sampleTxs: TransactionRecord[] = [];
    if (matched.data.depthType === 'merchant' && matched.data.sampleTxs) {
      sampleTxs = matched.data.sampleTxs.slice(0, 5);
    } else {
      sampleTxs = filteredTxs
        .filter((tx) => classifyTransactionCategory(tx) === catKey)
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, 5);
    }

    return {
      id: matched.data.id,
      title: matched.data.name,
      depthType: matched.data.depthType,
      catMeta: meta,
      value,
      sharePct,
      txCount: matched.data.txCount || sampleTxs.length,
      sampleTxs,
    };
  }, [
    hoveredNodeId,
    activeNodeId,
    layoutMode,
    treemapNodes,
    packNodes,
    filteredTotal,
    filteredTxs,
  ]);

  const hasActiveFilter = selectedMonth !== 'all' || selectedCategory !== 'all' || activeNodeId !== null;

  const handleResetFilters = () => {
    setSelectedMonth('all');
    setSelectedCategory('all');
    setActiveNodeId(null);
    setHoveredNodeId(null);
  };

  return (
    <SpotlightBento
      as="section"
      delay={0.08}
      aria-label="Mapa de Gastos por Categoria em D3.js"
      className="p-5 sm:p-6"
    >
      {/* HEADER + LAYOUT SWITCHER */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="font-broadsheet text-xl sm:text-2xl font-semibold text-[#111110] dark:text-[#F5F5F2] tracking-[-0.02em]">
              Mapa de Gastos por Categoria{' '}
              <span className="font-accent-serif text-[#1D4ED8] dark:text-[#6088FF] font-normal">
                {layoutMode === 'treemap' ? 'Treemap' : 'Círculos'}
              </span>
            </h2>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono-num text-[#5A5A54] dark:text-[#8E8E96]">
              <Layers className="w-3 h-3 text-[#1D4ED8] dark:text-[#6088FF]" />
              D3.js · {filteredTxs.length} lançamentos
            </span>
          </div>
          <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] mt-1">
            Hierarquia interativa por categoria e estabelecimento com filtros dinâmicos de mês e grupo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <AnimatedSegmentedControl
            layoutId={`d3-layout-${instanceId}`}
            ariaLabel="Alternar visualização D3"
            value={layoutMode}
            onChange={(mode) => {
              setLayoutMode(mode);
              setHoveredNodeId(null);
            }}
            options={[
              {
                id: 'treemap',
                label: 'Treemap',
                icon: <LayoutGrid className="w-3.5 h-3.5" />,
              },
              {
                id: 'pack',
                label: 'Círculos',
                icon: <CircleDot className="w-3.5 h-3.5" />,
              },
            ]}
          />

          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="min-h-[38px] px-3 py-1.5 rounded-xs bg-[#F3F3EF] dark:bg-[#161619] border border-[#E2E2DC] dark:border-[#242429] hover:border-[#1D4ED8] dark:hover:border-[#6088FF] text-xs font-semibold text-[#111110] dark:text-[#F5F5F2] flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#1D4ED8] dark:text-[#6088FF]" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* DYNAMIC FILTER CONTROLS: MONTH & CATEGORY */}
      <div className="mt-5 pt-4 border-t border-[#E2E2DC] dark:border-[#242429] space-y-2.5">
        {/* Month filter row */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5A5A54] dark:text-[#8E8E96] shrink-0 mr-1">
            <Calendar className="w-3.5 h-3.5 text-[#1D4ED8] dark:text-[#6088FF]" />
            Mês
          </span>

          <button
            type="button"
            onClick={() => {
              setSelectedMonth('all');
              setActiveNodeId(null);
            }}
            aria-pressed={selectedMonth === 'all'}
            className={`min-h-[30px] px-2.5 py-1 rounded-xs text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
              selectedMonth === 'all'
                ? 'bg-[#111110] dark:bg-[#F5F5F2] text-[#FAFAF8] dark:text-[#09090B] border-[#111110] dark:border-[#F5F5F2]'
                : 'bg-[#FAFAF8] dark:bg-[#161619] text-[#5A5A54] dark:text-[#8E8E96] border-[#E2E2DC] dark:border-[#242429] hover:text-[#111110] dark:hover:text-[#F5F5F2]'
            }`}
          >
            Todos ({outflowTransactions.length})
          </button>

          {availableMonths.map((m) => {
            const active = selectedMonth === m.monthKey;
            return (
              <button
                key={m.monthKey}
                type="button"
                onClick={() => {
                  setSelectedMonth(active ? 'all' : m.monthKey);
                  setActiveNodeId(null);
                }}
                aria-pressed={active}
                className={`min-h-[30px] px-2.5 py-1 rounded-xs text-xs font-semibold font-mono-num whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1D4ED8] dark:bg-[#6088FF] text-white dark:text-[#09090B] border-[#1D4ED8] dark:border-[#6088FF]'
                    : 'bg-[#FAFAF8] dark:bg-[#161619] text-[#5A5A54] dark:text-[#8E8E96] border-[#E2E2DC] dark:border-[#242429] hover:text-[#111110] dark:hover:text-[#F5F5F2]'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Category filter row */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5A5A54] dark:text-[#8E8E96] shrink-0 mr-1">
            <Filter className="w-3.5 h-3.5 text-[#0F766E] dark:text-[#2DD4BF]" />
            Grupo
          </span>

          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setActiveNodeId(null);
            }}
            aria-pressed={selectedCategory === 'all'}
            className={`min-h-[30px] px-2.5 py-1 rounded-xs text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#111110] dark:bg-[#F5F5F2] text-[#FAFAF8] dark:text-[#09090B] border-[#111110] dark:border-[#F5F5F2]'
                : 'bg-[#FAFAF8] dark:bg-[#161619] text-[#5A5A54] dark:text-[#8E8E96] border-[#E2E2DC] dark:border-[#242429] hover:text-[#111110] dark:hover:text-[#F5F5F2]'
            }`}
          >
            Todas
          </button>

          {categorySummaries.map((cat) => {
            const active = selectedCategory === cat.meta.id;
            return (
              <button
                key={cat.meta.id}
                type="button"
                onClick={() => {
                  setSelectedCategory(active ? 'all' : cat.meta.id);
                  setActiveNodeId(null);
                }}
                aria-pressed={active}
                className={`min-h-[30px] px-2.5 py-1 rounded-xs text-xs font-semibold whitespace-nowrap shrink-0 border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#1D4ED8] dark:bg-[#6088FF] text-white dark:text-[#09090B] border-[#1D4ED8] dark:border-[#6088FF]'
                    : 'bg-[#FAFAF8] dark:bg-[#161619] text-[#111110] dark:text-[#D5D5D0] border-[#E2E2DC] dark:border-[#242429] hover:border-[#111110]/30 dark:hover:border-[#F5F5F2]/30'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{
                    backgroundColor: active
                      ? isDark
                        ? '#09090B'
                        : '#FFFFFF'
                      : isDark
                        ? cat.meta.fillDark
                        : cat.meta.fill,
                  }}
                />
                <span>{cat.meta.shortLabel}</span>
                <span
                  className={`font-mono-num text-[10px] ${
                    active ? 'opacity-85' : 'text-[#5A5A54] dark:text-[#8E8E96]'
                  }`}
                >
                  {cat.pct.toFixed(0)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN GRID: D3 CANVAS (8 COLS) + HIERARCHICAL INSPECTOR (4 COLS) */}
      <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* LEFT 8 COLS: RESPONSIVE D3 SVG CANVAS */}
        <div
          ref={canvasContainerRef}
          className="xl:col-span-8 relative rounded-sm border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#0D0D10] p-3 flex flex-col justify-between overflow-hidden min-h-[360px]"
        >
          {filteredTxs.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 space-y-3">
              <p className="font-broadsheet text-lg font-semibold text-[#111110] dark:text-[#F5F5F2]">
                Nenhum gasto encontrado neste filtro
              </p>
              <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] max-w-sm">
                Ajuste o mês ou restaure todas as categorias para visualizar o mapa D3 completo.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[38px] px-4 py-2 rounded-xs bg-[#1D4ED8] dark:bg-[#6088FF] text-white dark:text-[#09090B] text-xs font-bold cursor-pointer"
              >
                Restaurar filtros
              </button>
            </div>
          ) : (
            <motion.svg
              key={`${layoutMode}-${selectedMonth}-${selectedCategory}`}
              initial={{ opacity: 0.35, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.28, ease: EDITORIAL_EASE }}
              width={canvasSize.width}
              height={canvasSize.height}
              viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
              role="img"
              aria-label={`Visualização D3 em ${
                layoutMode === 'treemap' ? 'treemap' : 'empacotamento circular'
              } de gastos por categoria`}
              className="w-full h-auto select-none overflow-visible"
            >
              {layoutMode === 'treemap' ? (
                <g data-testid="d3-treemap-layer">
                  {/* Level 1: Category group enclosures */}
                  {treemapNodes.groups.map((group) => {
                    const catKey = group.data.categoryKey || 'outros';
                    const meta = CATEGORY_CATALOG[catKey];
                    const w = Math.max(0, group.x1 - group.x0);
                    const h = Math.max(0, group.y1 - group.y0);
                    const isSelected = activeNodeId === group.data.id;
                    const groupFill = isDark ? meta.surfaceTintDark : meta.surfaceTint;
                    const strokeColor = isDark ? meta.fillDark : meta.fill;

                    return (
                      <g
                        key={group.data.id}
                        onClick={() =>
                          setActiveNodeId((prev) =>
                            prev === group.data.id ? null : group.data.id
                          )
                        }
                        onMouseEnter={() => setHoveredNodeId(group.data.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={group.x0}
                          y={group.y0}
                          width={w}
                          height={h}
                          rx={2}
                          fill={groupFill}
                          stroke={strokeColor}
                          strokeOpacity={isSelected ? 0.95 : 0.42}
                          strokeWidth={isSelected ? 2 : 1}
                        />
                        {w >= 88 && h >= 44 && (
                          <text
                            x={group.x0 + 8}
                            y={group.y0 + 17}
                            fontSize="11"
                            fontWeight="700"
                            fill={isDark ? '#F5F5F2' : '#111110'}
                            className="font-editorial pointer-events-none"
                          >
                            {w > 170 ? meta.label : meta.shortLabel}
                          </text>
                        )}
                        {w >= 170 && h >= 44 && (
                          <text
                            x={group.x1 - 8}
                            y={group.y0 + 17}
                            textAnchor="end"
                            fontSize="10.5"
                            fontWeight="600"
                            fill={isDark ? '#8E8E96' : '#5A5A54'}
                            className="font-mono-num pointer-events-none"
                          >
                            R$ {formatBRL(group.value || 0)}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Level 2: Merchant leaf tiles inside categories */}
                  {treemapNodes.leaves.map((leaf) => {
                    const catKey = leaf.data.categoryKey || 'outros';
                    const meta = CATEGORY_CATALOG[catKey];
                    const w = Math.max(0, leaf.x1 - leaf.x0);
                    const h = Math.max(0, leaf.y1 - leaf.y0);
                    const isFocused =
                      hoveredNodeId === leaf.data.id || activeNodeId === leaf.data.id;
                    const fillBase = isDark ? meta.fillDark : meta.fill;
                    const showName = w >= 64 && h >= 32;
                    const showAmount = w >= 72 && h >= 48;

                    return (
                      <g
                        key={leaf.data.id}
                        data-testid="d3-treemap-leaf"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveNodeId((prev) =>
                            prev === leaf.data.id ? null : leaf.data.id
                          );
                        }}
                        onMouseEnter={() => setHoveredNodeId(leaf.data.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={leaf.x0}
                          y={leaf.y0}
                          width={w}
                          height={h}
                          rx={1}
                          fill={fillBase}
                          fillOpacity={isFocused ? 1 : 0.9}
                          stroke={isDark ? '#0D0D10' : '#FAFAF8'}
                          strokeWidth={isFocused ? 2.2 : 1.2}
                        />
                        {showName && (
                          <text
                            x={leaf.x0 + 8}
                            y={leaf.y0 + 18}
                            fontSize="10.5"
                            fontWeight="600"
                            fill={meta.textOnFill}
                            className="pointer-events-none"
                          >
                            {leaf.data.name.slice(0, Math.max(6, Math.floor((w - 14) / 6.3)))}
                          </text>
                        )}
                        {showAmount && (
                          <text
                            x={leaf.x0 + 8}
                            y={leaf.y0 + 34}
                            fontSize="10"
                            fontWeight="700"
                            fill={meta.textOnFill}
                            fillOpacity={0.92}
                            className="font-mono-num pointer-events-none"
                          >
                            R$ {formatBRL(leaf.value || 0)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              ) : (
                <g data-testid="d3-pack-layer" transform="translate(0, 14)">
                  {/* Level 1: Outer category cluster circles */}
                  {packNodes.groups.map((group) => {
                    const catKey = group.data.categoryKey || 'outros';
                    const meta = CATEGORY_CATALOG[catKey];
                    const isFocused =
                      hoveredNodeId === group.data.id || activeNodeId === group.data.id;
                    const strokeColor = isDark ? meta.fillDark : meta.fill;
                    const fillColor = isDark ? meta.surfaceTintDark : meta.surfaceTint;

                    return (
                      <g
                        key={group.data.id}
                        onClick={() =>
                          setActiveNodeId((prev) =>
                            prev === group.data.id ? null : group.data.id
                          )
                        }
                        onMouseEnter={() => setHoveredNodeId(group.data.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={group.x}
                          cy={group.y}
                          r={Math.max(0, group.r)}
                          fill={fillColor}
                          stroke={strokeColor}
                          strokeOpacity={isFocused ? 0.95 : 0.55}
                          strokeWidth={isFocused ? 2.2 : 1.4}
                        />
                        {group.r >= 36 && (
                          <text
                            x={group.x}
                            y={Math.max(0, group.y - group.r - 5)}
                            textAnchor="middle"
                            fontSize="10.5"
                            fontWeight="700"
                            fill={isDark ? '#F5F5F2' : '#111110'}
                            stroke={isDark ? '#0D0D10' : '#FAFAF8'}
                            strokeWidth={3}
                            paintOrder="stroke"
                            className="font-editorial pointer-events-none"
                          >
                            {meta.shortLabel}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Level 2: Merchant packed bubbles */}
                  {packNodes.leaves.map((leaf) => {
                    const catKey = leaf.data.categoryKey || 'outros';
                    const meta = CATEGORY_CATALOG[catKey];
                    const isFocused =
                      hoveredNodeId === leaf.data.id || activeNodeId === leaf.data.id;
                    const fillColor = isDark ? meta.fillDark : meta.fill;
                    const showLabel = leaf.r >= 26;
                    const showAmount = leaf.r >= 34;

                    return (
                      <g
                        key={leaf.data.id}
                        data-testid="d3-pack-leaf"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveNodeId((prev) =>
                            prev === leaf.data.id ? null : leaf.data.id
                          );
                        }}
                        onMouseEnter={() => setHoveredNodeId(leaf.data.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        className="cursor-pointer"
                      >
                        <circle
                          cx={leaf.x}
                          cy={leaf.y}
                          r={Math.max(2, leaf.r)}
                          fill={fillColor}
                          fillOpacity={isFocused ? 1 : 0.9}
                          stroke={isDark ? '#0D0D10' : '#FAFAF8'}
                          strokeWidth={isFocused ? 2.2 : 1.2}
                        />
                        {showLabel && (
                          <text
                            x={leaf.x}
                            y={showAmount ? leaf.y - 3 : leaf.y + 3}
                            textAnchor="middle"
                            fontSize={leaf.r >= 44 ? '10.5' : '9.5'}
                            fontWeight="600"
                            fill={meta.textOnFill}
                            className="pointer-events-none"
                          >
                            {leaf.data.name.slice(0, Math.max(5, Math.floor(leaf.r / 4.3)))}
                          </text>
                        )}
                        {showAmount && (
                          <text
                            x={leaf.x}
                            y={leaf.y + 12}
                            textAnchor="middle"
                            fontSize="9.5"
                            fontWeight="700"
                            fill={meta.textOnFill}
                            fillOpacity={0.92}
                            className="font-mono-num pointer-events-none"
                          >
                            R$ {Math.round(leaf.value || 0)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              )}
            </motion.svg>
          )}
        </div>

        {/* RIGHT 4 COLS: LIVE INSPECTOR & TOP LAUNCHES */}
        <aside
          aria-label="Detalhes do filtro e categoria selecionada"
          className="xl:col-span-4 rounded-sm border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#0D0D10] p-4 sm:p-5 flex flex-col justify-between gap-4"
        >
          <div>
            <div className="flex items-start justify-between gap-3 pb-3.5 border-b border-[#E2E2DC] dark:border-[#242429]">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5A5A54] dark:text-[#8E8E96]">
                  Total no recorte ativo
                </div>
                <div className="mt-1.5 font-display-num text-2xl font-bold text-[#111110] dark:text-[#F5F5F2] leading-none tabular-nums">
                  <NumberTicker
                    value={filteredTotal}
                    prefix="R$ "
                    centsClassName="text-[0.58em] font-medium opacity-60"
                  />
                </div>
              </div>
              <span className="text-[11px] font-mono-num font-semibold text-[#5A5A54] dark:text-[#8E8E96] shrink-0">
                {selectedMonth === 'all' ? 'Histórico' : formatMonthChip(selectedMonth)}
              </span>
            </div>

            {inspectedInfo ? (
              <div className="mt-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#5A5A54] dark:text-[#8E8E96]">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{
                          backgroundColor: isDark
                            ? inspectedInfo.catMeta.fillDark
                            : inspectedInfo.catMeta.fill,
                        }}
                      />
                      <span className="truncate">
                        {inspectedInfo.depthType === 'merchant'
                          ? `${inspectedInfo.catMeta.shortLabel} · Estabelecimento`
                          : 'Categoria em foco'}
                      </span>
                    </div>
                    <h3 className="font-broadsheet text-lg font-semibold text-[#111110] dark:text-[#F5F5F2] truncate mt-0.5">
                      {inspectedInfo.title}
                    </h3>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono-num text-base font-bold text-[#111110] dark:text-[#F5F5F2] tabular-nums">
                      R$ {formatBRL(inspectedInfo.value)}
                    </div>
                    <div className="font-mono-num text-[11px] font-semibold text-[#1D4ED8] dark:text-[#6088FF]">
                      {inspectedInfo.sharePct.toFixed(1).replace('.', ',')}% do recorte
                    </div>
                  </div>
                </div>

                {/* Top matching transactions inside selected/hovered D3 node */}
                <div className="pt-2.5 border-t border-[#E2E2DC] dark:border-[#242429]">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[#5A5A54] dark:text-[#8E8E96] mb-2">
                    <span>Principais lançamentos ({inspectedInfo.txCount})</span>
                    {selectedCategory !== inspectedInfo.catMeta.id && (
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(inspectedInfo.catMeta.id)}
                        className="text-[#1D4ED8] dark:text-[#6088FF] hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Isolar</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <ul className="divide-y divide-[#ECECE6] dark:divide-[#1D1D22] text-xs">
                    {inspectedInfo.sampleTxs.map((tx) => (
                      <li
                        key={tx.id}
                        className="py-2 flex items-center justify-between gap-2.5"
                      >
                        <div className="min-w-0">
                          <div className="font-medium text-[#111110] dark:text-[#F5F5F2] truncate">
                            {cleanTxDescription(tx.description)}
                          </div>
                          <div className="text-[10px] font-mono-num text-[#5A5A54] dark:text-[#8E8E96] truncate">
                            {tx.date} · {tx.accountName}
                          </div>
                        </div>
                        <span className="font-mono-num font-bold text-[#111110] dark:text-[#F5F5F2] whitespace-nowrap shrink-0">
                          R$ {formatBRL(Math.abs(tx.amount))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-[#5A5A54] dark:text-[#8E8E96]">
                Passe o mouse ou toque em qualquer bloco ou círculo para detalhar os lançamentos.
              </p>
            )}
          </div>

          {/* Quick Category Ranking Bar */}
          {categorySummaries.length > 0 && (
            <div className="pt-3 border-t border-[#E2E2DC] dark:border-[#242429] space-y-2">
              <div className="text-[11px] font-semibold text-[#5A5A54] dark:text-[#8E8E96]">
                Peso por categoria ({selectedMonth === 'all' ? 'Todos' : formatMonthChip(selectedMonth)})
              </div>
              <div className="h-2 w-full rounded-xs overflow-hidden flex bg-[#ECECE6] dark:bg-[#1D1D22]">
                {categorySummaries.map((cat) => (
                  <button
                    key={cat.meta.id}
                    type="button"
                    onClick={() =>
                      setSelectedCategory((prev) =>
                        prev === cat.meta.id ? 'all' : cat.meta.id
                      )
                    }
                    title={`${cat.meta.label}: R$ ${formatBRL(cat.amount)} (${cat.pct}%)`}
                    style={{
                      width: `${Math.max(4, cat.pct)}%`,
                      backgroundColor: isDark ? cat.meta.fillDark : cat.meta.fill,
                      opacity:
                        selectedCategory === 'all' || selectedCategory === cat.meta.id ? 1 : 0.25,
                    }}
                    className="h-full transition-opacity cursor-pointer"
                  />
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </SpotlightBento>
  );
}
