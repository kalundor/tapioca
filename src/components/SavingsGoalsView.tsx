import React, { useState } from 'react';
import { Plus, Target, ArrowUpRight, Sparkles } from 'lucide-react';
import { formatBRL } from '../utils/financeMath';
import { SpotlightBento, NumberTicker, ShimmerActionButton } from './MotionPrimitives';
import { CircularGaugeSvg } from './BrandAssets';

export interface SavingsGoalRecord {
  id: number;
  title: string;
  category: string;
  currentAmount: number;
  targetAmount: number;
  monthlyContribution: number;
  deadline: string;
}

interface SavingsGoalsViewProps {
  goals: SavingsGoalRecord[];
  onCreateGoal: (payload: {
    title: string;
    category: string;
    targetAmount: number;
    monthlyContribution: number;
    deadline: string;
  }) => Promise<void>;
  onContributeGoal: (goalId: number, amount: number) => Promise<void>;
}

export function SavingsGoalsView({
  goals,
  onCreateGoal,
  onContributeGoal,
}: SavingsGoalsViewProps) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Nossa Casa');
  const [targetAmount, setTargetAmount] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [deadline, setDeadline] = useState('Dezembro 2027');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customGoalId, setCustomGoalId] = useState<number | null>(null);
  const [customAmountInput, setCustomAmountInput] = useState('100');

  const totalSaved = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const totalMonthly = goals.reduce((acc, g) => acc + g.monthlyContribution, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetNum = Number(targetAmount.replace(',', '.'));
    const monthlyNum = Number(monthlyContribution.replace(',', '.'));
    if (!title.trim() || isNaN(targetNum) || targetNum <= 0) {
      setFormError('Informe um nome para a meta e um valor-alvo maior que zero.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await onCreateGoal({
        title: title.trim(),
        category,
        targetAmount: targetNum,
        monthlyContribution: isNaN(monthlyNum) || monthlyNum <= 0 ? 500 : monthlyNum,
        deadline,
      });
      setTitle('');
      setTargetAmount('');
      setMonthlyContribution('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tp-stagger space-y-6">
      {/* OPEN SWISS BROADSHEET MASTHEAD */}
      <header className="border-t-2 border-[#111110] dark:border-[#F5F5F2] border-b border-b-[#E2E2DC] dark:border-b-[#242429] pt-5 pb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#5A5A54] dark:text-[#8E8E96]">
          Patrimônio &amp; Liquidez · 100% CDI
        </div>
        <h1 className="font-broadsheet text-3xl sm:text-4xl font-semibold text-[#111110] dark:text-[#F5F5F2] tracking-[-0.025em] mt-1">
          Reservas &amp;{' '}
          <span className="font-accent-serif font-normal text-[#1D4ED8] dark:text-[#6088FF]">
            Metas do Casal
          </span>
        </h1>
        <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] mt-1.5">
          Acompanhe CDBs de liquidez diária, aportes mensais programados e objetivos compartilhados
        </p>
      </header>

      {/* UNIFIED HAIRLINE SUMMARY STRIP */}
      <SpotlightBento className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E2E2DC] dark:divide-[#242429]">
          <div className="p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A5A54] dark:text-[#8E8E96]">
              Patrimônio Acumulado (CDB + Contas)
            </div>
            <div className="font-display-num text-3xl font-bold text-[#111110] dark:text-[#F5F5F2] mt-2 tabular-nums">
              <NumberTicker
                value={totalSaved}
                prefix="R$ "
                centsClassName="text-[0.58em] font-medium opacity-60"
              />
            </div>
            <div className="text-[11px] text-[#0F766E] dark:text-[#2DD4BF] font-semibold mt-1.5 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>
                {overallPct}% da meta de R$ {formatBRL(totalTarget)}
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A5A54] dark:text-[#8E8E96]">
              Aporte Mensal Programado
            </div>
            <div className="font-display-num text-3xl font-bold text-[#1D4ED8] dark:text-[#6088FF] mt-2 tabular-nums">
              <NumberTicker
                value={totalMonthly}
                prefix="R$ "
                suffix="/mês"
                centsClassName="text-[0.58em] font-medium opacity-60"
              />
            </div>
            <div className="text-[11px] text-[#5A5A54] dark:text-[#8E8E96] mt-1.5">
              Sincronizado automaticamente com contas Pluggy
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5A5A54] dark:text-[#8E8E96]">
              Rentabilidade Real
            </div>
            <div className="font-display-num text-3xl font-bold text-[#0F766E] dark:text-[#2DD4BF] mt-2 tabular-nums">
              100% <span className="font-accent-serif font-normal text-2xl">CDI</span>
            </div>
            <div className="text-[11px] text-[#5A5A54] dark:text-[#8E8E96] mt-1.5">
              Liquidez diária em CDB &amp; RDB
            </div>
          </div>
        </div>
      </SpotlightBento>

      {/* GOALS GRID & CREATE FORM */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {goals.map((goal) => {
            const pct = Math.min(
              100,
              Math.round((goal.currentAmount / Math.max(1, goal.targetAmount)) * 100)
            );
            const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

            const quickSmall = goal.targetAmount <= 1000 ? 50 : 150;
            const quickLarge = goal.targetAmount <= 1000 ? 200 : 500;
            const monthlyCdiYield = goal.currentAmount * 0.0089;

            return (
              <SpotlightBento key={goal.id} className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <CircularGaugeSvg
                      valuePct={pct}
                      size={52}
                      strokeWidth={4.5}
                      trackColor="rgba(29,78,216,0.14)"
                      fillColor="#1D4ED8"
                      label={`${pct}%`}
                      labelClassName="text-[#111110] dark:text-[#F5F5F2]"
                    />
                    <div className="min-w-0">
                      <div className="text-xs text-[#5A5A54] dark:text-[#8E8E96] truncate">
                        {goal.category} · Prazo: {goal.deadline}
                      </div>
                      <h2 className="font-broadsheet text-lg font-semibold text-[#111110] dark:text-[#F5F5F2] mt-0.5 truncate">
                        {goal.title}
                      </h2>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => onContributeGoal(goal.id, quickSmall)}
                      className="min-h-[36px] px-3 py-1.5 text-xs font-semibold font-mono-num text-[#111110] dark:text-[#F5F5F2] bg-[#FAFAF8] dark:bg-[#161619] border border-[#E2E2DC] dark:border-[#242429] hover:border-[#1D4ED8] dark:hover:border-[#6088FF] rounded-xs transition-colors whitespace-nowrap cursor-pointer"
                    >
                      + R$ {quickSmall}
                    </button>
                    <button
                      type="button"
                      onClick={() => onContributeGoal(goal.id, quickLarge)}
                      className="min-h-[36px] px-3.5 py-1.5 text-xs font-semibold font-mono-num text-white dark:text-[#09090B] bg-[#1D4ED8] dark:bg-[#6088FF] hover:bg-[#1E40AF] dark:hover:bg-[#4F78F5] rounded-xs transition-colors whitespace-nowrap cursor-pointer"
                    >
                      + R$ {quickLarge}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomGoalId((prev) => (prev === goal.id ? null : goal.id))
                      }
                      className="min-h-[36px] px-2.5 py-1.5 text-[11px] font-semibold text-[#5A5A54] dark:text-[#8E8E96] hover:text-[#111110] dark:hover:text-[#F5F5F2] rounded-xs transition-colors cursor-pointer"
                    >
                      Outro
                    </button>
                  </div>
                </div>

                {customGoalId === goal.id && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const val = Number(customAmountInput.replace(',', '.'));
                      if (isNaN(val) || val <= 0) return;
                      await onContributeGoal(goal.id, val);
                      setCustomGoalId(null);
                    }}
                    className="p-3 rounded-sm bg-[#FAFAF8] dark:bg-[#161619] border border-[#E2E2DC] dark:border-[#242429] flex items-center gap-2 text-xs"
                  >
                    <span className="text-[#5A5A54] dark:text-[#8E8E96] whitespace-nowrap">
                      Aportar R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={customAmountInput}
                      onChange={(e) => setCustomAmountInput(e.target.value)}
                      className="w-28 px-2.5 py-1.5 rounded-xs border border-[#E2E2DC] dark:border-[#242429] bg-white dark:bg-[#111113] text-[#111110] dark:text-[#F5F5F2] font-mono-num font-bold"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-xs bg-[#1D4ED8] dark:bg-[#6088FF] text-white dark:text-[#09090B] font-semibold cursor-pointer"
                    >
                      Confirmar
                    </button>
                  </form>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono-num text-base font-bold text-[#111110] dark:text-[#F5F5F2]">
                      R$ {formatBRL(goal.currentAmount)}{' '}
                      <span className="text-xs text-[#5A5A54] dark:text-[#8E8E96] font-normal">
                        de R$ {formatBRL(goal.targetAmount)}
                      </span>
                    </span>
                    <span className="font-mono-num font-bold text-[#1D4ED8] dark:text-[#6088FF]">
                      {pct}% concluído
                    </span>
                  </div>

                  <div className="h-2 w-full bg-[#ECECE6] dark:bg-[#1D1D22] rounded-xs overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-[#1D4ED8] dark:bg-[#6088FF] transition-all duration-300"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono-num text-[#5A5A54] dark:text-[#8E8E96]">
                    <span className="flex items-center gap-2">
                      <span>Aporte mensal: R$ {formatBRL(goal.monthlyContribution)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-[#0F766E] dark:text-[#2DD4BF] font-semibold">
                        <Sparkles className="w-3 h-3" />
                        +R$ {formatBRL(monthlyCdiYield)}/mês CDI
                      </span>
                    </span>
                    <span>Faltam R$ {formatBRL(remaining)}</span>
                  </div>
                </div>
              </SpotlightBento>
            );
          })}
        </div>

        {/* CREATE NEW SAVINGS GOAL FORM */}
        <SpotlightBento
          as="section"
          aria-label="Criar Nova Meta de Economia Personalizada"
          className="lg:col-span-4 p-5 sm:p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-[#1D4ED8] dark:text-[#6088FF]" />
            <h2 className="font-broadsheet text-xl font-semibold text-[#111110] dark:text-[#F5F5F2]">
              Nova Meta do Casal
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-[#5A5A54] dark:text-[#8E8E96] mb-1">
                Nome da Meta
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Viagem, Casa, Reserva..."
                className="w-full min-h-[40px] px-3 py-2 rounded-xs border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#161619] text-[#111110] dark:text-[#F5F5F2]"
              />
            </div>

            <div>
              <label className="block text-[#5A5A54] dark:text-[#8E8E96] mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xs border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#161619] text-[#111110] dark:text-[#F5F5F2]"
              >
                <option value="Nossa Casa">Nossa Casa &amp; Obra</option>
                <option value="Segurança Financeira">Segurança Financeira</option>
                <option value="Estilo de Vida">Viagens &amp; Estilo de Vida</option>
                <option value="Investimentos">Investimentos &amp; CDB</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#5A5A54] dark:text-[#8E8E96] mb-1">
                  Valor Alvo (R$)
                </label>
                <input
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="25000"
                  className="w-full min-h-[40px] px-3 py-2 rounded-xs border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#161619] text-[#111110] dark:text-[#F5F5F2] font-mono-num"
                />
              </div>
              <div>
                <label className="block text-[#5A5A54] dark:text-[#8E8E96] mb-1">
                  Aporte Mensal (R$)
                </label>
                <input
                  type="number"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(e.target.value)}
                  placeholder="1500"
                  className="w-full min-h-[40px] px-3 py-2 rounded-xs border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#161619] text-[#111110] dark:text-[#F5F5F2] font-mono-num"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#5A5A54] dark:text-[#8E8E96] mb-1">
                Prazo Estimado
              </label>
              <input
                type="text"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-xs border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#161619] text-[#111110] dark:text-[#F5F5F2]"
              />
            </div>

            {formError && <p className="text-[#C83E2B] dark:text-[#F9735B] font-medium">{formError}</p>}

            <ShimmerActionButton
              type="submit"
              variant="cobalt"
              disabled={submitting}
              className="min-h-[42px] w-full py-2.5 text-xs font-semibold rounded-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? 'Salvando meta...' : 'Criar Meta Personalizada'}</span>
            </ShimmerActionButton>
          </form>
        </SpotlightBento>
      </div>
    </div>
  );
}
