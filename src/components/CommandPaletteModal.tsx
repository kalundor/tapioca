import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  LayoutGrid,
  CreditCard,
  BarChart3,
  PiggyBank,
  Building2,
  Wallet,
  Plus,
  Bot,
  RefreshCw,
  Sun,
  Moon,
  X,
  ArrowRight,
  Receipt,
} from 'lucide-react';
import { formatBRL, type BillItem } from '../utils/financeMath';
import type { TransactionRecord } from './CashFlowReportsView';
import { EditorialModalShell } from './MotionPrimitives';

type AppSection = 'overview' | 'cashflow' | 'cards' | 'house' | 'savings' | 'income' | 'workspace';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  bills: BillItem[];
  transactions: TransactionRecord[];
  darkMode: boolean;
  onToggleTheme: () => void;
  onNavigate: (sec: AppSection) => void;
  onOpenNewBill: () => void;
  onOpenCopilot: () => void;
  onQuickSyncPluggy: () => void;
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  bills,
  transactions,
  darkMode,
  onToggleTheme,
  onNavigate,
  onOpenNewBill,
  onOpenCopilot,
  onQuickSyncPluggy,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const actions = useMemo(
    () => [
      {
        id: 'act-copilot',
        label: 'Abrir Copiloto Tapioca AI (Gemini & Microfone)',
        hint: 'Chat & Voz',
        icon: <Bot className="w-4 h-4 text-[#7AC128]" />,
        run: () => {
          onClose();
          onOpenCopilot();
        },
      },
      {
        id: 'act-bill',
        label: 'Adicionar Nova Despesa ou Conta',
        hint: 'Lançamento',
        icon: <Plus className="w-4 h-4 text-[#7AC128]" />,
        run: () => {
          onClose();
          onOpenNewBill();
        },
      },
      {
        id: 'act-sync',
        label: 'Sincronizar Contas Pluggy (Alan & Larissa)',
        hint: 'Open Finance',
        icon: <RefreshCw className="w-4 h-4 text-[#7AC128]" />,
        run: () => {
          onClose();
          onQuickSyncPluggy();
        },
      },
      {
        id: 'act-theme',
        label: darkMode ? 'Mudar para Tema Claro (Papel)' : 'Mudar para Tema Escuro (Floresta)',
        hint: 'Aparência',
        icon: darkMode ? <Sun className="w-4 h-4 text-[#E39C2B]" /> : <Moon className="w-4 h-4" />,
        run: () => {
          onToggleTheme();
          onClose();
        },
      },
      {
        id: 'nav-overview',
        label: 'Ir para Visão Geral & Saldos',
        hint: 'Tela',
        icon: <LayoutGrid className="w-4 h-4" />,
        run: () => {
          onNavigate('overview');
          onClose();
        },
      },
      {
        id: 'nav-cashflow',
        label: 'Abrir Estúdio de Gráficos, Planilha Excel & Simulador CDI',
        hint: 'Análise',
        icon: <BarChart3 className="w-4 h-4" />,
        run: () => {
          onNavigate('cashflow');
          onClose();
        },
      },
      {
        id: 'nav-cards',
        label: 'Gerenciar Conexões Pluggy (2 Contas) & Extrato',
        hint: 'Bancos',
        icon: <CreditCard className="w-4 h-4" />,
        run: () => {
          onNavigate('cards');
          onClose();
        },
      },
      {
        id: 'nav-savings',
        label: 'Ver Nossa Reserva CDB & Metas',
        hint: 'Investimentos',
        icon: <PiggyBank className="w-4 h-4" />,
        run: () => {
          onNavigate('savings');
          onClose();
        },
      },
      {
        id: 'nav-house',
        label: 'Abrir Contas da Casa 50/50',
        hint: 'Casal',
        icon: <Building2 className="w-4 h-4" />,
        run: () => {
          onNavigate('house');
          onClose();
        },
      },
      {
        id: 'nav-income',
        label: 'Ajustar Renda & Orçamento do Casal',
        hint: 'Configuração',
        icon: <Wallet className="w-4 h-4" />,
        run: () => {
          onNavigate('income');
          onClose();
        },
      },
    ],
    [darkMode, onClose, onNavigate, onOpenCopilot, onOpenNewBill, onQuickSyncPluggy, onToggleTheme]
  );

  const q = query.trim().toLowerCase();
  const filteredActions = actions.filter(
    (a) => !q || a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q)
  );
  const filteredBills = q
    ? bills.filter((b) => b.title.toLowerCase().includes(q)).slice(0, 4)
    : [];
  const filteredTxs = q
    ? transactions
        .filter(
          (t) =>
            t.description.toLowerCase().includes(q) ||
            t.accountName.toLowerCase().includes(q)
        )
        .slice(0, 4)
    : [];

  return (
    <EditorialModalShell
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Busca rápida e paleta de comandos"
      variant="palette"
      containerClassName="flex items-start justify-center p-4 pt-16 sm:pt-24"
    >
      <div className="w-full max-w-xl bg-white dark:bg-[#0D1210] rounded-2xl border border-[#E4E7E5] dark:border-[#1B231F] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-[#E4E7E5] dark:border-[#1B231F] bg-[#F7F8F7] dark:bg-[#090C0B]">
          <Search className="w-4 h-4 text-[#5C6660] dark:text-[#8C9891] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && filteredActions.length > 0) {
                filteredActions[0].run();
              }
            }}
            placeholder="Buscar lançamento, abrir gráficos, chamar Copiloto AI..."
            className="flex-1 bg-transparent text-sm text-[#0B110E] dark:text-[#F3F5F4] placeholder:text-[#8C9891] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar busca"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5C6660] hover:text-[#0B110E] dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2.5 space-y-3 text-xs">
          {filteredActions.length > 0 && (
            <div className="space-y-1">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-[#5C6660] dark:text-[#8C9891]">
                Ações &amp; Navegação
              </div>
              {filteredActions.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={act.run}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl hover:bg-[#F1F3F2] dark:hover:bg-[#19221D] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2.5 font-semibold text-[#0B110E] dark:text-[#F3F5F4] truncate">
                    {act.icon}
                    <span className="truncate">{act.label}</span>
                  </span>
                  <span className="text-[11px] text-[#5C6660] dark:text-[#8C9891] shrink-0 flex items-center gap-1">
                    <span>{act.hint}</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          )}

          {filteredBills.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[#E4E7E5] dark:border-[#1B231F]">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-[#5C6660] dark:text-[#8C9891]">
                Contas Encontradas
              </div>
              {filteredBills.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    onNavigate('house');
                    onClose();
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl hover:bg-[#F1F3F2] dark:hover:bg-[#19221D] flex items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2 font-medium text-[#0B110E] dark:text-white truncate">
                    <Receipt className="w-3.5 h-3.5 text-[#56AD17]" />
                    <span className="truncate">{b.title}</span>
                  </span>
                  <span className="font-mono-num font-bold text-[#0B110E] dark:text-[#8CE02C] shrink-0">
                    R$ {formatBRL(b.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {filteredTxs.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-[#E4E7E5] dark:border-[#1B231F]">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-[#5C6660] dark:text-[#8C9891]">
                Movimentações Open Finance
              </div>
              {filteredTxs.map((tx) => (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => {
                    onNavigate('cards');
                    onClose();
                  }}
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl hover:bg-[#F1F3F2] dark:hover:bg-[#19221D] flex items-center justify-between gap-2 text-left cursor-pointer"
                >
                  <span className="truncate font-medium text-[#0B110E] dark:text-white">
                    {tx.description} · <span className="text-[#5C6660] dark:text-[#8C9891]">{tx.accountName}</span>
                  </span>
                  <span className="font-mono-num font-bold text-[#0B110E] dark:text-white shrink-0">
                    R$ {formatBRL(tx.amount)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {filteredActions.length === 0 && filteredBills.length === 0 && filteredTxs.length === 0 && (
            <div className="py-8 text-center text-[#5C6660] dark:text-[#8C9891]">
              Nenhum resultado encontrado para &ldquo;{query}&rdquo;.
            </div>
          )}
        </div>
      </div>
    </EditorialModalShell>
  );
}
