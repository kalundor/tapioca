import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  CreditCard,
  CheckCircle2,
  Check,
  Search,
  Scale,
  Sliders,
} from 'lucide-react';
import {
  formatBRL,
  calculateHouseSplit,
  calculatePredictedBalance,
  calculateHousingBenchmark,
  type BillItem,
  type CoupleProfile,
} from '../utils/financeMath';
import type { CreditCardRecord } from './OverviewView';
import {
  EditorialModalShell,
  SpotlightBento,
  NumberTicker,
  AnimatedSegmentedControl,
  ShimmerActionButton,
  EDITORIAL_EASE,
} from './MotionPrimitives';
import { CircularGaugeSvg } from './BrandAssets';

interface AddBillModalProps {
  isOpen: boolean;
  defaultCategory: 'house' | 'personal';
  partnerName: string;
  onClose: () => void;
  onCreateBill: (payload: {
    title: string;
    amount: number;
    dueDay: number;
    category: 'house' | 'personal';
    isHousingCost: boolean;
    paidBy: 'user' | 'partner';
    isShared: boolean;
    iconType: string;
  }) => Promise<void>;
}

export function AddBillModal({
  isOpen,
  defaultCategory,
  partnerName,
  onClose,
  onCreateBill,
}: AddBillModalProps) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDay, setDueDay] = useState('5');
  const [category, setCategory] = useState<'house' | 'personal'>(defaultCategory);
  const [paidBy, setPaidBy] = useState<'user' | 'partner'>('user');
  const [isHousingCost, setIsHousingCost] = useState(defaultCategory === 'house');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount.replace(',', '.'));
    if (!title.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      setError('Preencha a descrição da conta e um valor maior que R$ 0,00.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onCreateBill({
        title: title.trim(),
        amount: numericAmount,
        dueDay: Number(dueDay) || 5,
        category,
        isHousingCost: category === 'house' ? isHousingCost : false,
        paidBy,
        isShared: category === 'house',
        iconType: isHousingCost ? 'building' : 'card',
      });
      setTitle('');
      setAmount('');
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <EditorialModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="add-bill-title"
      variant="dialog"
      containerClassName="flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="bg-[#FFFFFF] dark:bg-[#0D1210] rounded-t-3xl sm:rounded-3xl border border-[#E4E7E5] dark:border-[#1B231F] max-w-md w-full p-5 sm:p-6 shadow-2xl">
        <div className="w-10 h-1 bg-[#D3D8D5] dark:bg-[#27322C] rounded-full mx-auto mb-3 sm:hidden" />
        <div className="flex items-center justify-between mb-4">
          <h2
            id="add-bill-title"
            className="font-editorial text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4]"
          >
            Adicionar Nova Conta ou Despesa
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="w-9 h-9 flex items-center justify-center text-[#5C6660] hover:text-[#0B110E] dark:text-[#8C9891] dark:hover:text-[#F3F5F4] rounded-xl cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label htmlFor="bill-title-input" className="block text-[#5C6660] dark:text-[#8C9891] mb-1">
              Descrição da Conta / Despesa
            </label>
            <input
              id="bill-title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Mercado, Internet Claro, Academia..."
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bill-amount-input" className="block text-[#5C6660] dark:text-[#8C9891] mb-1">
                Valor (R$)
              </label>
              <input
                id="bill-amount-input"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="450.00"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4] font-mono-num"
              />
            </div>

            <div>
              <label htmlFor="bill-dueday-select" className="block text-[#5C6660] dark:text-[#8C9891] mb-1">
                Dia do Vencimento
              </label>
              <select
                id="bill-dueday-select"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4] font-mono-num"
              >
                <option value="5">Dia 05</option>
                <option value="8">Dia 08</option>
                <option value="10">Dia 10</option>
                <option value="12">Dia 12</option>
                <option value="15">Dia 15</option>
                <option value="1">Dia 01</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bill-category-select" className="block text-[#5C6660] dark:text-[#8C9891] mb-1">
                Tipo de Despesa
              </label>
              <select
                id="bill-category-select"
                value={category}
                onChange={(e) => {
                  const val = e.target.value as 'house' | 'personal';
                  setCategory(val);
                  setIsHousingCost(val === 'house');
                }}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4]"
              >
                <option value="house">Divisão da Casa (Casal)</option>
                <option value="personal">Conta Individual</option>
              </select>
            </div>

            <div>
              <label htmlFor="bill-paidby-select" className="block text-[#5C6660] dark:text-[#8C9891] mb-1">
                Quem paga?
              </label>
              <select
                id="bill-paidby-select"
                value={paidBy}
                onChange={(e) => setPaidBy(e.target.value as 'user' | 'partner')}
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4]"
              >
                <option value="user">Alan (Titular)</option>
                <option value="partner">{partnerName} (Namorada)</option>
              </select>
            </div>
          </div>

          {category === 'house' && (
            <label className="flex items-center gap-2.5 text-[#5C6660] dark:text-[#D1D7D4] cursor-pointer pt-1 min-h-[36px]">
              <input
                type="checkbox"
                checked={isHousingCost}
                onChange={(e) => setIsHousingCost(e.target.checked)}
                className="w-4 h-4 rounded border-[#D3D8D5] accent-[#0B130F] dark:accent-[#8CE02C]"
              />
              <span>Incluir no índice de Moradia (meta até 30% da renda)</span>
            </label>
          )}

          {error && <p className="text-rose-600 font-semibold">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-3 pb-safe">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#F1F3F2] dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F] text-[#0B110E] dark:text-[#D1D7D4] font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B130F] hover:bg-[#16221C] dark:bg-[#8CE02C] dark:hover:bg-[#9CEB3F] text-white dark:text-[#060807] font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#8CE02C] dark:text-[#060807]" />
              {submitting ? 'Salvando...' : 'Salvar Conta'}
            </button>
          </div>
        </form>
      </div>
    </EditorialModalShell>
  );
}

interface IncomeAndHouseSettingsViewProps {
  profile: CoupleProfile;
  bills: BillItem[];
  mode: 'income' | 'house_bills';
  onUpdateProfile: (payload: Partial<CoupleProfile>) => Promise<void>;
  onToggleBillPaid?: (billId: number, nextPaid: boolean) => void;
  onSettlePix?: (settled: boolean) => void;
  onDeleteBill: (billId: number) => Promise<void>;
  onOpenAddBillModal: (defaultCategory?: 'house' | 'personal') => void;
}

export function IncomeAndHouseSettingsView({
  profile,
  bills,
  mode,
  onUpdateProfile,
  onToggleBillPaid,
  onSettlePix,
  onDeleteBill,
  onOpenAddBillModal,
}: IncomeAndHouseSettingsViewProps) {
  const [userSalary, setUserSalary] = useState(String(profile.userSalary));
  const [partnerSalary, setPartnerSalary] = useState(String(profile.partnerSalary));
  const [dayToDayBudget, setDayToDayBudget] = useState(String(profile.dayToDayBudget));
  const [partnerName, setPartnerName] = useState(profile.partnerName);
  const [savedNotice, setSavedNotice] = useState(false);
  const [splitPreviewMode, setSplitPreviewMode] = useState<'equal' | 'proportional'>('equal');

  // Casa & Contas filters
  const [billFilter, setBillFilter] = useState<'all' | 'shared' | 'individual' | 'unpaid'>('all');
  const [billSearch, setBillSearch] = useState('');

  const handleSaveIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    const uSal = Number(userSalary.replace(',', '.'));
    const pSal = Number(partnerSalary.replace(',', '.'));
    const dBud = Number(dayToDayBudget.replace(',', '.'));
    if (isNaN(uSal) || uSal <= 0) return;

    await onUpdateProfile({
      userSalary: uSal,
      partnerSalary: isNaN(pSal) ? 1251.69 : pSal,
      dayToDayBudget: isNaN(dBud) ? 140 : dBud,
      partnerName: partnerName.trim() || 'Larissa Ferraz',
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  // Live reactive preview profile before saving
  const liveProfile: CoupleProfile = useMemo(() => {
    const uSal = Number(userSalary.replace(',', '.'));
    const pSal = Number(partnerSalary.replace(',', '.'));
    const dBud = Number(dayToDayBudget.replace(',', '.'));
    return {
      ...profile,
      userSalary: !isNaN(uSal) && uSal > 0 ? uSal : profile.userSalary,
      partnerSalary: !isNaN(pSal) && pSal >= 0 ? pSal : profile.partnerSalary,
      dayToDayBudget: !isNaN(dBud) && dBud >= 0 ? dBud : profile.dayToDayBudget,
      partnerName: partnerName.trim() || profile.partnerName,
    };
  }, [profile, userSalary, partnerSalary, dayToDayBudget, partnerName]);

  const livePredicted = useMemo(
    () => calculatePredictedBalance(liveProfile, bills),
    [liveProfile, bills]
  );
  const houseSplit = useMemo(() => calculateHouseSplit(bills), [bills]);
  const liveHousing = useMemo(
    () => calculateHousingBenchmark(liveProfile, bills, 'couple'),
    [liveProfile, bills]
  );

  if (mode === 'income') {
    const coupleTotal = Math.max(1, liveProfile.userSalary + liveProfile.partnerSalary);
    const alanIncomePct = Number(((liveProfile.userSalary / coupleTotal) * 100).toFixed(1));
    const partnerIncomePct = Number((100 - alanIncomePct).toFixed(1));

    const proportionalAlanShare = (houseSplit.totalHouseBills * alanIncomePct) / 100;
    const proportionalPartnerShare = houseSplit.totalHouseBills - proportionalAlanShare;
    const proportionalDiff = houseSplit.userPaidTotal - proportionalAlanShare;

    const displayedSettlement =
      splitPreviewMode === 'equal'
        ? houseSplit.pixSettlementAmount
        : Math.abs(proportionalDiff);
    const displayedSettlementDirection =
      splitPreviewMode === 'equal'
        ? houseSplit.whoOwesWhom === 'partner_owes_user'
          ? `${liveProfile.partnerName.split(' ')[0]} → Alan`
          : `Alan → ${liveProfile.partnerName.split(' ')[0]}`
        : proportionalDiff >= 0
          ? `${liveProfile.partnerName.split(' ')[0]} → Alan`
          : `Alan → ${liveProfile.partnerName.split(' ')[0]}`;

    const allocBarTotal = Math.max(1, livePredicted.salary);
    const houseAllocW = Math.min(100, Math.round((livePredicted.userHouseShare / allocBarTotal) * 100));
    const cardsAllocW = Math.min(100, Math.round((livePredicted.personalBillsTotal / allocBarTotal) * 100));
    const dayAllocW = Math.min(100, Math.round((livePredicted.dayToDayBudget / allocBarTotal) * 100));

    return (
      <div className="space-y-5">
        {/* TOP KPI HEADER — UNIFIED MERCURY HAIRLINE STRIP */}
        <SpotlightBento className="overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E4E7E5] dark:divide-[#1B231F]">
            <div className="p-5">
              <div className="text-xs text-[#5C6660] dark:text-[#8C9891]">
                Renda Consolidada do Casal
              </div>
              <div className="font-display-num text-3xl font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-1.5">
                <NumberTicker
                  value={liveProfile.userSalary + liveProfile.partnerSalary}
                  prefix="R$ "
                  centsClassName="text-[0.58em] font-medium opacity-60"
                />
              </div>
              <div className="text-[11px] text-[#56AD17] dark:text-[#8CE02C] font-semibold mt-1.5 tabular-nums">
                Alan {alanIncomePct.toFixed(1).replace('.', ',')}% ·{' '}
                {liveProfile.partnerName.split(' ')[0]} {partnerIncomePct.toFixed(1).replace('.', ',')}%
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[#5C6660] dark:text-[#8C9891]">
                  Acerto Mensal ({splitPreviewMode === 'equal' ? '50/50' : 'Proporcional'})
                </span>
                {onSettlePix && (
                  <button
                    type="button"
                    onClick={() => onSettlePix(!profile.pixSettled)}
                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold tracking-normal whitespace-nowrap cursor-pointer transition-colors shrink-0 ${
                      profile.pixSettled
                        ? 'bg-[#EEF7E4] dark:bg-[#132215] text-[#448D11] dark:text-[#8CE02C]'
                        : 'bg-amber-50 dark:bg-amber-950/30 text-[#B45309] dark:text-[#F59E0B]'
                    }`}
                  >
                    {profile.pixSettled ? 'Quitado ✓' : 'Em aberto'}
                  </button>
                )}
              </div>
              <div className="font-display-num text-3xl font-bold text-[#D97706] dark:text-[#F59E0B] mt-1.5">
                <NumberTicker
                  value={displayedSettlement}
                  prefix="R$ "
                  centsClassName="text-[0.58em] font-medium opacity-60"
                />
              </div>
              <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] mt-1.5">
                Direção do Pix: <strong className="text-[#0B110E] dark:text-[#F3F5F4]">{displayedSettlementDirection}</strong>
              </div>
            </div>

            <div className="p-5">
              <div className="text-xs text-[#5C6660] dark:text-[#8C9891]">
                Capacidade Livre Pós-Contas
              </div>
              <div className="font-display-num text-3xl font-bold text-[#56AD17] dark:text-[#8CE02C] mt-1.5">
                <NumberTicker
                  value={Math.max(0, livePredicted.predictedLeftover)}
                  prefix="R$ "
                  centsClassName="text-[0.58em] font-medium opacity-60"
                />
              </div>
              <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] mt-1.5">
                {livePredicted.predictedLeftoverPct}% da renda do titular disponível para CDB
              </div>
            </div>
          </div>
        </SpotlightBento>

        {/* 12-COL STUDIO: FORM + SPLIT SIMULATOR & LIVE PREVIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <SpotlightBento as="div" className="lg:col-span-7 p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-medium text-[#5C6660] dark:text-[#8C9891]">
                  Engrenagem do Casal · Alan &amp; {partnerName}
                </span>
                <h2 className="font-editorial text-xl font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-0.5">
                  Renda Líquida &amp; Regra de Divisão
                </h2>
                <p className="text-xs text-[#5C6660] dark:text-[#8C9891] mt-0.5">
                  Ajuste entradas mensais e acompanhe ao lado o recálculo imediato do saldo.
                </p>
              </div>
              <Sliders className="w-4 h-4 text-[#56AD17] dark:text-[#8CE02C] shrink-0 mt-1" />
            </div>

            <form onSubmit={handleSaveIncome} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-2xl bg-[#F7F8F7] dark:bg-[#090C0B] border border-[#E4E7E5] dark:border-[#1B231F] space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-[#0B130F] text-[#8CE02C] border border-[#1E2823] font-editorial font-bold text-[11px] flex items-center justify-center">
                      AL
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-[#0B110E] dark:text-[#F3F5F4] truncate">
                        Alan Pires
                      </div>
                      <div className="text-[10px] text-[#5C6660] dark:text-[#8C9891]">Titular</div>
                    </div>
                  </div>
                  <label className="block text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                    Entradas Líquidas (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={userSalary}
                    onChange={(e) => setUserSalary(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-white dark:bg-[#111714] text-[#0B110E] dark:text-[#F3F5F4] font-mono-num font-bold"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-[#F7F8F7] dark:bg-[#090C0B] border border-[#E4E7E5] dark:border-[#1B231F] space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-[#D97706] text-white dark:bg-[#F59E0B] dark:text-[#060807] font-editorial font-bold text-[11px] flex items-center justify-center">
                      {partnerName.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-[#0B110E] dark:text-[#F3F5F4] truncate">
                        {partnerName}
                      </div>
                      <div className="text-[10px] text-[#5C6660] dark:text-[#8C9891]">Namorada</div>
                    </div>
                  </div>
                  <label className="block text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                    Entradas Líquidas (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={partnerSalary}
                    onChange={(e) => setPartnerSalary(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-white dark:bg-[#111714] text-[#0B110E] dark:text-[#F3F5F4] font-mono-num font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#5C6660] dark:text-[#8C9891] mb-1">
                    Orçamento Dia a Dia Livre (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={dayToDayBudget}
                    onChange={(e) => setDayToDayBudget(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2.5 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4] font-mono-num font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[#5C6660] dark:text-[#8C9891] mb-1">
                    Nome da Parceira (Namorada)
                  </label>
                  <input
                    type="text"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full min-h-[42px] px-3.5 py-2.5 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4] font-semibold"
                  />
                </div>
              </div>

              {/* INTERACTIVE SPLIT RULE COMPARATOR */}
              <div className="p-4 rounded-2xl bg-[#F7F8F7] dark:bg-[#090C0B] border border-[#E4E7E5] dark:border-[#1B231F] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#0B110E] dark:text-[#F3F5F4] flex items-center gap-1.5">
                    <Scale className="w-3.5 h-3.5 text-[#56AD17] dark:text-[#8CE02C]" />
                    Simular critério de divisão das contas da casa
                  </span>
                  <AnimatedSegmentedControl
                    layoutId="income-split-mode"
                    ariaLabel="Critério de divisão"
                    value={splitPreviewMode}
                    onChange={setSplitPreviewMode}
                    options={[
                      { id: 'equal', label: '50/50 Igual' },
                      { id: 'proportional', label: 'Proporcional' },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F]">
                    <div className="text-[#5C6660] dark:text-[#8C9891]">Parte justa de Alan</div>
                    <div className="font-display-num text-sm font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-0.5">
                      R${' '}
                      {formatBRL(
                        splitPreviewMode === 'equal'
                          ? houseSplit.eachShare50
                          : proportionalAlanShare
                      )}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F]">
                    <div className="text-[#5C6660] dark:text-[#8C9891]">
                      Parte justa de {partnerName.split(' ')[0]}
                    </div>
                    <div className="font-display-num text-sm font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-0.5">
                      R${' '}
                      {formatBRL(
                        splitPreviewMode === 'equal'
                          ? houseSplit.eachShare50
                          : proportionalPartnerShare
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-1">
                {savedNotice ? (
                  <span className="text-[#56AD17] dark:text-[#8CE02C] font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Renda atualizada com sucesso!
                  </span>
                ) : (
                  <span className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                    Atualiza Visão Geral, Fluxo &amp; Insights e Copiloto AI
                  </span>
                )}
                <ShimmerActionButton
                  type="submit"
                  variant="forest"
                  className="min-h-[42px] px-5 py-2.5 rounded-xl text-xs font-semibold"
                >
                  Salvar Alterações de Renda
                </ShimmerActionButton>
              </div>
            </form>
          </SpotlightBento>

          {/* RIGHT 5 COLS: LIVE ALLOCATION PREVIEW */}
          <SpotlightBento as="section" aria-label="Prévia ao vivo do orçamento" className="lg:col-span-5 p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-editorial text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                  Impacto no Orçamento
                </h3>
                <p className="text-xs text-[#5C6660] dark:text-[#8C9891] mt-0.5">
                  Prévia em tempo real conforme os valores digitados
                </p>
              </div>
              <CircularGaugeSvg
                valuePct={Math.min(100, Math.round((liveHousing.housingPctOfSalary / 30) * 100))}
                size={52}
                strokeWidth={5}
                trackColor="rgba(140,224,44,0.18)"
                fillColor={liveHousing.isWithinRecommended30Pct ? '#56AD17' : '#D97706'}
                label={`${liveHousing.housingPctOfSalary}%`}
                labelClassName="text-[#0B110E] dark:text-[#F3F5F4]"
              />
            </div>

            <div className="space-y-2">
              <div className="h-3.5 rounded-full bg-[#F1F3F2] dark:bg-[#090C0B] overflow-hidden flex">
                <div style={{ width: `${houseAllocW}%` }} className="bg-[#0B130F] dark:bg-[#2F4538] transition-all" />
                <div style={{ width: `${cardsAllocW}%` }} className="bg-[#D97706] dark:bg-[#F59E0B] transition-all" />
                <div style={{ width: `${dayAllocW}%` }} className="bg-[#9CA3AF] transition-all" />
                <div className="bg-[#56AD17] dark:bg-[#8CE02C] flex-1 transition-all" />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                <span>Comprometido</span>
                <span className="font-mono-num font-bold text-[#56AD17] dark:text-[#8CE02C]">
                  {livePredicted.predictedLeftoverPct}% livre
                </span>
              </div>
            </div>

            <div className="divide-y divide-[#E4E7E5] dark:divide-[#1B231F] text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#5C6660] dark:text-[#8C9891] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0B130F] dark:bg-[#2F4538]" />
                  Metade da casa (50/50)
                </span>
                <span className="font-mono-num font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                  R$ {formatBRL(livePredicted.userHouseShare)}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#5C6660] dark:text-[#8C9891] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D97706] dark:bg-[#F59E0B]" />
                  Cartões &amp; CDB Inter
                </span>
                <span className="font-mono-num font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                  R$ {formatBRL(livePredicted.personalBillsTotal)}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#5C6660] dark:text-[#8C9891] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#9CA3AF]" />
                  Orçamento Dia a Dia
                </span>
                <span className="font-mono-num font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                  R$ {formatBRL(livePredicted.dayToDayBudget)}
                </span>
              </div>
              <div className="pt-3 flex items-center justify-between">
                <span className="font-semibold text-[#0B110E] dark:text-[#F3F5F4]">
                  Sobra livre prevista
                </span>
                <span className="font-display-num text-base font-bold text-[#56AD17] dark:text-[#8CE02C]">
                  R$ {formatBRL(livePredicted.predictedLeftover)}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F7F8F7] dark:bg-[#090C0B] border border-[#E4E7E5] dark:border-[#1B231F] text-[11px] text-[#5C6660] dark:text-[#8C9891] leading-relaxed">
              Índice de moradia &amp; fixos na renda combinada do casal:{' '}
              <strong className="text-[#0B110E] dark:text-[#F3F5F4] font-mono-num">
                {liveHousing.housingPctOfSalary}%
              </strong>{' '}
              (saudável abaixo de 30%).
            </div>
          </SpotlightBento>
        </div>
      </div>
    );
  }

  // MODE === 'house_bills': FULL EDITORIAL WORKBENCH FOR CASA & CONTAS
  const totalBillsAmount = bills.reduce((acc, b) => acc + b.amount, 0);
  const sharedBillsList = bills.filter((b) => b.isShared);
  const individualBillsList = bills.filter((b) => !b.isShared);
  const unpaidCount = bills.filter((b) => !b.isPaid).length;
  const paidCount = bills.length - unpaidCount;

  const filteredBills = bills
    .filter((b) => {
      if (billFilter === 'shared') return b.isShared;
      if (billFilter === 'individual') return !b.isShared;
      if (billFilter === 'unpaid') return !b.isPaid;
      return true;
    })
    .filter(
      (b) =>
        !billSearch.trim() || b.title.toLowerCase().includes(billSearch.trim().toLowerCase())
    )
    .sort((a, b) => a.dueDay - b.dueDay);

  return (
    <div className="space-y-5">
      {/* 3-COL KPI HEADER — UNIFIED MERCURY HAIRLINE STRIP */}
      <SpotlightBento className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#E4E7E5] dark:divide-[#1B231F]">
          <div className="p-5">
            <div className="text-xs text-[#5C6660] dark:text-[#8C9891]">
              Compromissos do Mês ({bills.length})
            </div>
            <div className="font-display-num text-3xl font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-1.5">
              <NumberTicker
                value={totalBillsAmount}
                prefix="R$ "
                centsClassName="text-[0.58em] font-medium opacity-60"
              />
            </div>
            <div className="text-[11px] text-[#56AD17] dark:text-[#8CE02C] font-semibold mt-1.5">
              {paidCount}/{bills.length} quitadas · {unpaidCount} em aberto
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[#5C6660] dark:text-[#8C9891]">
                Casa Compartilhada (50/50)
              </span>
              <span className="text-[11px] font-mono-num text-[#5C6660] dark:text-[#8C9891]">
                {sharedBillsList.length} contas
              </span>
            </div>
            <div className="font-display-num text-3xl font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-1.5">
              <NumberTicker
                value={houseSplit.totalHouseBills}
                prefix="R$ "
                centsClassName="text-[0.58em] font-medium opacity-60"
              />
            </div>
            <div className="flex items-center justify-between gap-2 mt-1.5 text-[11px]">
              <span className="text-[#D97706] dark:text-[#F59E0B] font-semibold">
                Acerto Pix: R$ {formatBRL(houseSplit.pixSettlementAmount)} (
                {houseSplit.whoOwesWhom === 'partner_owes_user'
                  ? `${profile.partnerName.split(' ')[0]} → Alan`
                  : `Alan → ${profile.partnerName.split(' ')[0]}`}
                )
              </span>
              {onSettlePix && (
                <button
                  type="button"
                  onClick={() => onSettlePix(!profile.pixSettled)}
                  className="font-semibold text-[#0B110E] dark:text-[#8CE02C] hover:underline cursor-pointer shrink-0"
                >
                  {profile.pixSettled ? 'Feito ✓' : 'Quitar'}
                </button>
              )}
            </div>
          </div>

          <div className="p-5">
            <div className="text-xs text-[#5C6660] dark:text-[#8C9891]">
              Faturas, CDB &amp; Individuais ({individualBillsList.length})
            </div>
            <div className="font-display-num text-3xl font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-1.5">
              <NumberTicker
                value={individualBillsList.reduce((a, b) => a + b.amount, 0)}
                prefix="R$ "
                centsClassName="text-[0.58em] font-medium opacity-60"
              />
            </div>
            <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] mt-1.5">
              Metade justa da casa por pessoa: R$ {formatBRL(houseSplit.eachShare50)}
            </div>
          </div>
        </div>
      </SpotlightBento>

      {/* MAIN BILLS LEDGER WORKBENCH */}
      <SpotlightBento as="div" className="p-5 sm:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-medium text-[#5C6660] dark:text-[#8C9891]">
              Compromissos Open Finance · Novembro 2026
            </span>
            <h2 className="font-editorial text-xl font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-0.5">
              Contas da Casa &amp; Despesas Fixas
            </h2>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
              Toque em qualquer item para marcar como quitado ou filtre entre rateio 50/50 e individuais.
            </p>
          </div>

          <ShimmerActionButton
            type="button"
            variant="forest"
            onClick={() => onOpenAddBillModal('house')}
            className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold shrink-0"
          >
            <Plus className="w-3.5 h-3.5 text-[#8CE02C]" />
            <span>Nova Conta</span>
          </ShimmerActionButton>
        </div>

        {/* FILTER + SEARCH TOOLBAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E4E7E5] dark:border-[#1B231F]">
          <AnimatedSegmentedControl
            layoutId="house-bills-filter"
            ariaLabel="Filtrar contas"
            value={billFilter}
            onChange={setBillFilter}
            options={[
              { id: 'all', label: `Todas (${bills.length})` },
              { id: 'shared', label: `Casa 50/50 (${sharedBillsList.length})` },
              { id: 'individual', label: `Individual (${individualBillsList.length})` },
              { id: 'unpaid', label: `Em aberto (${unpaidCount})` },
            ]}
          />

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#5C6660] dark:text-[#8C9891] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={billSearch}
              onChange={(e) => setBillSearch(e.target.value)}
              placeholder="Buscar conta ou fatura..."
              aria-label="Buscar conta da casa"
              className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4]"
            />
          </div>
        </div>

        {filteredBills.length === 0 ? (
          <div className="py-8 text-center rounded-2xl border border-dashed border-[#D3D8D5] dark:border-[#1E2823] text-xs text-[#5C6660] dark:text-[#8C9891]">
            Nenhuma conta encontrada neste filtro.
          </div>
        ) : (
          <div className="divide-y divide-[#E4E7E5] dark:divide-[#1B231F] text-xs">
            {filteredBills.map((bill) => {
              const isPartner = bill.paidBy === 'partner';
              return (
                <div
                  key={bill.id}
                  className="py-3.5 flex items-center justify-between gap-3 group hover:bg-[#F7F8F7] dark:hover:bg-[#111714] -mx-2 px-2 rounded-xl transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onToggleBillPaid?.(bill.id, !bill.isPaid)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                        bill.isPaid
                          ? 'bg-[#8CE02C] border-[#8CE02C] text-[#060807]'
                          : 'border-[#C5CCC8] dark:border-[#27322C] group-hover:border-[#0B130F] dark:group-hover:border-[#8CE02C]'
                      }`}
                    >
                      {bill.isPaid && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>

                    <div className="min-w-0">
                      <div
                        className={`truncate transition-colors ${
                          bill.isPaid
                            ? 'text-[#5C6660] dark:text-[#8C9891] font-medium'
                            : 'text-[#0B110E] dark:text-[#F3F5F4] font-bold'
                        }`}
                      >
                        {bill.title}
                      </div>
                      <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono-num">
                          Dia {bill.dueDay < 10 ? `0${bill.dueDay}` : bill.dueDay}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isPartner ? 'bg-[#D97706] dark:bg-[#F59E0B]' : 'bg-[#0B130F] dark:bg-[#8CE02C]'
                            }`}
                          />
                          {isPartner ? `${profile.partnerName.split(' ')[0]} (Namorada)` : 'Alan (Titular)'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            bill.isShared
                              ? 'text-[#56AD17] dark:text-[#8CE02C] font-semibold'
                              : 'text-[#5C6660] dark:text-[#8C9891]'
                          }
                        >
                          {bill.isShared ? 'Rateio 50/50' : 'Individual'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{bill.isPaid ? 'Quitada' : 'Em aberto'}</span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span
                      className={`font-display-num text-sm font-bold whitespace-nowrap tabular-nums ${
                        bill.isPaid
                          ? 'text-[#56AD17] dark:text-[#8CE02C]'
                          : 'text-[#0B110E] dark:text-[#F3F5F4]'
                      }`}
                    >
                      R$ {formatBRL(bill.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteBill(bill.id)}
                      aria-label={`Remover conta ${bill.title}`}
                      className="w-9 h-9 flex items-center justify-center text-[#8C9891] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SpotlightBento>
    </div>
  );
}

interface InvoiceModalProps {
  card: CreditCardRecord | null;
  transactions?: Array<{
    id: number;
    description: string;
    merchant: string;
    amount: number;
    category: string;
    date: string;
    accountName: string;
  }>;
  onClose: () => void;
}

export function InvoiceModal({ card, transactions = [], onClose }: InvoiceModalProps) {
  const cardFirstWord = card ? card.name.split(' ')[0].toLowerCase() : '';
  const matchedTransactions = card
    ? transactions.filter((t) => {
        const acc = (t.accountName || '').toLowerCase();
        return (
          acc.includes(cardFirstWord) ||
          (cardFirstWord.includes('nubank') && acc.includes('nu ')) ||
          (cardFirstWord.includes('inter') && acc.includes('inter')) ||
          (cardFirstWord.includes('santander') && acc.includes('santander'))
        );
      })
    : [];

  const fallbackRealItems = cardFirstWord.includes('inter')
    ? [
        { id: 1, date: '14/11', desc: 'APLICACAO CDB PORQUINHO BANCO INTER', cat: 'Investimento CDB', val: 333.33 },
        { id: 2, date: '14/11', desc: 'PIX RECEBIDO — Adsumus Engenharia e Seg.', cat: 'Receita Pix', val: 330.0 },
        { id: 3, date: '08/11', desc: 'COMPRA CARTAO INTER MASTERCARD GOLD', cat: 'Cartão de Crédito', val: 9.99 },
      ]
    : cardFirstWord.includes('santander')
      ? [
          { id: 1, date: '10/11', desc: 'LIQUIDO DE VENCIMENTO SPDM - ASS 61699567013170', cat: 'Salário / Renda', val: 621.45 },
          { id: 2, date: '07/11', desc: 'PIX ENVIADO — LARISSA FERRAZ DO NASCIMENTO DA SILVA', cat: 'Transferência Pix', val: 241.05 },
          { id: 3, date: '08/11', desc: 'PIX ENVIADO — UBER DO BRASIL TECNOLOGIA LTDA', cat: 'Transporte App', val: 21.97 },
          { id: 4, date: '09/11', desc: 'DEBITO VISA ELECTRON — RD SAUDE', cat: 'Farmácia & Saúde', val: 21.0 },
        ]
      : [
          { id: 1, date: '07/11', desc: 'H B Carioca 2/2 (Parcela Fatura Aberta)', cat: 'Compras Parceladas', val: 125.0 },
          { id: 2, date: '07/11', desc: 'Pagamento de fatura Outubro (Quitada via Pix)', cat: 'Pagamento Recebido', val: 241.05 },
          { id: 3, date: '08/10', desc: 'Estrela Cafe (Fatura Anterior)', cat: 'Restaurantes & Café', val: 116.05 },
          { id: 4, date: '07/10', desc: 'H B Carioca 1/2 (Fatura Anterior)', cat: 'Compras Parceladas', val: 125.0 },
        ];

  const itemsToDisplay =
    matchedTransactions.length > 0
      ? matchedTransactions.slice(0, 12).map((t) => ({
          id: t.id,
          date: t.date,
          desc: t.description,
          cat: `${t.category} · ${t.accountName}`,
          val: t.amount,
        }))
      : fallbackRealItems;

  return (
    <EditorialModalShell
      isOpen={Boolean(card)}
      onClose={onClose}
      ariaLabelledBy="invoice-modal-title"
      variant="dialog"
      containerClassName="flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      {card && (
        <div className="bg-[#FFFFFF] dark:bg-[#0D1210] rounded-t-3xl sm:rounded-3xl border border-[#E4E7E5] dark:border-[#1B231F] max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="w-10 h-1 bg-[#D3D8D5] dark:bg-[#27322C] rounded-full mx-auto mb-1 sm:hidden" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#0B130F] text-[#8CE02C] border border-[#1E2823] flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="invoice-modal-title"
                  className="font-editorial text-base font-bold text-[#0B110E] dark:text-[#F3F5F4]"
                >
                  Extrato &amp; Fatura {card.name} — Nov/2026
                </h2>
                <p className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                  Vencimento {card.dueDate} · Status: {card.status} · Sincronizado via Pluggy Open Finance
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar fatura"
              className="w-9 h-9 flex items-center justify-center text-[#5C6660] hover:text-[#0B110E] dark:text-[#8C9891] dark:hover:text-[#F3F5F4] rounded-xl cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 rounded-xl bg-[#F7F8F7] dark:bg-[#090C0B] border border-[#E4E7E5] dark:border-[#1B231F] flex items-center justify-between">
            <div>
              <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                Fatura / Movimentação Atual
              </div>
              <div className="font-mono-num text-xl font-bold text-[#0B110E] dark:text-[#F3F5F4]">
                R$ {formatBRL(card.currentInvoice)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                Limite Livre / Saldo
              </div>
              <div className="font-mono-num text-sm font-bold text-[#56AD17] dark:text-[#8CE02C]">
                R$ {formatBRL(card.availableLimit)}
              </div>
            </div>
          </div>

          <ul className="divide-y divide-[#E4E7E5] dark:divide-[#1B231F] text-xs max-h-64 overflow-y-auto pr-1">
            {itemsToDisplay.map((it, idx) => (
              <motion.li
                key={it.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: idx * 0.03, ease: EDITORIAL_EASE }}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-[#0B110E] dark:text-[#F3F5F4] truncate">
                    {it.desc}
                  </div>
                  <div className="text-[10px] text-[#5C6660] dark:text-[#8C9891]">
                    {it.date} · {it.cat}
                  </div>
                </div>
                <span className="font-mono-num font-bold text-[#0B110E] dark:text-[#F3F5F4] whitespace-nowrap">
                  R$ {formatBRL(it.val)}
                </span>
              </motion.li>
            ))}
          </ul>

          <div className="flex justify-end pb-safe">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white dark:text-[#060807] bg-[#0B130F] hover:bg-[#16221C] dark:bg-[#8CE02C] dark:hover:bg-[#9CEB3F] rounded-xl cursor-pointer"
            >
              Fechar Detalhes
            </button>
          </div>
        </div>
      )}
    </EditorialModalShell>
  );
}
