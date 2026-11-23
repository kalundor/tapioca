import React, { useState, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Filter,
  BarChart3,
  TrendingUp,
  Layers,
  Check,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  GitCommitHorizontal,
  Users,
  Download,
} from 'lucide-react';
import {
  buildAnnualExpenseSeries,
  filterAndZoomExpenseSeries,
  calculateHouseSplit,
  formatBRL,
  type BillItem,
  type CoupleProfile,
  type ExpenseCategoryId,
  type TransactionLike,
} from '../utils/financeMath';
import { SpotlightBento, AnimatedSegmentedControl } from './MotionPrimitives';

interface MonthlyExpenseExplorerProps {
  profile: CoupleProfile;
  bills: BillItem[];
  transactions?: TransactionLike[];
  compact?: boolean;
}

export const EXPENSE_CATEGORIES: Array<{
  id: ExpenseCategoryId;
  label: string;
  shortLabel: string;
  color: string;
  bgClass: string;
  dotClass: string;
}> = [
  {
    id: 'moradia',
    label: 'Moradia & Casa (50%)',
    shortLabel: 'Moradia',
    color: '#0B130F',
    bgClass: 'bg-[#0B130F]',
    dotClass: 'bg-[#0B130F]',
  },
  {
    id: 'cartoes',
    label: 'Cartões & Faturas',
    shortLabel: 'Cartões',
    color: '#3B7A1E',
    bgClass: 'bg-[#3B7A1E]',
    dotClass: 'bg-[#3B7A1E]',
  },
  {
    id: 'reserva',
    label: 'Reservas & CDB',
    shortLabel: 'Reserva',
    color: '#56AD17',
    bgClass: 'bg-[#56AD17]',
    dotClass: 'bg-[#56AD17]',
  },
  {
    id: 'alimentacao',
    label: 'Alimentação & Café',
    shortLabel: 'Alimentação',
    color: '#D97706',
    bgClass: 'bg-[#D97706]',
    dotClass: 'bg-[#D97706]',
  },
  {
    id: 'lazer',
    label: 'Dia a Dia & Saúde',
    shortLabel: 'Dia a Dia',
    color: '#64748B',
    bgClass: 'bg-[#64748B]',
    dotClass: 'bg-[#64748B]',
  },
];

type ChartMode = 'stacked' | 'area' | 'waterfall' | 'donut' | 'couple';

export function MonthlyExpenseExplorer({
  profile,
  bills,
  transactions = [],
  compact = false,
}: MonthlyExpenseExplorerProps) {
  const [activeCategories, setActiveCategories] = useState<ExpenseCategoryId[]>([
    'moradia',
    'cartoes',
    'reserva',
    'alimentacao',
    'lazer',
  ]);
  const [startIndex, setStartIndex] = useState<number>(6);
  const [endIndex, setEndIndex] = useState<number>(11);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [chartMode, setChartMode] = useState<ChartMode>('stacked');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('2026-11');
  const [activeDonutCat, setActiveDonutCat] = useState<ExpenseCategoryId | null>(null);
  const [csvExportedNotice, setCsvExportedNotice] = useState(false);

  const annualSeries = useMemo(
    () => buildAnnualExpenseSeries(bills, profile.userSalary, transactions),
    [bills, profile.userSalary, transactions]
  );

  const explorerData = useMemo(
    () =>
      filterAndZoomExpenseSeries(annualSeries, {
        activeCategories,
        startIndex,
        endIndex,
        zoomScale,
      }),
    [annualSeries, activeCategories, startIndex, endIndex, zoomScale]
  );

  const selectedPoint = useMemo(() => {
    return (
      explorerData.points.find((p) => p.monthKey === selectedMonthKey) ||
      explorerData.points[explorerData.points.length - 1] ||
      explorerData.points[0]
    );
  }, [explorerData.points, selectedMonthKey]);

  const houseSplit = useMemo(() => calculateHouseSplit(bills), [bills]);

  const toggleCategory = (catId: ExpenseCategoryId) => {
    setActiveCategories((prev) => {
      if (prev.includes(catId)) {
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== catId);
      }
      return [...prev, catId];
    });
  };

  const selectOnlyCategory = (catId: ExpenseCategoryId) => {
    if (activeCategories.length === 1 && activeCategories[0] === catId) {
      setActiveCategories(EXPENSE_CATEGORIES.map((c) => c.id));
    } else {
      setActiveCategories([catId]);
    }
  };

  const handleRangePreset = (preset: '12m' | '6m' | '3m') => {
    if (preset === '12m') {
      setStartIndex(0);
      setEndIndex(11);
    } else if (preset === '6m') {
      setStartIndex(6);
      setEndIndex(11);
    } else {
      setStartIndex(9);
      setEndIndex(11);
    }
  };

  const handleZoomIn = () => {
    setZoomScale((prev) => Math.min(2.0, Number((prev + 0.25).toFixed(2))));
    if (endIndex - startIndex > 3) {
      setStartIndex((prev) => Math.min(endIndex - 2, prev + 1));
    }
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => Math.max(1.0, Number((prev - 0.25).toFixed(2))));
    if (startIndex > 0) {
      setStartIndex((prev) => Math.max(0, prev - 2));
    }
  };

  const handleResetZoom = () => {
    setZoomScale(1.0);
    setStartIndex(0);
    setEndIndex(11);
    setActiveCategories(EXPENSE_CATEGORIES.map((c) => c.id));
    setActiveDonutCat(null);
  };

  const handleExportExcelCsv = () => {
    const header = [
      'Mes',
      'Referencia',
      'Renda (R$)',
      'Moradia 50% (R$)',
      'Cartoes (R$)',
      'Reservas CDB (R$)',
      'Alimentacao (R$)',
      'Dia a Dia (R$)',
      'Total Filtrado (R$)',
      'Sobra Livre (R$)',
    ].join(';');

    const rows = explorerData.points.map((pt) =>
      [
        pt.monthKey,
        pt.fullMonthLabel,
        pt.income.toFixed(2).replace('.', ','),
        pt.categoryValues.moradia.toFixed(2).replace('.', ','),
        pt.categoryValues.cartoes.toFixed(2).replace('.', ','),
        pt.categoryValues.reserva.toFixed(2).replace('.', ','),
        pt.categoryValues.alimentacao.toFixed(2).replace('.', ','),
        pt.categoryValues.lazer.toFixed(2).replace('.', ','),
        pt.filteredTotal.toFixed(2).replace('.', ','),
        pt.leftover.toFixed(2).replace('.', ','),
      ].join(';')
    );

    const csvContent = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tapioca-pay-planilha-${selectedPoint?.monthKey || '2026'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCsvExportedNotice(true);
    setTimeout(() => setCsvExportedNotice(false), 2600);
  };

  const isAllCategoriesSelected = activeCategories.length === EXPENSE_CATEGORIES.length;

  // Area Chart geometry
  const svgWidth = 720;
  const svgHeight = 210;
  const padX = 36;
  const padY = 20;
  const plotW = svgWidth - padX * 2;
  const plotH = svgHeight - padY * 2;

  const areaPoints = explorerData.points.map((pt, idx) => {
    const count = Math.max(1, explorerData.points.length - 1);
    const x =
      explorerData.points.length === 1 ? svgWidth / 2 : padX + (idx / count) * plotW;
    const ratio = Math.min(1, pt.filteredTotal / Math.max(1, explorerData.yAxisMax));
    const y = padY + plotH - ratio * plotH;
    return { x, y, pt };
  });

  const linePath =
    areaPoints.length > 0
      ? areaPoints
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ')
      : '';
  const areaFillPath =
    areaPoints.length > 1
      ? `${linePath} L ${areaPoints[areaPoints.length - 1].x.toFixed(1)} ${(padY + plotH).toFixed(1)} L ${areaPoints[0].x.toFixed(1)} ${(padY + plotH).toFixed(1)} Z`
      : '';

  // Waterfall Chart steps for selected month
  const waterfallSteps = useMemo(() => {
    if (!selectedPoint) return [];
    const baseIncome = Math.max(1, selectedPoint.income);
    let running = baseIncome;
    const steps: Array<{
      id: string;
      label: string;
      value: number;
      start: number;
      end: number;
      color: string;
      kind: 'income' | 'expense' | 'final';
    }> = [
      {
        id: 'income',
        label: 'Entradas',
        value: baseIncome,
        start: 0,
        end: baseIncome,
        color: '#0B130F',
        kind: 'income',
      },
    ];

    for (const cat of EXPENSE_CATEGORIES) {
      if (!activeCategories.includes(cat.id)) continue;
      const val = selectedPoint.categoryValues[cat.id] || 0;
      const next = Math.max(0, running - val);
      steps.push({
        id: cat.id,
        label: cat.shortLabel,
        value: -val,
        start: next,
        end: running,
        color: cat.color,
        kind: 'expense',
      });
      running = next;
    }

    steps.push({
      id: 'leftover',
      label: 'Sobra',
      value: running,
      start: 0,
      end: running,
      color: '#7AC128',
      kind: 'final',
    });

    return steps;
  }, [selectedPoint, activeCategories]);

  // Interactive Donut segments for selected month
  const donutSegments = useMemo(() => {
    if (!selectedPoint) return [];
    const total = Math.max(1, selectedPoint.filteredTotal);
    const radius = 64;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return EXPENSE_CATEGORIES.filter((cat) => activeCategories.includes(cat.id)).map((cat) => {
      const value = selectedPoint.categoryValues[cat.id] || 0;
      const fraction = value / total;
      const length = fraction * circumference;
      const seg = {
        ...cat,
        value,
        pct: Math.round(fraction * 100),
        dasharray: `${Math.max(0, length - 2)} ${circumference}`,
        dashoffset: -offset,
      };
      offset += length;
      return seg;
    });
  }, [selectedPoint, activeCategories]);

  // Couple comparative dataset (Alan vs Larissa)
  const coupleComparison = useMemo(() => {
    const userBillsOnly = bills
      .filter((b) => b.paidBy === 'user' && !b.isShared)
      .reduce((acc, b) => acc + b.amount, 0);
    const partnerBillsOnly = bills
      .filter((b) => b.paidBy === 'partner' && !b.isShared)
      .reduce((acc, b) => acc + b.amount, 0);

    const alanTotalOut = houseSplit.eachShare50 + userBillsOnly + profile.dayToDayBudget;
    const larissaTotalOut = houseSplit.eachShare50 + partnerBillsOnly;

    const rows = [
      {
        label: 'Renda Líquida',
        alan: profile.userSalary,
        larissa: profile.partnerSalary,
      },
      {
        label: 'Casa Pago Direto',
        alan: houseSplit.userPaidTotal,
        larissa: houseSplit.partnerPaidTotal,
      },
      {
        label: 'Cota Justa 50/50',
        alan: houseSplit.eachShare50,
        larissa: houseSplit.eachShare50,
      },
      {
        label: 'Contas Individuais',
        alan: userBillsOnly,
        larissa: partnerBillsOnly,
      },
      {
        label: 'Saldo Livre Estimado',
        alan: Math.max(0, profile.userSalary - alanTotalOut),
        larissa: Math.max(0, profile.partnerSalary - larissaTotalOut),
      },
    ];
    const maxVal = Math.max(
      500,
      ...rows.flatMap((r) => [r.alan, r.larissa])
    );
    return { rows, maxVal };
  }, [bills, houseSplit, profile]);

  const presetValue: '12m' | '6m' | '3m' =
    startIndex === 0 && endIndex === 11
      ? '12m'
      : startIndex === 6 && endIndex === 11
        ? '6m'
        : '3m';

  const chartModeOptions = [
    { id: 'stacked' as const, label: 'Barras', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'area' as const, label: 'Tendência', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: 'waterfall' as const, label: 'Cascata', icon: <GitCommitHorizontal className="w-3.5 h-3.5" /> },
    { id: 'donut' as const, label: 'Donut', icon: <PieChart className="w-3.5 h-3.5" /> },
    { id: 'couple' as const, label: 'Casal', icon: <Users className="w-3.5 h-3.5" /> },
  ];

  return (
    <SpotlightBento
      as="section"
      aria-label="Estúdio de Gráficos e Planilha Interativa"
      className="p-4 sm:p-6"
    >
      {/* HEADER + CHART GENERATOR TOOLBAR */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-4 border-b border-[#E4E7E5] dark:border-[#1B231F]">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-lg bg-[#F1F3F2] dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F] flex items-center justify-center text-[#0B110E] dark:text-[#8CE02C] shrink-0">
            <BarChart3 className="w-4 h-4" />
          </span>
          <div>
            <h2 className="font-editorial text-lg font-semibold text-[#0B110E] dark:text-[#F3F5F4]">
              Estúdio de Gráficos &amp; Série Histórica
            </h2>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
              Alterne entre 5 motores visuais, dê zoom ou exporte a planilha pronta para Excel
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <AnimatedSegmentedControl
            options={[
              { id: '12m', label: '12M' },
              { id: '6m', label: '6M' },
              { id: '3m', label: '3M' },
            ]}
            value={presetValue}
            onChange={handleRangePreset}
            layoutId="explorer-range-pill"
            ariaLabel="Janela temporal"
          />

          <div className="inline-flex items-center gap-0.5 bg-[#F1F3F2] dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F] p-1 rounded-lg">
            <button
              type="button"
              onClick={handleZoomIn}
              aria-label="Aumentar zoom no gráfico"
              title="Zoom In (+)"
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#0B110E] dark:text-[#D5DBD8] hover:bg-white dark:hover:bg-[#19221D] transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono-num text-[11px] font-bold text-[#0B110E] dark:text-[#F3F5F4] px-1">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomOut}
              aria-label="Diminuir zoom no gráfico"
              title="Zoom Out (-)"
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#0B110E] dark:text-[#D5DBD8] hover:bg-white dark:hover:bg-[#19221D] transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              aria-label="Resetar zoom e filtros"
              title="Resetar Zoom e Filtros"
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#5C6660] hover:text-[#0B110E] dark:hover:text-[#8CE02C] hover:bg-white dark:hover:bg-[#19221D] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportExcelCsv}
            className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0B130F] dark:bg-[#8CE02C] hover:opacity-90 text-white dark:text-[#060807] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-[#8CE02C] dark:text-[#060807]" />
            <span>{csvExportedNotice ? 'Planilha Baixada ✓' : 'Exportar Excel (.csv)'}</span>
          </button>
        </div>
      </div>

      {/* CHART ENGINE SWITCHER + CATEGORY FILTER ROW */}
      <div className="mt-3.5 flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-2.5">
        <div className="overflow-x-auto no-scrollbar pb-0.5 shrink-0">
          <AnimatedSegmentedControl
            options={chartModeOptions}
            value={chartMode}
            onChange={setChartMode}
            layoutId={compact ? 'explorer-chart-compact' : 'explorer-chart-full'}
            ariaLabel="Tipo de gráfico gerado"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto sm:overflow-visible sm:flex-wrap no-scrollbar pb-0.5">
          <span className="text-[11px] font-semibold text-[#5C6660] dark:text-[#8C9891] flex items-center gap-1 mr-1 shrink-0">
            <Filter className="w-3 h-3" /> Séries:
          </span>

          <button
            type="button"
            onClick={() => setActiveCategories(EXPENSE_CATEGORIES.map((c) => c.id))}
            className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1 shrink-0 cursor-pointer ${
              isAllCategoriesSelected
                ? 'bg-[#0B130F] dark:bg-[#8CE02C] text-white dark:text-[#060807] border-[#0B130F] dark:border-[#8CE02C]'
                : 'bg-[#F7F8F7] dark:bg-[#111714] text-[#5C6660] dark:text-[#8C9891] border-[#E4E7E5] dark:border-[#1B231F]'
            }`}
          >
            {isAllCategoriesSelected && <Check className="w-3 h-3 text-[#8CE02C] dark:text-[#060807]" />}
            <span>Todas ({EXPENSE_CATEGORIES.length})</span>
          </button>

          {EXPENSE_CATEGORIES.map((cat) => {
            const isSelected = activeCategories.includes(cat.id);
            const catStat = explorerData.categoryTotals[cat.id];
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                onDoubleClick={() => selectOnlyCategory(cat.id)}
                title="Clique para ativar/desativar (duplo clique para isolar)"
                className={`min-h-[32px] px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-[#19221D] text-[#0B110E] dark:text-[#F3F5F4] border-[#D0D6D2] dark:border-[#28352E] shadow-2xs'
                    : 'bg-[#F7F8F7] dark:bg-[#090C0B] text-[#8C9891] border-[#E4E7E5] dark:border-[#1B231F] opacity-60 hover:opacity-100'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: isSelected ? cat.color : '#94A3B8' }}
                />
                <span>{cat.shortLabel}</span>
                <span className="font-mono-num text-[10px] text-[#5C6660] dark:text-[#8C9891]">
                  {catStat.pct}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* UNIFIED HAIRLINE SUMMARY KPI STRIP */}
      <div className="mt-4 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E4E7E5] dark:divide-[#1B231F] overflow-hidden">
        <div className="p-3.5">
          <div className="text-[11px] font-medium text-[#5C6660] dark:text-[#8C9891]">
            Média mensal
          </div>
          <div className="font-mono-num text-sm sm:text-base font-bold text-[#0B110E] dark:text-white mt-0.5">
            R$ {formatBRL(explorerData.windowAverage)}
          </div>
          <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] truncate">
            {explorerData.points.length} meses visíveis
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[11px] font-medium text-[#5C6660] dark:text-[#8C9891]">
            Total no período
          </div>
          <div className="font-mono-num text-sm sm:text-base font-bold text-[#56AD17] dark:text-[#8CE02C] mt-0.5">
            R$ {formatBRL(explorerData.windowTotal)}
          </div>
          <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] truncate">
            {activeCategories.length} de 5 séries
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[11px] font-medium text-[#5C6660] dark:text-[#8C9891]">
            Pico na janela
          </div>
          <div className="font-mono-num text-sm sm:text-base font-bold text-[#0B110E] dark:text-white mt-0.5 truncate">
            {explorerData.peakMonth.label} · R$ {formatBRL(explorerData.peakMonth.amount)}
          </div>
          <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] truncate">
            Menor: {explorerData.lowestMonth.label} (R$ {formatBRL(explorerData.lowestMonth.amount)})
          </div>
        </div>

        <div className="p-3.5">
          <div className="text-[11px] font-medium text-[#5C6660] dark:text-[#8C9891]">
            Variação mensal
          </div>
          <div
            className={`font-mono-num text-sm sm:text-base font-bold mt-0.5 flex items-center gap-1 ${
              explorerData.momDeltaPct <= 0
                ? 'text-[#56AD17] dark:text-[#8CE02C]'
                : 'text-[#D97706] dark:text-[#F59E0B]'
            }`}
          >
            {explorerData.momDeltaPct <= 0 ? (
              <ArrowDownRight className="w-4 h-4 shrink-0" />
            ) : (
              <ArrowUpRight className="w-4 h-4 shrink-0" />
            )}
            <span>
              {explorerData.momDeltaPct > 0 ? '+' : ''}
              {explorerData.momDeltaPct.toFixed(1).replace('.', ',')}%
            </span>
          </div>
          <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] truncate">
            Sobra: R$ {formatBRL(selectedPoint?.leftover || 0)}
          </div>
        </div>
      </div>

      {/* MAIN INTERACTIVE CHART CANVAS + DRILL-DOWN INSPECTOR */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left 8 cols: Dynamic Chart Viewport */}
        <div
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              if (e.deltaY < 0) handleZoomIn();
              else handleZoomOut();
            }
          }}
          className="lg:col-span-8 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#080B09] p-3.5 sm:p-4 flex flex-col justify-between"
        >
          {chartMode === 'stacked' && (
            <div className="overflow-x-auto no-scrollbar">
              <div
                className={`grid gap-1.5 sm:gap-2 items-end h-56 pt-6 pb-1 px-1 ${
                  explorerData.points.length > 6 ? 'min-w-[520px]' : ''
                }`}
                style={{
                  gridTemplateColumns: `repeat(${Math.max(1, explorerData.points.length)}, minmax(0, 1fr))`,
                }}
              >
                {explorerData.points.map((pt) => {
                  const isSelected = pt.monthKey === selectedPoint?.monthKey;
                  const totalHeightPct = Math.min(
                    100,
                    Math.max(8, Math.round((pt.filteredTotal / explorerData.yAxisMax) * 100))
                  );

                  return (
                    <button
                      key={pt.monthKey}
                      type="button"
                      onClick={() => setSelectedMonthKey(pt.monthKey)}
                      aria-label={`Inspecionar gastos de ${pt.fullMonthLabel}`}
                      className={`group flex flex-col items-center justify-end h-full rounded-xl p-1 sm:p-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#E4E7E5]/80 dark:bg-[#19221D] ring-1 ring-[#0B130F]/30 dark:ring-[#8CE02C]/50'
                          : 'hover:bg-[#F1F3F2] dark:hover:bg-[#111714]'
                      }`}
                    >
                      <span
                        className={`font-mono-num text-[10px] font-bold mb-1.5 transition-colors ${
                          isSelected
                            ? 'text-[#0B110E] dark:text-[#8CE02C]'
                            : 'text-[#5C6660] dark:text-[#8C9891]'
                        }`}
                      >
                        {(pt.filteredTotal / 1000).toFixed(1).replace('.', ',')}k
                      </span>

                      <div className="w-full max-w-[40px] h-36 bg-[#E4E7E5] dark:bg-[#19221D] rounded-lg overflow-hidden flex flex-col justify-end p-0.5">
                        <div
                          style={{ height: `${totalHeightPct}%` }}
                          className="w-full rounded-md overflow-hidden flex flex-col-reverse gap-[1px] transition-all duration-300"
                        >
                          {EXPENSE_CATEGORIES.map((cat) => {
                            const val = pt.categoryValues[cat.id];
                            if (!val || val <= 0 || pt.filteredTotal <= 0) return null;
                            const segPct = Math.max(
                              6,
                              Math.round((val / pt.filteredTotal) * 100)
                            );
                            return (
                              <div
                                key={cat.id}
                                style={{
                                  height: `${segPct}%`,
                                  backgroundColor: cat.color,
                                }}
                                className="w-full transition-all duration-300"
                                title={`${cat.label}: R$ ${formatBRL(val)}`}
                              />
                            );
                          })}
                        </div>
                      </div>

                      <span
                        className={`mt-2 text-[11px] font-bold ${
                          isSelected
                            ? 'text-[#0B110E] dark:text-[#8CE02C]'
                            : 'text-[#5C6660] dark:text-[#8C9891]'
                        }`}
                      >
                        {pt.monthLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {chartMode === 'area' && (
            <div className="h-56 flex flex-col justify-between overflow-x-auto no-scrollbar">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full min-w-[480px] h-48 overflow-visible"
                role="img"
                aria-label="Curva de tendência de gastos mensais"
              >
                <defs>
                  <linearGradient id="tapiocaAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8CE02C" stopOpacity="0.34" />
                    <stop offset="100%" stopColor="#0B130F" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = padY + plotH - ratio * plotH;
                  return (
                    <g key={ratio}>
                      <line
                        x1={padX}
                        y1={y}
                        x2={svgWidth - padX}
                        y2={y}
                        stroke="currentColor"
                        className="text-[#E4E7E5] dark:text-[#1B231F]"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      <text
                        x={4}
                        y={y + 3}
                        className="fill-[#5C6660] dark:fill-[#8C9891] text-[9px] font-mono-num"
                      >
                        {((explorerData.yAxisMax * ratio) / 1000).toFixed(0)}k
                      </text>
                    </g>
                  );
                })}

                {areaFillPath && <path d={areaFillPath} fill="url(#tapiocaAreaGrad)" />}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#56AD17"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {areaPoints.map(({ x, y, pt }) => {
                  const isSelected = pt.monthKey === selectedPoint?.monthKey;
                  return (
                    <g
                      key={pt.monthKey}
                      onClick={() => setSelectedMonthKey(pt.monthKey)}
                      className="cursor-pointer"
                    >
                      {isSelected && (
                        <circle cx={x} cy={y} r={10} fill="#8CE02C" fillOpacity={0.22} />
                      )}
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 5.5 : 4}
                        fill={isSelected ? '#8CE02C' : '#FFFFFF'}
                        stroke="#0B130F"
                        strokeWidth="2.5"
                      />
                      <text
                        x={x}
                        y={y - 10}
                        textAnchor="middle"
                        className="fill-[#0B110E] dark:fill-[#F3F5F4] text-[10px] font-bold font-mono-num"
                      >
                        {(pt.filteredTotal / 1000).toFixed(1).replace('.', ',')}k
                      </text>
                      <text
                        x={x}
                        y={svgHeight - 2}
                        textAnchor="middle"
                        className={`text-[10px] font-bold ${
                          isSelected
                            ? 'fill-[#0B110E] dark:fill-[#8CE02C]'
                            : 'fill-[#5C6660] dark:fill-[#8C9891]'
                        }`}
                      >
                        {pt.monthLabel}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {chartMode === 'waterfall' && selectedPoint && (
            <div className="space-y-3 py-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0B110E] dark:text-[#F3F5F4]">
                  Ponte de Fluxo (Waterfall) — {selectedPoint.fullMonthLabel}
                </span>
                <span className="font-mono-num text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                  Entradas R$ {formatBRL(selectedPoint.income)} → Sobra R${' '}
                  {formatBRL(waterfallSteps[waterfallSteps.length - 1]?.value || 0)}
                </span>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <div className="min-w-[460px] h-48 grid gap-2 items-end pt-4 pb-1" style={{ gridTemplateColumns: `repeat(${waterfallSteps.length}, minmax(0, 1fr))` }}>
                  {waterfallSteps.map((step) => {
                    const maxIncome = Math.max(1, selectedPoint.income);
                    const bottomPct = Math.round((step.start / maxIncome) * 100);
                    const heightPct = Math.max(4, Math.round(((step.end - step.start) / maxIncome) * 100));
                    return (
                      <div key={step.id} className="h-full flex flex-col items-center justify-end">
                        <span className="font-mono-num text-[10px] font-bold text-[#0B110E] dark:text-white mb-1 whitespace-nowrap">
                          {step.kind === 'expense' ? '–' : ''}R$ {Math.round(Math.abs(step.value))}
                        </span>
                        <div className="relative w-full max-w-[46px] h-32 bg-[#E4E7E5]/80 dark:bg-[#19221D] rounded-lg overflow-hidden">
                          <div
                            style={{
                              bottom: `${bottomPct}%`,
                              height: `${heightPct}%`,
                              backgroundColor: step.color,
                            }}
                            className="absolute left-1 right-1 rounded-md transition-all duration-300"
                          />
                        </div>
                        <span className="mt-1.5 text-[10px] font-semibold text-[#5C6660] dark:text-[#8C9891] truncate max-w-full">
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {chartMode === 'donut' && selectedPoint && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2 min-h-[224px]">
              <div className="relative w-44 h-44 shrink-0">
                <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
                  <circle
                    cx="90"
                    cy="90"
                    r="64"
                    fill="none"
                    stroke="currentColor"
                    className="text-[#E4E7E5] dark:text-[#19221D]"
                    strokeWidth="22"
                  />
                  {donutSegments.map((seg) => {
                    const isFocused = activeDonutCat === seg.id;
                    return (
                      <circle
                        key={seg.id}
                        cx="90"
                        cy="90"
                        r="64"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={isFocused ? 27 : 22}
                        strokeDasharray={seg.dasharray}
                        strokeDashoffset={seg.dashoffset}
                        onClick={() =>
                          setActiveDonutCat((prev) => (prev === seg.id ? null : seg.id))
                        }
                        className="cursor-pointer transition-all duration-200"
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
                  <span className="text-[10px] font-semibold text-[#5C6660] dark:text-[#8C9891]">
                    {activeDonutCat
                      ? donutSegments.find((d) => d.id === activeDonutCat)?.shortLabel
                      : selectedPoint.monthLabel}
                  </span>
                  <span className="font-mono-num text-base font-extrabold text-[#0B110E] dark:text-white leading-tight mt-0.5">
                    R${' '}
                    {formatBRL(
                      activeDonutCat
                        ? donutSegments.find((d) => d.id === activeDonutCat)?.value || 0
                        : selectedPoint.filteredTotal
                    )}
                  </span>
                </div>
              </div>

              <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {donutSegments.map((seg) => {
                  const isFocused = activeDonutCat === seg.id;
                  return (
                    <button
                      key={seg.id}
                      type="button"
                      onClick={() =>
                        setActiveDonutCat((prev) => (prev === seg.id ? null : seg.id))
                      }
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isFocused
                          ? 'bg-white dark:bg-[#19221D] border-[#0B130F] dark:border-[#8CE02C]'
                          : 'bg-white dark:bg-[#0D1210] border-[#E4E7E5] dark:border-[#1B231F]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 font-semibold text-[#0B110E] dark:text-white truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: seg.color }}
                          />
                          {seg.shortLabel}
                        </span>
                        <span className="font-mono-num font-bold text-[#56AD17] dark:text-[#8CE02C]">
                          {seg.pct}%
                        </span>
                      </div>
                      <div className="font-mono-num font-bold text-[#0B110E] dark:text-[#D5DBD8] mt-1">
                        R$ {formatBRL(seg.value)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {chartMode === 'couple' && (
            <div className="space-y-3 py-1 min-h-[224px] flex flex-col justify-between">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#0B110E] dark:text-[#F3F5F4]">
                  Comparativo Lado a Lado: {profile.displayName.split(' ')[0]} vs.{' '}
                  {profile.partnerName.split(' ')[0]}
                </span>
                <div className="flex items-center gap-3 text-[11px] font-semibold">
                  <span className="flex items-center gap-1.5 text-[#0B110E] dark:text-[#F3F5F4]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#0B130F] dark:bg-[#8CE02C]" />
                    {profile.displayName.split(' ')[0]}
                  </span>
                  <span className="flex items-center gap-1.5 text-[#B45309] dark:text-[#F59E0B]">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706]" />
                    {profile.partnerName.split(' ')[0]}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                {coupleComparison.rows.map((row) => {
                  const alanPct = Math.max(4, Math.round((row.alan / coupleComparison.maxVal) * 100));
                  const larissaPct = Math.max(4, Math.round((row.larissa / coupleComparison.maxVal) * 100));
                  return (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-[#5C6660] dark:text-[#D5DBD8]">
                          {row.label}
                        </span>
                        <span className="font-mono-num text-[#0B110E] dark:text-white">
                          R$ {formatBRL(row.alan)} / R$ {formatBRL(row.larissa)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="h-2 rounded-full bg-[#E4E7E5] dark:bg-[#19221D] overflow-hidden flex justify-end">
                          <div
                            style={{ width: `${alanPct}%` }}
                            className="h-full rounded-full bg-[#0B130F] dark:bg-[#8CE02C] transition-all duration-300"
                          />
                        </div>
                        <div className="h-2 rounded-full bg-[#E4E7E5] dark:bg-[#19221D] overflow-hidden">
                          <div
                            style={{ width: `${larissaPct}%` }}
                            className="h-full rounded-full bg-[#D97706] transition-all duration-300"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Range Bar */}
          <div className="mt-3 pt-3 border-t border-[#E4E7E5] dark:border-[#1B231F] flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-[#56AD17] dark:text-[#8CE02C]" />
              <span className="text-[11px] font-semibold text-[#5C6660] dark:text-[#8C9891]">
                Período:
              </span>
              <select
                aria-label="Mês inicial do zoom"
                value={startIndex}
                onChange={(e) => {
                  const nextStart = Number(e.target.value);
                  setStartIndex(Math.min(nextStart, endIndex));
                }}
                className="min-h-[32px] px-2 py-1 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-white dark:bg-[#0D1210] text-[11px] font-semibold text-[#0B110E] dark:text-[#F3F5F4]"
              >
                {annualSeries.map((m, idx) => (
                  <option key={m.monthKey} value={idx} disabled={idx > endIndex}>
                    De: {m.monthLabel}/26
                  </option>
                ))}
              </select>
              <span className="text-[#5C6660] dark:text-[#8C9891]">até</span>
              <select
                aria-label="Mês final do zoom"
                value={endIndex}
                onChange={(e) => {
                  const nextEnd = Number(e.target.value);
                  setEndIndex(Math.max(nextEnd, startIndex));
                }}
                className="min-h-[32px] px-2 py-1 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-white dark:bg-[#0D1210] text-[11px] font-semibold text-[#0B110E] dark:text-[#F3F5F4]"
              >
                {annualSeries.map((m, idx) => (
                  <option key={m.monthKey} value={idx} disabled={idx < startIndex}>
                    Até: {m.monthLabel}/26
                  </option>
                ))}
              </select>
            </div>

            <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] hidden sm:block">
              Toque em qualquer mês ou fatia para detalhar
            </div>
          </div>
        </div>

        {/* Right 4 cols: Selected Month Drill-Down Inspector */}
        {selectedPoint && (
          <div className="lg:col-span-4 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E4E7E5] dark:border-[#1B231F]">
                <div>
                  <span className="text-[11px] font-semibold text-[#56AD17] dark:text-[#8CE02C]">
                    Mês inspecionado
                  </span>
                  <h3 className="font-editorial text-base font-bold text-[#0B110E] dark:text-white mt-0.5">
                    {selectedPoint.fullMonthLabel}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">Total</div>
                  <div className="font-mono-num text-sm font-bold text-[#0B110E] dark:text-white">
                    R$ {formatBRL(selectedPoint.filteredTotal)}
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {EXPENSE_CATEGORIES.map((cat) => {
                  const isCatActive = activeCategories.includes(cat.id);
                  const rawAmount = selectedPoint[cat.id];
                  const pctOfFiltered =
                    selectedPoint.filteredTotal > 0 && isCatActive
                      ? Math.round((rawAmount / selectedPoint.filteredTotal) * 100)
                      : 0;

                  return (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                        isCatActive
                          ? 'border-[#E4E7E5] dark:border-[#1B231F] bg-white dark:bg-[#0D1210]'
                          : 'border-dashed border-[#E4E7E5] dark:border-[#1B231F] opacity-45'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#0B110E] dark:text-[#D5DBD8] flex items-center gap-1.5 truncate">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span className="truncate">{cat.label}</span>
                        </span>
                        <span className="font-mono-num font-bold text-[#0B110E] dark:text-white whitespace-nowrap ml-2">
                          R$ {formatBRL(rawAmount)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#E4E7E5] dark:bg-[#19221D] rounded-full overflow-hidden">
                          <div
                            style={{
                              width: `${isCatActive ? Math.max(4, pctOfFiltered) : 0}%`,
                              backgroundColor: cat.color,
                            }}
                            className="h-full rounded-full transition-all duration-300"
                          />
                        </div>
                        <span className="font-mono-num text-[10px] text-[#5C6660] dark:text-[#8C9891] w-8 text-right">
                          {isCatActive ? `${pctOfFiltered}%` : 'oculto'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {!compact && (
              <div className="mt-3 pt-3 border-t border-[#E4E7E5] dark:border-[#1B231F] flex items-center justify-between text-xs">
                <span className="text-[#5C6660] dark:text-[#8C9891]">Sobra Livre do Mês:</span>
                <span className="font-mono-num font-bold text-[#56AD17] dark:text-[#8CE02C]">
                  R$ {formatBRL(selectedPoint.leftover)} (
                  {Math.round((selectedPoint.leftover / Math.max(1, selectedPoint.income)) * 100)}
                  %)
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </SpotlightBento>
  );
}
