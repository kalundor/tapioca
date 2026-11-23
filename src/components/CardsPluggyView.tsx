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
    <div className="space-y-6 animate-enter">
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

      {/* PLUGGY 2-ACCOUNT HERO SUMMARY */}
      <section
        aria-label="Central Pluggy 2 Contas do Casal"
        className="relative overflow-hidden rounded-3xl bg-[#090E0C] text-[#F3F5F4] p-5 sm:p-7 border border-[#1E2823] shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #8CE02C 1px, transparent 1px), linear-gradient(to bottom, #8CE02C 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 text-xs text-[#8CE02C] font-medium">
            <ShieldCheck className="w-4 h-4 text-[#8CE02C] shrink-0" />
            <span>Open Finance Pluggy · Arquitetura Direta de 2 Contas</span>
          </div>
          <h2 className="font-editorial text-2xl sm:text-[30px] font-bold tracking-tight leading-tight">
            Conexões do Casal:{' '}
            <span className="font-accent-serif text-[#F59E0B]">Alan</span> &amp;{' '}
            <span className="font-accent-serif text-[#8CE02C]">{profile.partnerName}</span>
          </h2>
          <p className="text-xs sm:text-[13px] text-[#9BA6A0] leading-relaxed">
            Conecte exatamente 2 contas Pluggy sincronizadas em tempo real: 1 para Alan (Titular) e 1
            para {profile.partnerName} (Namorada). Tudo entra automaticamente no cálculo de divisão 50/50
            e saldo previsto.
          </p>
        </div>

        <div className="relative flex flex-col sm:flex-row lg:flex-col xl:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <div className="flex items-center gap-3.5 bg-[#111714] border border-[#1E2823] text-white px-4 py-2.5 rounded-2xl">
            <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#060807] border border-[#8CE02C]/25 shrink-0">
              <img
                src="/assets/aistudio/2_326139fa.png"
                alt="Tapioca Pay Pluggy"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="border-l border-[#1E2823] pl-3 pr-1">
              <div className="text-[11px] font-medium text-[#8C9891]">Sincronização</div>
              <div className="font-editorial text-lg font-bold text-white whitespace-nowrap">
                {connectedCount} de 2 ativas
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSyncAllActiveSlots}
            disabled={syncingSlot === 'all'}
            className="px-4 py-3.5 rounded-xl bg-[#8CE02C] hover:bg-[#9CEB3F] disabled:opacity-60 text-[#060807] text-xs font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingSlot === 'all' ? 'animate-spin' : ''}`} />
            <span>{syncingSlot === 'all' ? 'Sincronizando...' : 'Sincronizar Contas'}</span>
          </button>
        </div>
      </section>

      {connectStatusMsg && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            connectStatusMsg.type === 'error'
              ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
              : connectStatusMsg.type === 'success'
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-200'
                : 'bg-[#F1F3F2] dark:bg-[#0D1210] border-[#E4E7E5] dark:border-[#1B231F] text-[#0B110E] dark:text-[#D1D7D4]'
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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
                        className={`w-11 h-11 rounded-full flex items-center justify-center font-editorial font-bold text-sm shrink-0 ${
                          isPartner
                            ? 'bg-[#D97706] text-white dark:bg-[#F59E0B] dark:text-[#060807]'
                            : 'bg-[#0B130F] text-[#8CE02C] border border-[#1E2823]'
                        }`}
                      >
                        {slot.ownerName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-editorial text-lg font-bold text-[#0B110E] dark:text-[#F3F5F4] truncate">
                            {slot.ownerName}
                          </h3>
                          <span className="text-[11px] font-medium text-[#5C6660] dark:text-[#8C9891]">
                            · {slot.roleLabel}
                          </span>
                        </div>
                        <p className="text-xs text-[#5C6660] dark:text-[#8C9891] truncate">
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
                            ? 'text-[#56AD17] dark:text-[#8CE02C]'
                            : 'text-[#B45309] dark:text-[#F59E0B]'
                        }
                      >
                        {isConnected ? 'Conectada' : 'Pendente'}
                      </span>
                    </div>
                  </div>

                  {/* Metrics or Onboarding Callout */}
                  {isConnected ? (
                    <div className="grid grid-cols-3 divide-x divide-[#E4E7E5] dark:divide-[#1B231F] rounded-xl bg-[#F7F8F7] dark:bg-[#090C0B] border border-[#E4E7E5] dark:border-[#1B231F]">
                      <div className="p-3.5">
                        <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                          Saldo / Limite
                        </div>
                        <div className="font-mono-num text-base font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-0.5">
                          <NumberTicker value={slot.totalBalance} prefix="R$ " />
                        </div>
                      </div>
                      <div className="p-3.5">
                        <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                          Contas
                        </div>
                        <div className="font-mono-num text-base font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-0.5">
                          {slot.accountsCount}
                        </div>
                      </div>
                      <div className="p-3.5">
                        <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                          Movimentações
                        </div>
                        <div className="font-mono-num text-base font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-0.5">
                          {slot.transactionsCount}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-[#F7F8F7] dark:bg-[#090C0B] border border-dashed border-[#D3D8D5] dark:border-[#1E2823] flex items-center gap-3.5">
                      <EmptyStateVaultIllustration className="w-14 h-14 shrink-0" />
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4]">
                          <Sparkles className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B] shrink-0" />
                          <span>Pronto para conectar a conta da {profile.partnerName} (Namorada)</span>
                        </div>
                        <p className="text-xs text-[#5C6660] dark:text-[#8C9891] leading-relaxed">
                          Clique abaixo para abrir o Pluggy Connect ou cole o Item ID da conta dela
                          para unificar faturas, saldo e a divisão 50/50 do casal.
                        </p>
                      </div>
                    </div>
                  )}

                  {slot.itemId && (
                    <div className="text-[11px] font-code text-[#5C6660] dark:text-[#8C9891] truncate">
                      Item ID: {slot.itemId}
                    </div>
                  )}
                </div>

                {/* Slot Actions Footer */}
                <div className="space-y-3 pt-3 border-t border-[#E4E7E5] dark:border-[#1B231F]">
                  <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenPluggyConnectForSlot(slot.slot)}
                      disabled={isOpening}
                      className={`min-h-[42px] sm:min-h-0 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center sm:justify-start gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                        isConnected
                          ? 'bg-[#F1F3F2] dark:bg-[#111714] text-[#0B110E] dark:text-[#F3F5F4] hover:bg-[#E4E7E5] dark:hover:bg-[#1B231F] border border-[#E4E7E5] dark:border-[#1B231F]'
                          : 'bg-[#0B130F] hover:bg-[#16221C] dark:bg-[#8CE02C] dark:hover:bg-[#9CEB3F] text-white dark:text-[#060807]'
                      }`}
                    >
                      <ExternalLink className={`w-3.5 h-3.5 ${isConnected ? 'text-[#56AD17] dark:text-[#8CE02C]' : 'text-[#8CE02C] dark:text-[#060807]'}`} />
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
                          className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0B130F] hover:bg-[#16221C] dark:bg-[#8CE02C] dark:hover:bg-[#9CEB3F] text-white dark:text-[#060807] flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDisconnect(slot.slot)}
                          disabled={isDisconnecting}
                          className="min-h-[42px] sm:min-h-0 px-3 py-2 rounded-xl text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/50 sm:border-transparent flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                          <span>{isDisconnecting ? 'Removendo...' : 'Desconectar'}</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setOpenUuidFormSlot(showUuidForm ? null : slot.slot)}
                      className="min-h-[40px] sm:min-h-0 px-3 py-2 rounded-xl text-xs font-medium text-[#5C6660] dark:text-[#8C9891] hover:bg-[#F1F3F2] dark:hover:bg-[#111714] flex items-center justify-center sm:justify-start gap-1 transition-colors cursor-pointer whitespace-nowrap"
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
                        className="flex-1 min-h-[42px] px-3 py-2 text-xs font-code rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4]"
                      />
                      <button
                        type="submit"
                        disabled={isSyncing}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0B130F] hover:bg-[#16221C] dark:bg-[#8CE02C] dark:hover:bg-[#9CEB3F] text-white dark:text-[#060807] text-xs font-semibold cursor-pointer whitespace-nowrap"
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
            <h2 className="font-editorial text-lg font-semibold text-[#0B110E] dark:text-[#F3F5F4]">
              Cartões &amp; Contas Sincronizadas ({creditCards.length})
            </h2>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
              Inspecione faturas e limites importados automaticamente das conexões Pluggy
            </p>
          </div>
        </div>

        {creditCards.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#F7F8F7] dark:bg-[#090C0B] border border-dashed border-[#D3D8D5] dark:border-[#1E2823] text-center text-xs text-[#5C6660] dark:text-[#8C9891]">
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
                  className="p-4 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <BankEmblem institution={card.name} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                          <UserCheck className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {isPartnerCard ? `${profile.partnerName} (Namorada)` : 'Alan (Titular)'}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-[#0B110E] dark:text-[#F3F5F4] mt-0.5 truncate">
                          {card.name}
                        </h3>
                        <span className="text-[11px] text-[#5C6660] dark:text-[#8C9891]">
                          Vence {card.dueDate} · {card.status}
                        </span>
                      </div>
                    </div>
                    <CreditCard className="w-4 h-4 text-[#5C6660] dark:text-[#8CE02C]/70 shrink-0" />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-[#E4E7E5] dark:border-[#1B231F] text-xs">
                    <div>
                      <div className="text-[#5C6660] dark:text-[#8C9891] text-[11px]">
                        Fatura / Saldo
                      </div>
                      <div className="font-mono-num font-bold text-[#0B110E] dark:text-[#F3F5F4] text-sm">
                        R$ {formatBRL(card.currentInvoice)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[#5C6660] dark:text-[#8C9891] text-[11px]">
                        Limite Livre
                      </div>
                      <div className="font-mono-num font-bold text-[#56AD17] dark:text-[#8CE02C] text-sm">
                        R$ {formatBRL(card.availableLimit)}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenInvoiceModal(card)}
                    className="min-h-[40px] w-full py-2 text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] bg-white dark:bg-[#111714] border border-[#E4E7E5] dark:border-[#1B231F] hover:bg-[#F1F3F2] dark:hover:bg-[#1B231F] rounded-xl transition-colors cursor-pointer"
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
            <h2 className="font-editorial text-lg font-semibold text-[#0B110E] dark:text-[#F3F5F4]">
              Extrato Unificado ({filteredTransactions.length})
            </h2>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
              Exibindo {displayedTransactions.length} de {filteredTransactions.length} movimentações
              reais via Pluggy
            </p>
          </div>

          <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
            {/* Segmented Owner Filter */}
            <div className="p-1 bg-[#F1F3F2] dark:bg-[#090C0B] border border-[#E4E7E5] dark:border-[#1B231F] rounded-xl grid grid-cols-3 sm:inline-flex items-center gap-1">
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
                  className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    ownerFilter === tab.id
                      ? 'bg-white dark:bg-[#111714] text-[#0B110E] dark:text-[#F3F5F4] shadow-2xs'
                      : 'text-[#5C6660] dark:text-[#8C9891] hover:text-[#0B110E] dark:hover:text-[#F3F5F4]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Inflow / Outflow Filter */}
            <div className="p-1 bg-[#F1F3F2] dark:bg-[#090C0B] border border-[#E4E7E5] dark:border-[#1B231F] rounded-xl grid grid-cols-3 sm:inline-flex items-center gap-1">
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
                  className={`min-h-[36px] sm:min-h-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    txTypeFilter === tab.id
                      ? 'bg-white dark:bg-[#111714] text-[#0B110E] dark:text-[#F3F5F4] shadow-2xs'
                      : 'text-[#5C6660] dark:text-[#8C9891] hover:text-[#0B110E] dark:hover:text-[#F3F5F4]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-[#5C6660] dark:text-[#8C9891] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar lançamento..."
                  aria-label="Buscar lançamento no extrato Open Finance"
                  className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4] sm:w-48"
                />
              </div>

              <select
                value={selectedAccountFilter}
                onChange={(e) => {
                  setSelectedAccountFilter(e.target.value);
                  setVisibleLimit(30);
                }}
                aria-label="Filtrar por instituição"
                className="min-h-[38px] px-3 py-1.5 text-xs rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4] max-w-[150px] sm:max-w-none"
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
                className="min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B] text-[#0B110E] dark:text-[#F3F5F4] hover:border-[#0B130F]/30 dark:hover:border-[#8CE02C]/40 flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5 text-[#56AD17] dark:text-[#8CE02C]" />
                <span className="hidden xl:inline">.csv</span>
              </button>
            </div>
          </div>
        </div>

        {displayedTransactions.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#F7F8F7] dark:bg-[#090C0B] border border-dashed border-[#D3D8D5] dark:border-[#1E2823] text-center space-y-2">
            <p className="text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4]">
              Nenhuma movimentação encontrada para este filtro.
            </p>
            <p className="text-xs text-[#5C6660] dark:text-[#8C9891]">
              {ownerFilter === 'partner'
                ? `Conecte a conta Pluggy de ${profile.partnerName} (Namorada) no card acima para ver seus lançamentos aqui.`
                : 'Tente limpar a busca ou sincronizar as contas conectadas.'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Tap-Row List */}
            <div className="md:hidden divide-y divide-[#E4E7E5] dark:divide-[#1B231F] text-xs">
              {displayedTransactions.map((tx) => {
                const isPartnerTx = tx.owner === 'partner';
                const positive = isIncomeTransaction(tx);
                return (
                  <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          isPartnerTx ? 'bg-[#D97706] dark:bg-[#F59E0B]' : 'bg-[#0B130F] dark:bg-[#8CE02C]'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-[#0B110E] dark:text-[#F3F5F4] truncate">
                          {cleanTxDescription(tx.description)}
                        </div>
                        <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] mt-0.5 truncate">
                          {tx.date} · {isPartnerTx ? profile.partnerName.split(' ')[0] : 'Alan'} ·{' '}
                          {tx.accountName}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`font-mono-num font-bold whitespace-nowrap shrink-0 ${
                        positive
                          ? 'text-[#56AD17] dark:text-[#8CE02C]'
                          : 'text-[#0B110E] dark:text-[#F3F5F4]'
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
                  <tr className="border-b border-[#E4E7E5] dark:border-[#1B231F] text-[#5C6660] dark:text-[#8C9891] font-semibold">
                    <th className="py-2.5 pr-4">Data</th>
                    <th className="py-2.5 pr-4">Titular</th>
                    <th className="py-2.5 pr-4">Estabelecimento / Descrição</th>
                    <th className="py-2.5 pr-4">Instituição</th>
                    <th className="py-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E7E5] dark:divide-[#1B231F]">
                  {displayedTransactions.map((tx) => {
                    const isPartnerTx = tx.owner === 'partner';
                    const positive = isIncomeTransaction(tx);
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-[#F7F8F7] dark:hover:bg-[#111714] transition-colors"
                      >
                        <td className="py-2.5 pr-4 font-mono-num text-[#5C6660] dark:text-[#8C9891] whitespace-nowrap">
                          {tx.date}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#0B110E] dark:text-[#D1D7D4]">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isPartnerTx ? 'bg-[#D97706] dark:bg-[#F59E0B]' : 'bg-[#0B130F] dark:bg-[#8CE02C]'
                              }`}
                            />
                            {isPartnerTx ? profile.partnerName.split(' ')[0] : 'Alan'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 font-medium text-[#0B110E] dark:text-[#F3F5F4]">
                          {cleanTxDescription(tx.description)}
                        </td>
                        <td className="py-2.5 pr-4 text-[#5C6660] dark:text-[#8C9891] whitespace-nowrap">
                          {tx.accountName}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono-num font-bold whitespace-nowrap ${
                            positive
                              ? 'text-[#56AD17] dark:text-[#8CE02C]'
                              : 'text-[#0B110E] dark:text-[#F3F5F4]'
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
          <div className="mt-4 pt-3 border-t border-[#E4E7E5] dark:border-[#1B231F] flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setVisibleLimit((prev) => prev + 50)}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#0B110E] dark:text-[#F3F5F4] bg-[#F1F3F2] dark:bg-[#111714] hover:bg-[#E4E7E5] dark:hover:bg-[#1B231F] rounded-xl transition-colors cursor-pointer"
            >
              Carregar +50 lançamentos
            </button>
            <button
              type="button"
              onClick={() => setVisibleLimit(filteredTransactions.length)}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#5C6660] dark:text-[#8C9891] hover:underline cursor-pointer"
            >
              Mostrar todos ({filteredTransactions.length})
            </button>
          </div>
        )}
      </SpotlightBento>
    </div>
  );
}
