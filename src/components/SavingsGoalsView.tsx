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
    <div className="space-y-6 animate-enter">
      {/* UNIFIED HAIRLINE SUMMARY STRIP */}
      <SpotlightBento className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E4E7E5] dark:divide-[#1B231F]">
          <div className="p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6660] dark:text-[#8C9891]">
              Patrimônio Acumulado (CDB + Contas)
            </div>
            <div className="font-display-num text-3xl font-bold text-[#0B110E] dark:text-white mt-2">
              <NumberTicker
                value={totalSaved}
                prefix="R$ "
                centsClassName="text-[0.58em] font-medium opacity-60"
              />
            </div>
            <div className="text-[11px] text-[#56AD17] dark:text-[#8CE02C] font-semibold mt-1.5 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>
                {overallPct}% da meta de R$ {formatBRL(totalTarget)}
              </span>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6660] dark:text-[#8C9891]">
              Aporte Mensal Programado
            </div>
            <div className="font-display-num text-3xl font-bold text-[#0B110E] dark:text-[#8CE02C] mt-2">
              <NumberTicker
                value={totalMonthly}
                prefix="R$ "
                suffix="/mês"
                centsClassName="text-[0.58em] font-medium opacity-60"
              />
            </div>
            <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] mt-1.5">
              Sincronizado automaticamente com contas Pluggy
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#5C6660] dark:text-[#8C9891]">
              Rentabilidade Real
            </div>
            <div className="font-display-num text-3xl font-bold text-[#56AD17] dark:text-[#8CE02C] mt-2">
              100% <span className="font-accent-serif font-semibold text-2xl">CDI</span>
            </div>
            <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] mt-1.5">
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
            const monthlyCdiYield = goal.currentAmount * 0.0089; // ~11.25% a.a. / 12

            return (
              <SpotlightBento key={goal.id} className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <CircularGaugeSvg
                      valuePct={pct}
                      size={52}
                      strokeWidth={5}
                      trackColor="rgba(122,193,40,0.18)"
                      fillColor="#56AD17"
                      label={`${pct}%`}
                      labelClassName="text-[#0B110E] dark:text-[#F3F5F4]"
                    />
                    <div className="min-w-0">
                      <div className="text-xs text-[#5C6660] dark:text-[#8C9891] truncate">
                        {goal.category} · Prazo: {goal.deadline}
                      </div>
                      <h3 className="font-editorial text-base font-bold text-[#0B110E] dark:text-white mt-0.5 truncate">
                        {goal.title}
                      </h3>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => onContributeGoal(goal.id, quickSmall)}
                      className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] bg-[#F7F8F7] dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F] hover:border-[#56AD17] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      + R$ {quickSmall}
                    </button>
                    <button
                      type="button"
                      onClick={() => onContributeGoal(goal.id, quickLarge)}
                      className="min-h-[36px] px-3.5 py-1.5 text-xs font-semibold text-[#0B110E] dark:text-[#8CE02C] bg-[#EAF5D8] dark:bg-[#16271D] hover:opacity-90 rounded-lg transition-opacity whitespace-nowrap cursor-pointer"
                    >
                      + R$ {quickLarge}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomGoalId((prev) => (prev === goal.id ? null : goal.id))
                      }
                      className="min-h-[36px] px-2.5 py-1.5 text-[11px] font-semibold text-[#5C6660] dark:text-[#8C9891] hover:text-[#0B110E] dark:hover:text-white rounded-lg transition-colors cursor-pointer"
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
                    className="p-3 rounded-xl bg-[#F7F8F7] dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F] flex items-center gap-2 text-xs"
                  >
                    <span className="text-[#5C6660] dark:text-[#8C9891] whitespace-nowrap">
                      Aportar R$
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      value={customAmountInput}
                      onChange={(e) => setCustomAmountInput(e.target.value)}
                      className="w-28 px-2.5 py-1.5 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-white dark:bg-[#0D1210] text-[#0B110E] dark:text-white font-mono-num font-bold"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-[#0B130F] dark:bg-[#8CE02C] text-white dark:text-[#060807] font-semibold cursor-pointer"
                    >
                      Confirmar
                    </button>
                  </form>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-display-num text-base font-bold text-[#0B110E] dark:text-white">
                      R$ {formatBRL(goal.currentAmount)}{' '}
                      <span className="text-xs text-[#5C6660] dark:text-[#8C9891] font-normal">
                        de R$ {formatBRL(goal.targetAmount)}
                      </span>
                    </span>
                    <span className="font-mono-num font-bold text-[#56AD17] dark:text-[#8CE02C]">
                      {pct}% concluído
                    </span>
                  </div>

                  <div className="h-2.5 w-full bg-[#E4E7E5] dark:bg-[#19221D] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-[#56AD17] dark:bg-[#8CE02C] rounded-full transition-all duration-300"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                    <span className="flex items-center gap-2">
                      <span>Aporte mensal: R$ {formatBRL(goal.monthlyContribution)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-[#56AD17] dark:text-[#8CE02C] font-medium">
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
            <Target className="w-4 h-4 text-[#56AD17] dark:text-[#8CE02C]" />
            <h2 className="font-editorial text-lg font-semibold text-[#0B110E] dark:text-white">
              Nova Meta do Casal
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-[#5C6660] dark:text-[#8C9891] mb-1">
                Nome da Meta
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Viagem, Casa, Reserva..."
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] text-[#0B110E] dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[#5C6660] dark:text-[#8C9891] mb-1">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] text-[#0B110E] dark:text-white"
              >
                <option value="Nossa Casa">Nossa Casa &amp; Obra</option>
                <option value="Segurança Financeira">Segurança Financeira</option>
                <option value="Estilo de Vida">Viagens &amp; Estilo de Vida</option>
                <option value="Investimentos">Investimentos &amp; CDB</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[#5C6660] dark:text-[#8C9891] mb-1">
                  Valor Alvo (R$)
                </label>
                <input
                  type="number"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="25000"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] text-[#0B110E] dark:text-white font-mono-num"
                />
              </div>
              <div>
                <label className="block text-[#5C6660] dark:text-[#8C9891] mb-1">
                  Aporte Mensal (R$)
                </label>
                <input
                  type="number"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(e.target.value)}
                  placeholder="1500"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] text-[#0B110E] dark:text-white font-mono-num"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#5C6660] dark:text-[#8C9891] mb-1">
                Prazo Estimado
              </label>
              <input
                type="text"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#111714] text-[#0B110E] dark:text-white"
              />
            </div>

            {formError && <p className="text-rose-600 font-medium">{formError}</p>}

            <ShimmerActionButton
              type="submit"
              variant="forest"
              disabled={submitting}
              className="min-h-[42px] w-full py-2.5 text-xs font-semibold rounded-lg"
            >
              <Plus className="w-4 h-4 text-[#8CE02C] dark:text-[#060807]" />
              <span>{submitting ? 'Salvando meta...' : 'Criar Meta Personalizada'}</span>
            </ShimmerActionButton>
          </form>
        </SpotlightBento>
      </div>
    </div>
  );
}
