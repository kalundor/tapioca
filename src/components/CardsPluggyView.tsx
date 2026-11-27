import React, { useState } from 'react';
import { PluggyConnect } from 'react-pluggy-connect';
import {
  RefreshCw,
  CreditCard,
  ShieldCheck,
  Search,
  Link2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Unlink,
  UserCheck,
  Sparkles,
  Download,
} from 'lucide-react';
import {
  formatBRL,
  cleanTxDescription,
  isIncomeTransaction,
  type CoupleProfile,
} from '../utils/financeMath';
import type { CreditCardRecord } from './OverviewView';
import type { TransactionRecord } from './CashFlowReportsView';
import { SpotlightBento, NumberTicker } from './MotionPrimitives';
import { BankEmblem, EmptyStateVaultIllustration } from './BrandAssets';

export interface PluggyConnectionSlot {
  slot: 'user' | 'partner';
  ownerName: string;
  roleLabel: string;
  itemId: string | null;
  institutionName: string;
  status: 'connected' | 'pending';
  lastSyncAt: string | null;
  accountsCount: number;
  transactionsCount: number;
  totalBalance: number;
}

interface CardsPluggyViewProps {
  profile: CoupleProfile;
  pluggyConnections: PluggyConnectionSlot[];
  creditCards: CreditCardRecord[];
  transactions: TransactionRecord[];
  onSyncPluggyInstitution: (institutionName: string, itemId?: string) => Promise<void>;
  onDisconnectSlot: (slot: 'user' | 'partner') => Promise<void>;
  onOpenInvoiceModal: (card: CreditCardRecord) => void;
  onRefreshWorkspace?: () => Promise<void>;
  clientUserId?: string;
}

export function CardsPluggyView({
  profile,
  pluggyConnections,
  creditCards,
  transactions,
  onSyncPluggyInstitution,
  onDisconnectSlot,
  onOpenInvoiceModal,
  onRefreshWorkspace,
  clientUserId = 'alanpires.contato@gmail.com',
}: CardsPluggyViewProps) {
  const [syncingSlot, setSyncingSlot] = useState<'user' | 'partner' | 'all' | null>(null);
  const [disconnectingSlot, setDisconnectingSlot] = useState<'user' | 'partner' | null>(null);
  const [uuidInputs, setUuidInputs] = useState<Record<'user' | 'partner', string>>({
    user: '',
    partner: '',
  });
  const [openUuidFormSlot, setOpenUuidFormSlot] = useState<'user' | 'partner' | null>(null);

  // Filters for unified ledger
  const [searchTerm, setSearchTerm] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'user' | 'partner'>('all');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'outflow' | 'inflow'>('all');
  const [selectedAccountFilter, setSelectedAccountFilter] = useState<string>('all');
  const [visibleLimit, setVisibleLimit] = useState<number>(30);

  // Pluggy Connect Widget state scoped to the active slot ('user' = Alan, 'partner' = Larissa)
  const [connectToken, setConnectToken] = useState<string | null>(null);
  const [connectSlot, setConnectSlot] = useState<'user' | 'partner'>('user');
  const [openingSlot, setOpeningSlot] = useState<'user' | 'partner' | null>(null);
  const [connectStatusMsg, setConnectStatusMsg] = useState<{
    type: 'info' | 'error' | 'success';
    text: string;
  } | null>(null);

  // Ensure exactly 2 normalized slots even if initial fallback state hasn't hydrated yet
  const slots: PluggyConnectionSlot[] =
    pluggyConnections.length === 2
      ? pluggyConnections
      : [
          {
            slot: 'user',
            ownerName: profile.displayName || 'Alan Pires',
            roleLabel: 'Titular',
            itemId: '7982b3e3-d73a-49f1-bc68-dbf48c8e55a6',
            institutionName: 'Nubank & Open Finance · Alan',
            status: 'connected',
            lastSyncAt: null,
            accountsCount: creditCards.filter((c) => (c.owner || 'user') === 'user').length,
            transactionsCount: transactions.filter((t) => (t.owner || 'user') === 'user').length,
            totalBalance: 515.9,
          },
          {
            slot: 'partner',
            ownerName: profile.partnerName || 'Larissa Ferraz',
            roleLabel: 'Namorada',
            itemId: null,
            institutionName: 'Aguardando conexão Pluggy',
            status: 'pending',
            lastSyncAt: null,
            accountsCount: creditCards.filter((c) => c.owner === 'partner').length,
            transactionsCount: transactions.filter((t) => t.owner === 'partner').length,
            totalBalance: 0,
          },
        ];

  const connectedCount = slots.filter((s) => s.status === 'connected').length;

  const handleOpenPluggyConnectForSlot = async (slot: 'user' | 'partner') => {
    setOpeningSlot(slot);
    setConnectSlot(slot);
    setConnectStatusMsg(null);
    const scopedClientUserId =
      slot === 'user' ? clientUserId : 'larissa-namorada@tapiocapay.app';

    try {
      const response = await fetch('/api/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientUserId: scopedClientUserId }),
      });
      const data = await response.json();

      if (!response.ok || !data.accessToken) {
        setConnectStatusMsg({
          type: 'error',
          text:
            data.error ||
            'Configure CLIENT_ID e CLIENT_SECRET reais da Pluggy no servidor para gerar o Connect Token.',
        });
        return;
      }

      setConnectToken(data.accessToken);
      const ownerDisplay = slot === 'user' ? profile.displayName : `${profile.partnerName} (Namorada)`;
      setConnectStatusMsg({
        type: 'info',
        text: `Pluggy Connect aberto para ${ownerDisplay}. Selecione a instituição para sincronizar automaticamente.`,
      });
    } catch (err: any) {
      setConnectStatusMsg({
        type: 'error',
        text: err.message || 'Não foi possível solicitar o Connect Token ao servidor.',
      });
    } finally {
      setOpeningSlot(null);
    }
  };

  const handlePluggyConnectSuccess = async (itemData: any) => {
    const itemId = itemData?.item?.id;
    const institutionName =
      itemData?.item?.connector?.name || 'Instituição Conectada via Pluggy';
    const targetOwner = connectSlot;
    setConnectToken(null);
    setConnectStatusMsg({
      type: 'info',
      text: `Importando contas e movimentações de ${institutionName} para ${
        targetOwner === 'user' ? 'Alan' : `${profile.partnerName} (Namorada)`
      }...`,
    });

    try {
      if (itemId) {
        const res = await fetch('/api/pluggy/sync-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, owner: targetOwner }),
        });
        const summary = await res.json();
        if (res.ok) {
          if (onRefreshWorkspace) await onRefreshWorkspace();
          setConnectStatusMsg({
            type: 'success',
            text: `Conta de ${
              targetOwner === 'user' ? 'Alan' : `${profile.partnerName} (Namorada)`
            } conectada (${institutionName}): ${summary.importedAccounts || 0} conta(s) e ${
              summary.importedTransactions || 0
            } lançamento(s) reais sincronizados.`,
          });
          return;
        }
        throw new Error(summary.error || 'Falha ao sincronizar o item conectado.');
      }
      await onSyncPluggyInstitution(institutionName, itemId);
    } catch (err: any) {
      setConnectStatusMsg({
        type: 'error',
        text: err.message || 'Erro ao sincronizar dados da conexão Pluggy.',
      });
    }
  };

  const handleSyncSlot = async (slot: PluggyConnectionSlot) => {
    if (!slot.itemId) {
      await handleOpenPluggyConnectForSlot(slot.slot);
      return;
    }
    setSyncingSlot(slot.slot);
    setConnectStatusMsg(null);
    try {
      const res = await fetch('/api/pluggy/sync-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: slot.itemId, owner: slot.slot }),
      });
      const summary = await res.json();
      if (!res.ok) {
        throw new Error(summary.error || 'Erro ao atualizar esta conta Pluggy.');
      }
      if (onRefreshWorkspace) await onRefreshWorkspace();
      setConnectStatusMsg({
        type: 'success',
        text: `${slot.ownerName} atualizado (${summary.institutionName}): ${
          summary.importedAccounts || 0
        } conta(s) e ${summary.importedTransactions || 0} lançamentos sincronizados.`,
      });
    } catch (err: any) {
      setConnectStatusMsg({
        type: 'error',
        text: err.message || 'Erro ao sincronizar conta Pluggy.',
      });
    } finally {
      setSyncingSlot(null);
    }
  };

  const handleSyncAllActiveSlots = async () => {
    const active = slots.filter((s) => s.itemId);
    if (active.length === 0) {
      await handleOpenPluggyConnectForSlot('user');
      return;
    }
    setSyncingSlot('all');
    setConnectStatusMsg(null);
    try {
      const res = await fetch('/api/pluggy/sync-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: active.map((s) => ({ itemId: s.itemId, owner: s.slot })),
        }),
      });
      const summary = await res.json();
      if (!res.ok) throw new Error(summary.error || 'Falha ao atualizar contas conectadas.');
      if (onRefreshWorkspace) await onRefreshWorkspace();
      setConnectStatusMsg({
        type: 'success',
        text: `${active.length} conta(s) Pluggy sincronizada(s) (${summary.institutionName}) — ${
          summary.importedTransactions || 0
        } movimentações atualizadas.`,
      });
    } catch (err: any) {
      setConnectStatusMsg({
        type: 'error',
        text: err.message || 'Erro ao sincronizar contas Pluggy.',
      });
    } finally {
      setSyncingSlot(null);
    }
  };

  const handleImportUuidForSlot = async (e: React.FormEvent, slot: 'user' | 'partner') => {
    e.preventDefault();
    const raw = (uuidInputs[slot] || '').trim();
    const match = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (!match) {
      setConnectStatusMsg({
        type: 'error',
        text: 'Cole um Item ID Pluggy válido no formato UUID (ex: 7982b3e3-d73a-49f1-bc68-dbf48c8e55a6).',
      });
      return;
    }
    setSyncingSlot(slot);
    setConnectStatusMsg(null);
    try {
      const res = await fetch('/api/pluggy/sync-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: match[0], owner: slot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível importar este Item ID.');
      if (onRefreshWorkspace) await onRefreshWorkspace();
      setUuidInputs((prev) => ({ ...prev, [slot]: '' }));
      setOpenUuidFormSlot(null);
      setConnectStatusMsg({
        type: 'success',
        text: `Item vinculado à conta de ${
          slot === 'user' ? 'Alan' : `${profile.partnerName} (Namorada)`
        } (${data.institutionName}): ${data.importedAccounts || 0} conta(s) e ${
          data.importedTransactions || 0
        } transações importadas.`,
      });
    } catch (err: any) {
      setConnectStatusMsg({
        type: 'error',
        text: err.message || 'Falha ao importar Item ID da Pluggy.',
      });
    } finally {
      setSyncingSlot(null);
    }
  };

  const handleDisconnect = async (slot: 'user' | 'partner') => {
    setDisconnectingSlot(slot);
    setConnectStatusMsg(null);
    try {
      await onDisconnectSlot(slot);
      setConnectStatusMsg({
        type: 'info',
        text: `Conta Pluggy de ${
          slot === 'user' ? 'Alan' : `${profile.partnerName} (Namorada)`
        } desconectada. Você pode reconectar outra instituição quando quiser.`,
      });
    } catch (err: any) {
      setConnectStatusMsg({
        type: 'error',
        text: err.message || 'Não foi possível desconectar esta conta.',
      });
    } finally {
      setDisconnectingSlot(null);
    }
  };

  const uniqueAccounts = Array.from(
    new Set(transactions.map((t) => t.accountName).filter(Boolean))
  );

  const filteredTransactions = transactions.filter((tx) => {
    const matchesOwner = ownerFilter === 'all' || (tx.owner || 'user') === ownerFilter;
    const isIn = isIncomeTransaction(tx);
    const matchesType =
      txTypeFilter === 'all' ||
      (txTypeFilter === 'inflow' && isIn) ||
      (txTypeFilter === 'outflow' && !isIn);
    const matchesSearch =
      !searchTerm.trim() ||
      cleanTxDescription(tx.description).toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAccount =
      selectedAccountFilter === 'all' ||
      tx.accountName.toLowerCase() === selectedAccountFilter.toLowerCase();
    return matchesOwner && matchesType && matchesSearch && matchesAccount;
  });

  const handleExportPluggyCsv = () => {
    const headers = ['Data', 'Titular', 'Descricao', 'Categoria', 'Instituicao', 'Tipo', 'Valor'];
    const rows = filteredTransactions.map((tx) => [
      tx.date,
      tx.owner === 'partner' ? profile.partnerName.split(' ')[0] : 'Alan',
      cleanTxDescription(tx.description),
      tx.category,
      tx.accountName,
      isIncomeTransaction(tx) ? 'Entrada' : 'Saida',
      tx.amount.toFixed(2),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tapioca-pay-extrato-pluggy-${filteredTransactions.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayedTransactions = filteredTransactions.slice(0, visibleLimit);

  return (
    <div className="tp-stagger space-y-6">
      {/* OFFICIAL PLUGGY CONNECT WIDGET MODAL */}
      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          includeSandbox={true}
          onSuccess={handlePluggyConnectSuccess}
          onError={(error: any) => {
            setConnectStatusMsg({
              type: 'error',
              text: error?.message || 'Ocorreu um erro durante a conexão no Pluggy Connect.',
            });
          }}
          onClose={() => setConnectToken(null)}
        />
      )}

      {/* OPEN SWISS BROADSHEET MASTHEAD — PLUGGY 2-ACCOUNT ARCHITECTURE */}
      <section
        aria-label="Central Pluggy 2 Contas do Casal"
        className="border-t-2 border-[#111110] dark:border-[#F5F5F2] border-b border-b-[#E2E2DC] dark:border-b-[#242429] pt-5 pb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-5"
      >
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#1D4ED8] dark:text-[#6088FF]">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Open Finance Pluggy · Arquitetura Direta de 2 Contas</span>
          </div>
          <h1 className="font-broadsheet text-3xl sm:text-4xl font-semibold tracking-[-0.025em] leading-[1.06] text-[#111110] dark:text-[#F5F5F2]">
            Conexões do Casal:{' '}
            <span className="font-accent-serif font-normal text-[#1D4ED8] dark:text-[#6088FF]">
              Alan
            </span>{' '}
            &amp;{' '}
            <span className="font-accent-serif font-normal text-[#C83E2B] dark:text-[#F9735B]">
              {profile.partnerName}
            </span>
          </h1>
          <p className="text-xs sm:text-[13px] text-[#5A5A54] dark:text-[#8E8E96] leading-relaxed">
            Conecte exatamente 2 contas Pluggy sincronizadas em tempo real: 1 para Alan (Titular) e 1
            para {profile.partnerName} (Namorada). Tudo entra automaticamente no cálculo de divisão 50/50
            e saldo previsto.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div className="flex items-center gap-3 bg-white dark:bg-[#111113] border border-[#E2E2DC] dark:border-[#242429] px-4 py-2.5 rounded-sm">
            <div className="w-10 h-10 rounded-xs overflow-hidden bg-[#111110] border border-[#E2E2DC] dark:border-[#242429] shrink-0">
              <img
                src="/assets/aistudio/2_326139fa.png"
                alt="Tapioca Pay Pluggy"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="border-l border-[#E2E2DC] dark:border-[#242429] pl-3 pr-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5A5A54] dark:text-[#8E8E96]">
                Sincronização
              </div>
              <div className="font-mono-num text-base font-bold text-[#111110] dark:text-[#F5F5F2] whitespace-nowrap">
                {connectedCount} de 2 ativas
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSyncAllActiveSlots}
            disabled={syncingSlot === 'all'}
            className="min-h-[46px] px-5 py-3 rounded-xs bg-[#1D4ED8] dark:bg-[#6088FF] hover:bg-[#1E40AF] dark:hover:bg-[#4F78F5] disabled:opacity-60 text-white dark:text-[#09090B] text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingSlot === 'all' ? 'animate-spin' : ''}`} />
            <span>{syncingSlot === 'all' ? 'Sincronizando...' : 'Sincronizar Contas'}</span>
          </button>
        </div>
      </section>

      {connectStatusMsg && (
        <div
          role="status"
          className={`p-3.5 rounded-sm border text-xs flex items-start gap-2.5 ${
            connectStatusMsg.type === 'error'
              ? 'bg-[#FDF2F0] dark:bg-[#231210] border-[#C83E2B]/30 dark:border-[#F9735B]/30 text-[#C83E2B] dark:text-[#F9735B]'
              : connectStatusMsg.type === 'success'
                ? 'bg-[#E6F4F1] dark:bg-[#0D2624] border-[#0F766E]/30 dark:border-[#2DD4BF]/30 text-[#0F766E] dark:text-[#2DD4BF]'
                : 'bg-[#F3F3EF] dark:bg-[#161619] border-[#E2E2DC] dark:border-[#242429] text-[#111110] dark:text-[#D5D5D0]'
          }`}
        >
          {connectStatusMsg.type === 'error' ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">{connectStatusMsg.text}</div>
        </div>
      )}

      {/* 2 DEDICATED COUPLE PLUGGY SLOTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {slots.map((slot) => {
          const isConnected = slot.status === 'connected';
          const isPartner = slot.slot === 'partner';
          const isSyncing = syncingSlot === slot.slot;
          const isOpening = openingSlot === slot.slot;
          const isDisconnecting = disconnectingSlot === slot.slot;
          const showUuidForm = openUuidFormSlot === slot.slot;

          return (
            <SpotlightBento key={slot.slot} className="p-5 sm:p-6">
              <div className="flex flex-col justify-between h-full gap-5">
                <div className="space-y-4">
                  {/* Top Identity Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xs flex items-center justify-center font-mono-num font-bold text-xs shrink-0 ${
                          isPartner
                            ? 'bg-[#C83E2B] dark:bg-[#F9735B] text-white dark:text-[#09090B]'
                            : 'bg-[#1D4ED8] dark:bg-[#6088FF] text-white dark:text-[#09090B]'
                        }`}
                      >
                        {slot.ownerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h2 className="font-broadsheet text-xl font-semibold text-[#111110] dark:text-[#F5F5F2] truncate">
                            {slot.ownerName}
                          </h2>
                          <span className="text-[11px] font-medium text-[#5A5A54] dark:text-[#8E8E96]">
                            · {slot.roleLabel}
                          </span>
                        </div>
                        <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] truncate">
                          {isConnected
                            ? slot.institutionName
                            : 'Nenhuma conta Pluggy vinculada ainda'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold shrink-0">
                      <span
                        className={
                          isConnected
                            ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                            : 'text-[#C83E2B] dark:text-[#F9735B]'
                        }
                      >
                        {isConnected ? 'Conectada' : 'Pendente'}
                      </span>
                    </div>
                  </div>

                  {/* Metrics or Onboarding Callout */}
                  {isConnected ? (
                    <div className="grid grid-cols-3 divide-x divide-[#E2E2DC] dark:divide-[#242429] rounded-sm bg-[#FAFAF8] dark:bg-[#0D0D10] border border-[#E2E2DC] dark:border-[#242429]">
                      <div className="p-3.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5A5A54] dark:text-[#8E8E96]">
                          Saldo / Limite
                        </div>
                        <div className="font-mono-num text-base font-bold text-[#111110] dark:text-[#F5F5F2] mt-1">
                          <NumberTicker value={slot.totalBalance} prefix="R$ " />
                        </div>
                      </div>
                      <div className="p-3.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5A5A54] dark:text-[#8E8E96]">
                          Contas
                        </div>
                        <div className="font-mono-num text-base font-bold text-[#111110] dark:text-[#F5F5F2] mt-1">
                          {slot.accountsCount}
                        </div>
                      </div>
                      <div className="p-3.5">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#5A5A54] dark:text-[#8E8E96]">
                          Movimentações
                        </div>
                        <div className="font-mono-num text-base font-bold text-[#111110] dark:text-[#F5F5F2] mt-1">
                          {slot.transactionsCount}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-sm bg-[#FAFAF8] dark:bg-[#0D0D10] border border-dashed border-[#D4D4CC] dark:border-[#2C2C34] flex items-center gap-3.5">
                      <EmptyStateVaultIllustration className="w-14 h-14 shrink-0" />
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#111110] dark:text-[#F5F5F2]">
                          <Sparkles className="w-3.5 h-3.5 text-[#C83E2B] dark:text-[#F9735B] shrink-0" />
                          <span>Pronto para conectar a conta da {profile.partnerName} (Namorada)</span>
                        </div>
                        <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96] leading-relaxed">
                          Clique abaixo para abrir o Pluggy Connect ou cole o Item ID da conta dela
                          para unificar faturas, saldo e a divisão 50/50 do casal.
                        </p>
                      </div>
                    </div>
                  )}

                  {slot.itemId && (
                    <div className="text-[11px] font-code text-[#5A5A54] dark:text-[#8E8E96] truncate">
                      Item ID: {slot.itemId}
                    </div>
                  )}
                </div>

                {/* Slot Actions Footer */}
                <div className="space-y-3 pt-3 border-t border-[#E2E2DC] dark:border-[#242429]">
                  <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPluggyConnectForSlot(slot.slot)}
                      disabled={isOpening}
                      className={`min-h-[42px] sm:min-h-[38px] px-3.5 py-2 rounded-xs text-xs font-semibold flex items-center justify-center sm:justify-start gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        isConnected
                          ? 'bg-[#F3F3EF] dark:bg-[#161619] text-[#111110] dark:text-[#F5F5F2] hover:border-[#111110]/30 dark:hover:border-[#F5F5F2]/30 border border-[#E2E2DC] dark:border-[#242429]'
                          : 'bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#6088FF] dark:hover:bg-[#4F78F5] text-white dark:text-[#09090B]'
                      }`}
                    >
                      <ExternalLink
                        className={`w-3.5 h-3.5 ${
                          isConnected ? 'text-[#1D4ED8] dark:text-[#6088FF]' : ''
                        }`}
                      />
                      <span>
                        {isOpening
                          ? 'Abrindo Pluggy...'
                          : isConnected
                            ? 'Trocar Banco (Pluggy)'
                            : `Conectar Conta ${isPartner ? 'da Larissa' : 'do Alan'}`}
                      </span>
                    </button>

                    {isConnected && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSyncSlot(slot)}
                          disabled={isSyncing}
                          className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-[38px] px-3.5 py-2 rounded-xs text-xs font-semibold bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#6088FF] dark:hover:bg-[#4F78F5] text-white dark:text-[#09090B] flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDisconnect(slot.slot)}
                          disabled={isDisconnecting}
                          className="min-h-[42px] sm:min-h-[38px] px-3 py-2 rounded-xs text-xs font-medium text-[#C83E2B] dark:text-[#F9735B] hover:bg-[#FDF2F0] dark:hover:bg-[#231210] border border-[#C83E2B]/30 dark:border-[#F9735B]/30 sm:border-transparent flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          <span>{isDisconnecting ? 'Removendo...' : 'Desconectar'}</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setOpenUuidFormSlot(showUuidForm ? null : slot.slot)}
                      className="min-h-[40px] sm:min-h-[38px] px-3 py-2 rounded-xs text-xs font-medium text-[#5A5A54] dark:text-[#8E8E96] hover:text-[#111110] dark:hover:text-[#F5F5F2] hover:bg-[#F3F3EF] dark:hover:bg-[#161619] flex items-center justify-center sm:justify-start gap-1 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>{showUuidForm ? 'Ocultar UUID' : 'Vincular via Item ID'}</span>
                    </button>
                  </div>

                  {showUuidForm && (
                    <form
                      onSubmit={(e) => handleImportUuidForSlot(e, slot.slot)}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1"
                    >
                      <input
                        type="text"
                        value={uuidInputs[slot.slot]}
                        onChange={(e) =>
                          setUuidInputs((prev) => ({ ...prev, [slot.slot]: e.target.value }))
                        }
                        placeholder={`Cole o Item ID UUID da Pluggy (${
                          slot.slot === 'user' ? 'Alan' : 'Larissa'
                        })...`}
                        aria-label={`Item ID Pluggy para ${slot.ownerName}`}
                        className="flex-1 min-h-[42px] px-3 py-2 text-xs font-code rounded-xs border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#0D0D10] text-[#111110] dark:text-[#F5F5F2]"
                      />
                      <button
                        type="submit"
                        disabled={isSyncing}
                        className="min-h-[42px] px-4 py-2 rounded-xs bg-[#1D4ED8] hover:bg-[#1E40AF] dark:bg-[#6088FF] dark:hover:bg-[#4F78F5] text-white dark:text-[#09090B] text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        {isSyncing ? 'Importando...' : 'Importar Item'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </SpotlightBento>
          );
        })}
      </div>

      {/* CARTÕES & CONTAS SINCRONIZADAS */}
      <SpotlightBento as="section" aria-label="Cartões e Contas Conectadas" className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-broadsheet text-xl font-semibold text-[#111110] dark:text-[#F5F5F2]">
              Cartões &amp; Contas Sincronizadas ({creditCards.length})
            </h2>
            <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96]">
              Inspecione faturas e limites importados automaticamente das conexões Pluggy
            </p>
          </div>
        </div>

        {creditCards.length === 0 ? (
          <div className="p-6 rounded-sm bg-[#FAFAF8] dark:bg-[#0D0D10] border border-dashed border-[#D4D4CC] dark:border-[#2C2C34] text-center text-xs text-[#5A5A54] dark:text-[#8E8E96]">
            Nenhuma conta ou cartão sincronizado ainda. Conecte a conta de Alan ou da{' '}
            {profile.partnerName} acima para carregar os cartões em tempo real.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {creditCards.map((card) => {
              const isPartnerCard = card.owner === 'partner';
              return (
                <div
                  key={card.id}
                  className="p-4 rounded-sm border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#0D0D10] flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BankEmblem institution={card.name} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#5A5A54] dark:text-[#8E8E96]">
                          <UserCheck className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {isPartnerCard ? `${profile.partnerName} (Namorada)` : 'Alan (Titular)'}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-[#111110] dark:text-[#F5F5F2] mt-0.5 truncate">
                          {card.name}
                        </h3>
                        <span className="text-[11px] text-[#5A5A54] dark:text-[#8E8E96]">
                          Vence {card.dueDate} · {card.status}
                        </span>
                      </div>
                    </div>
                    <CreditCard className="w-4 h-4 text-[#1D4ED8] dark:text-[#6088FF] shrink-0" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[#E2E2DC] dark:border-[#242429] text-xs">
                    <div>
                      <div className="text-[#5A5A54] dark:text-[#8E8E96] text-[11px]">
                        Fatura / Saldo
                      </div>
                      <div className="font-mono-num font-bold text-[#111110] dark:text-[#F5F5F2] text-sm">
                        R$ {formatBRL(card.currentInvoice)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#5A5A54] dark:text-[#8E8E96] text-[11px]">
                        Limite Livre
                      </div>
                      <div className="font-mono-num font-bold text-[#0F766E] dark:text-[#2DD4BF] text-sm">
                        R$ {formatBRL(card.availableLimit)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenInvoiceModal(card)}
                    className="min-h-[40px] w-full py-2 text-xs font-semibold text-[#111110] dark:text-[#F5F5F2] bg-white dark:bg-[#161619] border border-[#E2E2DC] dark:border-[#242429] hover:border-[#1D4ED8] dark:hover:border-[#6088FF] rounded-xs transition-colors cursor-pointer"
                  >
                    Ver Lançamentos
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </SpotlightBento>

      {/* EXTRATO UNIFICADO OPEN FINANCE */}
      <SpotlightBento as="section" aria-label="Extrato Unificado Open Finance" className="p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-broadsheet text-xl font-semibold text-[#111110] dark:text-[#F5F5F2]">
              Extrato Unificado ({filteredTransactions.length})
            </h2>
            <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96]">
              Exibindo {displayedTransactions.length} de {filteredTransactions.length} movimentações
              reais via Pluggy
            </p>
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
            {/* Segmented Owner Filter */}
            <div className="p-1 bg-[#F3F3EF] dark:bg-[#0D0D10] border border-[#E2E2DC] dark:border-[#242429] rounded-sm grid grid-cols-3 sm:inline-flex items-center gap-1">
              {(
                [
                  { id: 'all', label: 'Casal' },
                  { id: 'user', label: 'Alan' },
                  { id: 'partner', label: 'Larissa' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setOwnerFilter(tab.id);
                    setVisibleLimit(30);
                  }}
                  className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer ${
                    ownerFilter === tab.id
                      ? 'bg-white dark:bg-[#1D1D22] text-[#111110] dark:text-[#F5F5F2] border border-[#E2E2DC] dark:border-[#2C2C34]'
                      : 'text-[#5A5A54] dark:text-[#8E8E96] hover:text-[#111110] dark:hover:text-[#F5F5F2]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Inflow / Outflow Filter */}
            <div className="p-1 bg-[#F3F3EF] dark:bg-[#0D0D10] border border-[#E2E2DC] dark:border-[#242429] rounded-sm grid grid-cols-3 sm:inline-flex items-center gap-1">
              {(
                [
                  { id: 'all', label: 'Tudo' },
                  { id: 'outflow', label: 'Saídas' },
                  { id: 'inflow', label: 'Entradas' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setTxTypeFilter(tab.id);
                    setVisibleLimit(30);
                  }}
                  className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 text-xs font-semibold rounded-xs transition-colors cursor-pointer ${
                    txTypeFilter === tab.id
                      ? 'bg-white dark:bg-[#1D1D22] text-[#111110] dark:text-[#F5F5F2] border border-[#E2E2DC] dark:border-[#2C2C34]'
                      : 'text-[#5A5A54] dark:text-[#8E8E96] hover:text-[#111110] dark:hover:text-[#F5F5F2]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-[#5A5A54] dark:text-[#8E8E96] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar lançamento..."
                  aria-label="Buscar lançamento no extrato Open Finance"
                  className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs rounded-xs border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#0D0D10] text-[#111110] dark:text-[#F5F5F2] sm:w-48"
                />
              </div>

              <select
                value={selectedAccountFilter}
                onChange={(e) => {
                  setSelectedAccountFilter(e.target.value);
                  setVisibleLimit(30);
                }}
                aria-label="Filtrar por instituição"
                className="min-h-[38px] px-3 py-1.5 text-xs rounded-xs border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#0D0D10] text-[#111110] dark:text-[#F5F5F2] max-w-[150px] sm:max-w-none"
              >
                <option value="all">Todas as instituições</option>
                {uniqueAccounts.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleExportPluggyCsv}
                title="Exportar extrato filtrado (.csv)"
                aria-label="Exportar extrato filtrado em CSV"
                className="min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-xs border border-[#E2E2DC] dark:border-[#242429] bg-[#FAFAF8] dark:bg-[#0D0D10] text-[#111110] dark:text-[#F5F5F2] hover:border-[#1D4ED8] dark:hover:border-[#6088FF] flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-[#1D4ED8] dark:text-[#6088FF]" />
                <span className="hidden xl:inline">.csv</span>
              </button>
            </div>
          </div>
        </div>

        {displayedTransactions.length === 0 ? (
          <div className="p-8 rounded-sm bg-[#FAFAF8] dark:bg-[#0D0D10] border border-dashed border-[#D4D4CC] dark:border-[#2C2C34] text-center space-y-2">
            <p className="text-xs font-semibold text-[#111110] dark:text-[#F5F5F2]">
              Nenhuma movimentação encontrada para este filtro.
            </p>
            <p className="text-xs text-[#5A5A54] dark:text-[#8E8E96]">
              {ownerFilter === 'partner'
                ? `Conecte a conta Pluggy de ${profile.partnerName} (Namorada) no card acima para ver seus lançamentos aqui.`
                : 'Tente limpar a busca ou sincronizar as contas conectadas.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Tap-Row List */}
            <div className="md:hidden divide-y divide-[#ECECE6] dark:divide-[#1D1D22] text-xs">
              {displayedTransactions.map((tx) => {
                const isPartnerTx = tx.owner === 'partner';
                const positive = isIncomeTransaction(tx);
                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-xs mt-1.5 shrink-0 ${
                          isPartnerTx
                            ? 'bg-[#C83E2B] dark:bg-[#F9735B]'
                            : 'bg-[#1D4ED8] dark:bg-[#6088FF]'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-[#111110] dark:text-[#F5F5F2] truncate">
                          {cleanTxDescription(tx.description)}
                        </div>
                        <div className="text-[11px] font-mono-num text-[#5A5A54] dark:text-[#8E8E96] mt-0.5 truncate">
                          {tx.date} · {isPartnerTx ? profile.partnerName.split(' ')[0] : 'Alan'} ·{' '}
                          {tx.accountName}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`font-mono-num font-bold whitespace-nowrap shrink-0 ${
                        positive
                          ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                          : 'text-[#111110] dark:text-[#F5F5F2]'
                      }`}
                    >
                      {positive ? '+ ' : '– '}R$ {formatBRL(tx.amount)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop High-Density Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#111110]/20 dark:border-[#F5F5F2]/20 text-[11px] uppercase tracking-[0.06em] text-[#5A5A54] dark:text-[#8E8E96] font-semibold">
                    <th className="py-2.5 pr-4">Data</th>
                    <th className="py-2.5 pr-4">Titular</th>
                    <th className="py-2.5 pr-4">Estabelecimento / Descrição</th>
                    <th className="py-2.5 pr-4">Instituição</th>
                    <th className="py-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECECE6] dark:divide-[#1D1D22]">
                  {displayedTransactions.map((tx) => {
                    const isPartnerTx = tx.owner === 'partner';
                    const positive = isIncomeTransaction(tx);
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-[#FAFAF8] dark:hover:bg-[#161619] transition-colors"
                      >
                        <td className="py-2.5 pr-4 font-mono-num text-[#5A5A54] dark:text-[#8E8E96] whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#111110] dark:text-[#D5D5D0]">
                            <span
                              className={`w-2 h-2 rounded-xs ${
                                isPartnerTx
                                  ? 'bg-[#C83E2B] dark:bg-[#F9735B]'
                                  : 'bg-[#1D4ED8] dark:bg-[#6088FF]'
                              }`}
                            />
                            {isPartnerTx ? profile.partnerName.split(' ')[0] : 'Alan'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 font-medium text-[#111110] dark:text-[#F5F5F2]">
                          {cleanTxDescription(tx.description)}
                        </td>
                        <td className="py-2.5 pr-4 text-[#5A5A54] dark:text-[#8E8E96] whitespace-nowrap">
                          {tx.accountName}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono-num font-bold whitespace-nowrap ${
                            positive
                              ? 'text-[#0F766E] dark:text-[#2DD4BF]'
                              : 'text-[#111110] dark:text-[#F5F5F2]'
                          }`}
                        >
                          {positive ? '+ ' : '– '}R$ {formatBRL(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {filteredTransactions.length > visibleLimit && (
          <div className="mt-4 pt-3 border-t border-[#E2E2DC] dark:border-[#242429] flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setVisibleLimit((prev) => prev + 50)}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#111110] dark:text-[#F5F5F2] bg-[#F3F3EF] dark:bg-[#161619] border border-[#E2E2DC] dark:border-[#242429] hover:border-[#1D4ED8] dark:hover:border-[#6088FF] rounded-xs transition-colors cursor-pointer"
            >
              Carregar +50 lançamentos
            </button>
            <button
              type="button"
              onClick={() => setVisibleLimit(filteredTransactions.length)}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#5A5A54] dark:text-[#8E8E96] hover:text-[#1D4ED8] dark:hover:text-[#6088FF] hover:underline cursor-pointer"
            >
              Mostrar todos ({filteredTransactions.length})
            </button>
          </div>
        )}
      </SpotlightBento>
    </div>
  );
}
