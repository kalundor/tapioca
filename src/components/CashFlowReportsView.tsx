import React, { useState, useMemo } from 'react';
import {
  TrendingDown,
  BellRing,
  ArrowDownRight,
  SlidersHorizontal,
  Plus,
  Send,
  AlertTriangle,
  Table2,
  BarChart3,
  Download,
  Calculator,
  Search,
  CheckCircle2,
} from 'lucide-react';
import {
  formatBRL,
  calculatePredictedBalance,
  calculateHouseSplit,
  buildMonthlyCashFlowHistory,
  deriveCostReductionSuggestions,
  roundCents,
  type BillItem,
  type CoupleProfile,
  type CostReductionSuggestion,
} from '../utils/financeMath';
import { MonthlyExpenseExplorer } from './MonthlyExpenseExplorer';
import { CategorySpendingD3Map } from './CategorySpendingD3Map';
import { SpotlightBento, AnimatedSegmentedControl } from './MotionPrimitives';

export interface TransactionRecord {
  id: number;
  description: string;
  merchant: string;
  amount: number;
  category: string;
  date: string;
  accountName: string;
  source: string;
  isRecurring: boolean;
  owner?: 'user' | 'partner';
}

export interface BudgetAlertRecord {
  id: number;
  category: string;
  limitAmount: number;
  currentSpent: number;
  isRead: boolean;
  pushEnabled: boolean;
}

interface CashFlowReportsViewProps {
  profile: CoupleProfile;
  bills: BillItem[];
  transactions: TransactionRecord[];
  budgetAlerts: BudgetAlertRecord[];
  onApplySavingsSuggestion: (suggestion: CostReductionSuggestion) => void;
  onTriggerPushNotification: (title: string, body: string) => void;
}

export function CashFlowReportsView({
  profile,
  bills,
  transactions,
  budgetAlerts,
  onApplySavingsSuggestion,
  onTriggerPushNotification,
}: CashFlowReportsViewProps) {
  const [studioTab, setStudioTab] = useState<'charts' | 'spreadsheet'>('charts');
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(5);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Record<string, boolean>>({});
  const [customAlertCategory, setCustomAlertCategory] = useState('Transporte App (Uber & 99)');
  const [customAlertLimit, setCustomAlertLimit] = useState('60');
  const [localAlerts, setLocalAlerts] = useState<BudgetAlertRecord[]>(budgetAlerts);

  // Excel-style live editable budget matrix & What-If Simulator states
  const [sheetSearch, setSheetSearch] = useState('');
  const [budgetOverrides, setBudgetOverrides] = useState<Record<number, number>>({});
  const [simExtraMonthly, setSimExtraMonthly] = useState<number>(250);
  const [simExpenseCutPct, setSimExpenseCutPct] = useState<number>(12);
  const [simCdiAnnualPct, setSimCdiAnnualPct] = useState<number>(11.25);
  const [simHorizonMonths, setSimHorizonMonths] = useState<12 | 24 | 36>(24);

  const predicted = calculatePredictedBalance(profile, bills);
  const houseSplit = calculateHouseSplit(bills);

  const monthlyHistory = useMemo(
    () => buildMonthlyCashFlowHistory(transactions, bills, profile),
    [transactions, bills, profile]
  );

  const costReductionSuggestions = useMemo(
    () => deriveCostReductionSuggestions(transactions, bills),
    [transactions, bills]
  );

  const totalMonthlySavingsPotential = costReductionSuggestions.reduce(
    (acc, s) => acc + s.potentialMonthlySavings,
    0
  );

  const categoryBreakdown = [
    {
      id: 'personal_card',
      label: 'Faturas Nubank/Inter & Aporte CDB Porquinho',
      amount: predicted.personalBillsTotal,
      pct: predicted.personalBillsPct,
      color: '#0B130F',
    },
    {
      id: 'house_share',
      label: 'Sua Metade da Casa (Claro, Mercado, Saúde)',
      amount: houseSplit.eachShare50,
      pct: predicted.userHouseSharePct,
      color: '#D97706',
    },
    {
      id: 'savings_sobra',
      label: 'Sobra Livre Prevista no Mês',
      amount: predicted.predictedLeftover,
      pct: predicted.predictedLeftoverPct,
      color: '#56AD17',
    },
    {
      id: 'day_to_day',
      label: 'Gastos Dia a Dia (Padaria, Pix & Lanches)',
      amount: predicted.dayToDayBudget,
      pct: predicted.dayToDayPct,
      color: '#64748B',
    },
  ];

  // Live Excel Matrix Rows derived directly from bills
  const sheetRows = useMemo(() => {
    const query = sheetSearch.trim().toLowerCase();
    const salaryBase = Math.max(1, profile.userSalary + profile.partnerSalary);

    return bills
      .filter((b) => !query || b.title.toLowerCase().includes(query))
      .map((bill) => {
        const planned =
          budgetOverrides[bill.id] !== undefined
            ? budgetOverrides[bill.id]
            : roundCents(bill.amount * 1.05);
        const actual = bill.amount;
        const variance = roundCents(planned - actual);
        const pctIncome = Math.round((actual / salaryBase) * 1000) / 10;
        return {
          ...bill,
          planned,
          actual,
          variance,
          pctIncome,
        };
      });
  }, [bills, budgetOverrides, sheetSearch, profile.userSalary, profile.partnerSalary]);

  const sheetTotals = useMemo(() => {
    const planned = roundCents(sheetRows.reduce((acc, r) => acc + r.planned, 0));
    const actual = roundCents(sheetRows.reduce((acc, r) => acc + r.actual, 0));
    const variance = roundCents(planned - actual);
    return { planned, actual, variance };
  }, [sheetRows]);

  // Compound CDI What-If Simulation
  const simProjection = useMemo(() => {
    const monthlyRate = Math.pow(1 + simCdiAnnualPct / 100, 1 / 12) - 1;
    const baselineContribution = Math.max(80, predicted.predictedLeftover * 0.45);
    const totalBillsSpend = bills.reduce((acc, b) => acc + b.amount, 0);
    const optimizedMonthlyExtra = simExtraMonthly + (totalBillsSpend * simExpenseCutPct) / 100;
    const optimizedContribution = baselineContribution + optimizedMonthlyExtra;

    const points: Array<{ month: number; baseline: number; optimized: number }> = [];
    let balBase = 515.9;
    let balOpt = 515.9;

    for (let m = 0; m <= simHorizonMonths; m++) {
      points.push({ month: m, baseline: roundCents(balBase), optimized: roundCents(balOpt) });
      balBase = balBase * (1 + monthlyRate) + baselineContribution;
      balOpt = balOpt * (1 + monthlyRate) + optimizedContribution;
    }

    const last = points[points.length - 1];
    return {
      points,
      finalBaseline: last.baseline,
      finalOptimized: last.optimized,
      extraGain: roundCents(last.optimized - last.baseline),
      optimizedContribution: roundCents(optimizedContribution),
    };
  }, [bills, predicted.predictedLeftover, simExtraMonthly, simExpenseCutPct, simCdiAnnualPct, simHorizonMonths]);

  const handleDownloadMatrixCsv = () => {
    const header = [
      'Conta / Descricao',
      'Tipo',
      'Responsavel',
      'Status',
      'Orçado (R$)',
      'Realizado (R$)',
      'Desvio (R$)',
      '% Renda Casal',
    ].join(';');
    const lines = sheetRows.map((r) =>
      [
        r.title.replace(/;/g, ','),
        r.isShared ? 'Casal 50/50' : 'Individual',
        r.paidBy === 'user' ? 'Alan' : profile.partnerName,
        r.isPaid ? 'Paga' : 'Em aberto',
        r.planned.toFixed(2).replace('.', ','),
        r.actual.toFixed(2).replace('.', ','),
        r.variance.toFixed(2).replace('.', ','),
        `${r.pctIncome.toFixed(1).replace('.', ',')}%`,
      ].join(';')
    );
    const csv = '\uFEFF' + [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tapioca-pay-matriz-orcamento.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onTriggerPushNotification(
      'Planilha Exportada',
      'Arquivo .csv compatível com Microsoft Excel e Google Sheets gerado com sucesso.'
    );
  };

  const safeSelectedMonthIdx = Math.min(selectedMonthIdx, Math.max(0, monthlyHistory.length - 1));
  const activeMonthData = monthlyHistory[safeSelectedMonthIdx] || monthlyHistory[0];

  const handleCreateCustomAlert = (e: React.FormEvent) => {
    e.preventDefault();
    const limitNum = Number(customAlertLimit.replace(',', '.'));
    if (!customAlertCategory.trim() || isNaN(limitNum) || limitNum <= 0) return;

    const newAlert: BudgetAlertRecord = {
      id: Date.now(),
      category: customAlertCategory.trim(),
      limitAmount: limitNum,
      currentSpent: limitNum * 1.08,
      isRead: false,
      pushEnabled: true,
    };
    setLocalAlerts((prev) => [newAlert, ...prev]);
    onTriggerPushNotification(
      `Alerta Configurado: ${newAlert.category}`,
      `Teto definido em R$ ${formatBRL(limitNum)}. Você receberá alertas em tempo real se ultrapassar esse limite.`
    );
  };

  // Simulator SVG geometry
  const simW = 540;
  const simH = 160;
  const simPadX = 24;
  const simPadY = 16;
  const simMaxVal = Math.max(1000, simProjection.finalOptimized);
  const simBaselinePath = simProjection.points
    .map((pt, i) => {
      const x = simPadX + (i / Math.max(1, simProjection.points.length - 1)) * (simW - simPadX * 2);
      const y = simH - simPadY - (pt.baseline / simMaxVal) * (simH - simPadY * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const simOptimizedPath = simProjection.points
    .map((pt, i) => {
      const x = simPadX + (i / Math.max(1, simProjection.points.length - 1)) * (simW - simPadX * 2);
      const y = simH - simPadY - (pt.optimized / simMaxVal) * (simH - simPadY * 2);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="space-y-6 animate-enter">
      {/* STUDIO SUB-NAVIGATION BAR (Charts vs Live Excel Matrix) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-editorial text-2xl font-bold text-[#0B110E] dark:text-[#F3F5F4]">
            Fluxo, Gráficos &amp;{' '}
            <span className="font-accent-serif text-[#56AD17] dark:text-[#8CE02C] font-semibold">
              Planilha Viva
            </span>
          </h1>
          <p className="text-xs text-[#5C6660] dark:text-[#8C9891] mt-0.5">
            Análise multidimensional Pluggy com matriz orçamentária editável e projeção CDI
          </p>
        </div>

        <AnimatedSegmentedControl
          options={[
            {
              id: 'charts',
              label: 'Gráficos & Relatórios',
              icon: <BarChart3 className="w-3.5 h-3.5" />,
            },
            {
              id: 'spreadsheet',
              label: 'Planilha & Simulador CDI',
              icon: <Table2 className="w-3.5 h-3.5" />,
            },
          ]}
          value={studioTab}
          onChange={setStudioTab}
          layoutId="cashflow-studio-mode"
          ariaLabel="Modo do estúdio financeiro"
        />
      </div>

      {/* UNIFIED HAIRLINE KPI STRIP (Mercury Architectural Strip) */}
      <SpotlightBento className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E4E7E5] dark:divide-[#1B231F]">
          <div className="p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6660] dark:text-[#8C9891]">
              Receita Total do Casal
            </div>
            <div className="font-display-num text-2xl sm:text-3xl font-bold text-[#0B110E] dark:text-white mt-2">
              R$ {formatBRL(profile.userSalary + profile.partnerSalary)}
            </div>
            <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] mt-1.5">
              Alan: R$ {formatBRL(profile.userSalary)} · {profile.partnerName.split(' ')[0]}: R${' '}
              {formatBRL(profile.partnerSalary)}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6660] dark:text-[#8C9891]">
              Potencial de Redução Detectado
            </div>
            <div className="font-display-num text-2xl sm:text-3xl font-bold text-[#56AD17] dark:text-[#8CE02C] mt-2">
              R$ {formatBRL(totalMonthlySavingsPotential)}/mês
            </div>
            <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] mt-1.5">
              Em 12 meses:{' '}
              <strong className="font-mono-num text-[#0B110E] dark:text-white">
                R$ {formatBRL(totalMonthlySavingsPotential * 12)}
              </strong>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6660] dark:text-[#8C9891]">
              Alertas de Despesas Excedentes
            </div>
            <div className="font-display-num text-2xl sm:text-3xl font-bold text-[#D97706] dark:text-[#F59E0B] mt-2">
              {localAlerts.length} alertas ativos
            </div>
            <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] mt-1.5">
              Monitoramento automático via Pluggy Open Finance
            </div>
          </div>
        </div>
      </SpotlightBento>

      {studioTab === 'charts' ? (
        <>
          {/* FULL 5-MODE INTERACTIVE CHART STUDIO */}
          <MonthlyExpenseExplorer profile={profile} bills={bills} transactions={transactions} />

          {/* D3.JS CATEGORY SPENDING TREEMAP & CIRCULAR PACKING */}
          <CategorySpendingD3Map
            transactions={transactions}
            bills={bills}
            partnerName={profile.partnerName}
            instanceId="cashflow"
          />

          {/* INTERACTIVE CHARTS ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <SpotlightBento
              as="section"
              aria-label="Evolução Mensal de Gastos e Sobra"
              className="lg:col-span-7 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="font-editorial text-lg font-semibold text-[#0B110E] dark:text-white">
                    Fluxo de Caixa — Semestre
                  </h2>
                  <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
                    Série real via Open Finance · Toque em qualquer mês para inspecionar
                  </p>
                </div>
                <div className="font-mono-num text-xs bg-[#F1F3F2] dark:bg-[#111714] px-3 py-1.5 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F]">
                  <span className="text-[#5C6660] dark:text-[#8C9891] mr-1.5">{activeMonthData.month}/26:</span>
                  <strong className="text-[#56AD17] dark:text-[#8CE02C]">
                    Sobra R$ {formatBRL(activeMonthData.leftover)}
                  </strong>
                </div>
              </div>

              <div
                className="grid gap-2 sm:gap-3 items-end h-52 pt-6 pb-2 px-1 sm:px-2 border-b border-[#E4E7E5] dark:border-[#1B231F]"
                style={{
                  gridTemplateColumns: `repeat(${Math.max(1, monthlyHistory.length)}, minmax(0, 1fr))`,
                }}
              >
                {monthlyHistory.map((item, idx) => {
                  const isSelected = idx === safeSelectedMonthIdx;
                  const baseIncome = Math.max(1, item.income);
                  const houseHeight = Math.min(70, Math.round((item.house / baseIncome) * 100));
                  const personalHeight = Math.min(
                    85 - houseHeight,
                    Math.round((item.personal / baseIncome) * 100)
                  );
                  const leftoverHeight = Math.max(8, 100 - houseHeight - personalHeight);

                  return (
                    <button
                      key={item.monthKey}
                      type="button"
                      onClick={() => setSelectedMonthIdx(idx)}
                      aria-label={`Inspecionar fluxo de ${item.month}`}
                      className={`group flex flex-col items-center h-full justify-end rounded-xl p-1 sm:p-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#E4E7E5]/80 dark:bg-[#19221D] ring-1 ring-[#0B130F]/30 dark:ring-[#8CE02C]/50'
                          : 'hover:bg-[#F1F3F2] dark:hover:bg-[#111714]'
                      }`}
                    >
                      <span className="font-mono-num text-[10px] font-semibold text-[#5C6660] dark:text-[#8C9891] mb-1.5">
                        R$ {Math.round(item.leftover)}
                      </span>
                      <div className="w-full max-w-[38px] h-32 rounded-lg overflow-hidden flex flex-col-reverse gap-0.5 bg-[#E4E7E5] dark:bg-[#19221D]">
                        <div
                          style={{ height: `${houseHeight}%` }}
                          className="bg-[#0B130F] dark:bg-[#33463C] w-full transition-all duration-300"
                          title={`Casa: R$ ${formatBRL(item.house)}`}
                        />
                        <div
                          style={{ height: `${personalHeight}%` }}
                          className="bg-[#D97706] w-full transition-all duration-300"
                          title={`Pessoal: R$ ${formatBRL(item.personal)}`}
                        />
                        <div
                          style={{ height: `${leftoverHeight}%` }}
                          className="bg-[#56AD17] dark:bg-[#8CE02C] w-full transition-all duration-300"
                          title={`Sobra: R$ ${formatBRL(item.leftover)}`}
                        />
                      </div>
                      <span
                        className={`mt-2 text-xs font-semibold ${
                          isSelected
                            ? 'text-[#0B110E] dark:text-[#8CE02C]'
                            : 'text-[#5C6660] dark:text-[#8C9891]'
                        }`}
                      >
                        {item.month}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#5C6660] dark:text-[#8C9891]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#0B130F] dark:bg-[#33463C]" /> Casa (R${' '}
                  {formatBRL(activeMonthData.house)})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706]" /> Pessoal &amp; CDB (R${' '}
                  {formatBRL(activeMonthData.personal)})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-[#56AD17] dark:bg-[#8CE02C]" /> Sobra Livre (R${' '}
                  {formatBRL(activeMonthData.leftover)})
                </span>
              </div>
            </SpotlightBento>

            <SpotlightBento
              as="section"
              aria-label="Distribuição por Categoria"
              className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between"
            >
              <div>
                <h2 className="font-editorial text-lg font-semibold text-[#0B110E] dark:text-white">
                  Composição do Orçamento
                </h2>
                <p className="text-xs text-[#5C6660] dark:text-[#8C9891] mt-0.5">
                  Baseado nas entradas líquidas de R$ {formatBRL(predicted.salary)}
                </p>

                <div className="mt-4 space-y-3">
                  {categoryBreakdown.map((cat) => (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="font-medium text-[#0B110E] dark:text-[#D5DBD8] truncate">
                          {cat.label}
                        </span>
                        <span className="font-mono-num font-bold text-[#0B110E] dark:text-white whitespace-nowrap shrink-0">
                          R$ {formatBRL(cat.amount)}{' '}
                          <span className="text-[#5C6660] dark:text-[#8C9891] font-normal">({cat.pct}%)</span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-[#E4E7E5] dark:bg-[#19221D] rounded-full overflow-hidden">
                        <div
                          style={{ width: `${Math.max(4, cat.pct)}%`, backgroundColor: cat.color }}
                          className="h-full rounded-full transition-all duration-300"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-[#E4E7E5] dark:border-[#1B231F] flex items-center justify-between text-xs">
                <span className="text-[#5C6660] dark:text-[#8C9891]">Eficiência Financeira</span>
                <span className="font-mono-num font-bold text-[#56AD17] dark:text-[#8CE02C]">
                  {predicted.predictedLeftoverPct}% livre + CDB Inter
                </span>
              </div>
            </SpotlightBento>
          </div>

          {/* DETAILED COST REDUCTION REPORT & PUSH ALERTS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <SpotlightBento
              as="section"
              aria-label="Sugestões Automáticas de Redução de Custos"
              className="lg:col-span-7 p-5 sm:p-6"
            >
              <div className="mb-4">
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[#56AD17] dark:text-[#8CE02C]" />
                  <h2 className="font-editorial text-lg font-semibold text-[#0B110E] dark:text-white">
                    Sugestões de Redução de Custos
                  </h2>
                </div>
                <p className="text-xs text-[#5C6660] dark:text-[#8C9891] mt-0.5">
                  Diagnóstico gerado a partir das movimentações sincronizadas via Pluggy Open Finance
                </p>
              </div>

              <div className="space-y-3">
                {costReductionSuggestions.map((s) => {
                  const isApplied = Boolean(appliedSuggestions[s.id]);
                  return (
                    <div
                      key={s.id}
                      className="p-4 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-[#5C6660] dark:text-[#8C9891]">
                          <span className="font-semibold text-[#0B110E] dark:text-[#D5DBD8]">
                            {s.category}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Atual: R$ {formatBRL(s.currentMonthlySpend)}/mês</span>
                        </div>
                        <h3 className="text-sm font-bold text-[#0B110E] dark:text-white">{s.title}</h3>
                        <p className="text-xs text-[#5C6660] dark:text-[#8C9891] leading-relaxed">
                          {s.reason}
                        </p>
                      </div>

                      <div className="sm:text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between gap-2">
                        <div>
                          <div className="font-mono-num text-sm font-bold text-[#56AD17] dark:text-[#8CE02C] flex items-center sm:justify-end gap-0.5">
                            <ArrowDownRight className="w-4 h-4" />
                            <span>– R$ {formatBRL(s.potentialMonthlySavings)}/mês</span>
                          </div>
                          <div className="font-mono-num text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                            R$ {formatBRL(s.annualSavings)} / ano
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isApplied}
                          onClick={() => {
                            setAppliedSuggestions((prev) => ({ ...prev, [s.id]: true }));
                            onApplySavingsSuggestion(s);
                          }}
                          className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                            isApplied
                              ? 'bg-[#EAF5D8] dark:bg-[#16271D] text-[#3B7A1E] dark:text-[#8CE02C]'
                              : 'bg-[#0B130F] dark:bg-[#8CE02C] hover:opacity-90 text-white dark:text-[#060807]'
                          }`}
                        >
                          {isApplied ? 'Meta Aplicada ✓' : s.actionLabel}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SpotlightBento>

            <SpotlightBento
              as="section"
              aria-label="Alertas Push de Despesas Excedentes"
              className="lg:col-span-5 p-5 sm:p-6 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <BellRing className="w-4 h-4 text-[#0B110E] dark:text-[#8CE02C]" />
                    <h2 className="font-editorial text-lg font-semibold text-[#0B110E] dark:text-white">
                      Alertas de Teto
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onTriggerPushNotification(
                        'Alerta Open Finance — Tapioca Pay',
                        'Gastos com Uber & 99 atingiram R$ 71,94 (acima do teto mensal de R$ 60,00).'
                      )
                    }
                    className="min-h-[34px] px-2.5 py-1 text-[11px] font-semibold bg-[#EAF5D8] dark:bg-[#16271D] text-[#0B110E] dark:text-[#8CE02C] rounded-lg hover:opacity-90 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3 h-3" /> Testar Push
                  </button>
                </div>

                <p className="text-xs text-[#5C6660] dark:text-[#8C9891] mb-4">
                  Notificações automáticas quando uma categoria ultrapassar o limite mensal do casal.
                </p>

                <div className="space-y-2.5">
                  {localAlerts.map((alert) => {
                    const excess = Math.max(0, alert.currentSpent - alert.limitAmount);
                    const pct = Math.round(
                      (alert.currentSpent / Math.max(1, alert.limitAmount)) * 100
                    );
                    return (
                      <div
                        key={alert.id}
                        className="p-3 rounded-xl border border-amber-300/70 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#0B110E] dark:text-white flex items-center gap-1.5 min-w-0 truncate">
                            <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                            <span className="truncate">{alert.category}</span>
                          </span>
                          <span className="font-mono-num font-bold text-[#B45309] dark:text-[#F59E0B] shrink-0">
                            + R$ {formatBRL(excess)} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                          <span>Teto: R$ {formatBRL(alert.limitAmount)}</span>
                          <span className="font-mono-num">
                            Atual: R$ {formatBRL(alert.currentSpent)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <form
                onSubmit={handleCreateCustomAlert}
                className="mt-5 pt-4 border-t border-[#E4E7E5] dark:border-[#1B231F] space-y-3"
              >
                <div className="text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#56AD17]" />
                  <span>Criar novo gatilho de alerta</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-[#5C6660] dark:text-[#8C9891] mb-1">
                      Categoria monitorada
                    </label>
                    <input
                      type="text"
                      value={customAlertCategory}
                      onChange={(e) => setCustomAlertCategory(e.target.value)}
                      placeholder="Ex: Lazer & Bares"
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] text-[#0B110E] dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#5C6660] dark:text-[#8C9891] mb-1">
                      Teto mensal (R$)
                    </label>
                    <input
                      type="number"
                      value={customAlertLimit}
                      onChange={(e) => setCustomAlertLimit(e.target.value)}
                      placeholder="600"
                      className="w-full min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] text-[#0B110E] dark:text-white font-mono-num"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="min-h-[42px] w-full py-2 text-xs font-semibold text-white dark:text-[#060807] bg-[#0B130F] dark:bg-[#8CE02C] hover:opacity-90 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#8CE02C] dark:text-[#060807]" /> Ativar Alerta nesta Categoria
                </button>
              </form>
            </SpotlightBento>
          </div>
        </>
      ) : (
        /* TAB 2: EXCEL-GRADE MATRIX + COMPOUND CDI WHAT-IF SIMULATOR */
        <div className="space-y-6">
          {/* LIVE EDITABLE SPREADSHEET MATRIX */}
          <SpotlightBento className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#E4E7E5] dark:border-[#1B231F]">
              <div>
                <h2 className="font-editorial text-lg font-semibold text-[#0B110E] dark:text-white">
                  Planilha Orçamentária Editável — Nov/2026
                </h2>
                <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
                  Edite o valor previsto em qualquer linha para simular desvios em tempo real ou exporte em Excel
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {Object.keys(budgetOverrides).length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBudgetOverrides({})}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#F1F3F2] dark:bg-[#111714] text-[#0B110E] dark:text-[#F3F5F4] text-xs font-semibold cursor-pointer"
                  >
                    Resetar desvios
                  </button>
                )}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#5C6660] dark:text-[#8C9891] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={sheetSearch}
                    onChange={(e) => setSheetSearch(e.target.value)}
                    placeholder="Filtrar linha..."
                    className="min-h-[38px] pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] text-[#0B110E] dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDownloadMatrixCsv}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#0B130F] dark:bg-[#8CE02C] hover:opacity-90 text-white dark:text-[#060807] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#8CE02C] dark:text-[#060807]" />
                  <span>Baixar Planilha (.csv)</span>
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E4E7E5] dark:border-[#1B231F] text-[11px] font-semibold text-[#5C6660] dark:text-[#8C9891]">
                    <th className="py-2.5 pr-4">Linha / Lançamento</th>
                    <th className="py-2.5 px-3">Divisão</th>
                    <th className="py-2.5 px-3 text-right">Previsto / Meta (R$)</th>
                    <th className="py-2.5 px-3 text-right">Realizado (R$)</th>
                    <th className="py-2.5 px-3 text-right">Desvio (R$)</th>
                    <th className="py-2.5 pl-3 text-right">% Renda</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7E5] dark:divide-[#1B231F]">
                  {sheetRows.map((row) => {
                    const isWithin = row.variance >= 0;
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-[#F7F8F7] dark:hover:bg-[#111714] transition-colors"
                      >
                        <td className="py-2.5 pr-4 font-semibold text-[#0B110E] dark:text-white max-w-[260px] truncate">
                          {row.title}
                        </td>
                        <td className="py-2.5 px-3 text-[#5C6660] dark:text-[#8C9891] whitespace-nowrap">
                          {row.isShared ? '50/50 Casal' : 'Individual'} ·{' '}
                          {row.paidBy === 'user' ? 'Alan' : profile.partnerName.split(' ')[0]}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="1"
                            value={row.planned}
                            onChange={(e) => {
                              const nextVal = Math.max(0, Number(e.target.value) || 0);
                              setBudgetOverrides((prev) => ({ ...prev, [row.id]: nextVal }));
                            }}
                            aria-label={`Previsto para ${row.title}`}
                            className="w-24 text-right font-mono-num px-2 py-1 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] text-[#0B110E] dark:text-white"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-num font-bold text-[#0B110E] dark:text-white whitespace-nowrap">
                          R$ {formatBRL(row.actual)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono-num font-bold whitespace-nowrap ${
                            isWithin
                              ? 'text-[#56AD17] dark:text-[#8CE02C]'
                              : 'text-[#D97706] dark:text-[#F59E0B]'
                          }`}
                        >
                          {isWithin ? '+' : ''}R$ {formatBRL(row.variance)}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono-num text-[#5C6660] dark:text-[#8C9891]">
                          {row.pctIncome.toFixed(1).replace('.', ',')}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-[#0B130F]/25 dark:border-[#8CE02C]/30 bg-[#F1F3F2] dark:bg-[#111714] font-bold">
                    <td colSpan={2} className="py-3 pr-4 pl-2 text-[#0B110E] dark:text-white">
                      TOTAL CONSOLIDADO ({sheetRows.length} linhas)
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-[#0B110E] dark:text-white">
                      R$ {formatBRL(sheetTotals.planned)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-[#0B110E] dark:text-white">
                      R$ {formatBRL(sheetTotals.actual)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono-num ${
                        sheetTotals.variance >= 0
                          ? 'text-[#56AD17] dark:text-[#8CE02C]'
                          : 'text-[#D97706] dark:text-[#F59E0B]'
                      }`}
                    >
                      {sheetTotals.variance >= 0 ? '+' : ''}R$ {formatBRL(sheetTotals.variance)}
                    </td>
                    <td className="py-3 pl-3 pr-2 text-right font-mono-num text-[#56AD17] dark:text-[#8CE02C]">
                      {Math.round(
                        (sheetTotals.actual / Math.max(1, profile.userSalary + profile.partnerSalary)) * 100
                      )}
                      %
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SpotlightBento>

          {/* COMPOUND CDI WHAT-IF WEALTH SIMULATOR */}
          <SpotlightBento className="p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-[#E4E7E5] dark:border-[#1B231F]">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-lg bg-[#EAF5D8] dark:bg-[#16271D] flex items-center justify-center text-[#56AD17] dark:text-[#8CE02C] shrink-0">
                  <Calculator className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="font-editorial text-lg font-semibold text-[#0B110E] dark:text-white">
                    Simulador Patrimonial &ldquo;E se?&rdquo; — 100% CDI
                  </h2>
                  <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
                    Simule quanto vocês acumulam ajustando aportes extras e cortes inteligentes de gastos
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 bg-[#F1F3F2] dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F] p-1 rounded-lg text-xs font-semibold">
                {([12, 24, 36] as const).map((months) => (
                  <button
                    key={months}
                    type="button"
                    onClick={() => setSimHorizonMonths(months)}
                    className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                      simHorizonMonths === months
                        ? 'bg-white dark:bg-[#19221D] text-[#0B110E] dark:text-[#8CE02C] shadow-2xs'
                        : 'text-[#5C6660] dark:text-[#8C9891]'
                    }`}
                  >
                    {months} meses
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Sliders */}
              <div className="lg:col-span-5 space-y-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#0B110E] dark:text-[#D5DBD8]">Aporte extra mensal</span>
                    <span className="font-mono-num text-[#56AD17] dark:text-[#8CE02C]">
                      + R$ {formatBRL(simExtraMonthly)}/mês
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2000}
                    step={50}
                    value={simExtraMonthly}
                    onChange={(e) => setSimExtraMonthly(Number(e.target.value))}
                    className="w-full accent-[#0B130F] dark:accent-[#8CE02C]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#0B110E] dark:text-[#D5DBD8]">
                      Otimização nas despesas atuais
                    </span>
                    <span className="font-mono-num text-[#56AD17] dark:text-[#8CE02C]">
                      {simExpenseCutPct}% de corte
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={35}
                    step={1}
                    value={simExpenseCutPct}
                    onChange={(e) => setSimExpenseCutPct(Number(e.target.value))}
                    className="w-full accent-[#0B130F] dark:accent-[#8CE02C]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#0B110E] dark:text-[#D5DBD8]">Taxa CDI Anual (%)</span>
                    <span className="font-mono-num text-[#0B110E] dark:text-white">
                      {simCdiAnnualPct.toFixed(2).replace('.', ',')}% a.a.
                    </span>
                  </div>
                  <input
                    type="range"
                    min={7}
                    max={15}
                    step={0.25}
                    value={simCdiAnnualPct}
                    onChange={(e) => setSimCdiAnnualPct(Number(e.target.value))}
                    className="w-full accent-[#0B130F] dark:accent-[#8CE02C]"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-[#EAF5D8] dark:bg-[#16271D] border border-[#8CE02C]/30 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-[#0B110E] dark:text-[#8CE02C]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Ganho extra em {simHorizonMonths} meses: +R$ {formatBRL(simProjection.extraGain)}</span>
                  </div>
                  <p className="text-[11px] text-[#35443C] dark:text-[#B9C5BE]">
                    Patrimônio otimizado chega a{' '}
                    <strong className="font-mono-num">R$ {formatBRL(simProjection.finalOptimized)}</strong>{' '}
                    contra R$ {formatBRL(simProjection.finalBaseline)} no ritmo atual.
                  </p>
                </div>
              </div>

              {/* Comparison Curve Chart */}
              <div className="lg:col-span-7 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#080B09] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs">
                  <span className="font-semibold text-[#0B110E] dark:text-white">
                    Curva de Acumulação em {simHorizonMonths} Meses
                  </span>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1.5 text-[#56AD17] dark:text-[#8CE02C] font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#8CE02C]" />
                      Otimizado (R$ {formatBRL(simProjection.finalOptimized)})
                    </span>
                    <span className="flex items-center gap-1.5 text-[#5C6660] dark:text-[#8C9891]">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#64748B]" />
                      Atual (R$ {formatBRL(simProjection.finalBaseline)})
                    </span>
                  </div>
                </div>

                <svg viewBox={`0 0 ${simW} ${simH}`} className="w-full h-44 overflow-visible">
                  <defs>
                    <linearGradient id="cdiCurveFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8CE02C" stopOpacity="0.28" />
                      <stop offset="100%" stopColor="#8CE02C" stopOpacity="0.01" />
                    </linearGradient>
                  </defs>
                  <line
                    x1={simPadX}
                    y1={simH - simPadY}
                    x2={simW - simPadX}
                    y2={simH - simPadY}
                    stroke="currentColor"
                    className="text-[#E4E7E5] dark:text-[#1B231F]"
                  />
                  <line
                    x1={simPadX}
                    y1={simH / 2}
                    x2={simW - simPadX}
                    y2={simH / 2}
                    stroke="currentColor"
                    strokeDasharray="3 3"
                    className="text-[#E4E7E5] dark:text-[#1B231F]"
                  />
                  {simOptimizedPath && (
                    <path
                      d={`${simOptimizedPath} L ${simW - simPadX} ${simH - simPadY} L ${simPadX} ${simH - simPadY} Z`}
                      fill="url(#cdiCurveFill)"
                    />
                  )}
                  <path
                    d={simBaselinePath}
                    fill="none"
                    stroke="#64748B"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                  <path
                    d={simOptimizedPath}
                    fill="none"
                    stroke="#56AD17"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>

                <div className="mt-2 flex items-center justify-between text-[11px] font-mono-num text-[#5C6660] dark:text-[#8C9891]">
                  <span>Hoje (R$ 515,90)</span>
                  <span>Mês {Math.round(simHorizonMonths / 2)}</span>
                  <span>Mês {simHorizonMonths} (R$ {formatBRL(simProjection.finalOptimized)})</span>
                </div>
              </div>
            </div>
          </SpotlightBento>
        </div>
      )}
    </div>
  );
}
