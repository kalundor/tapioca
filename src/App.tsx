/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import {
  LayoutGrid,
  ArrowLeftRight,
  CreditCard,
  Building2,
  PiggyBank,
  Wallet,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Bell,
  Plus,
  Share2,
  X,
  SlidersHorizontal,
  Bot,
  Search,
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  getIdToken,
  logout,
} from './lib/firebase';
import {
  formatBRL,
  type BillItem,
  type CoupleProfile,
  type CostReductionSuggestion,
} from './utils/financeMath';
import { OverviewView, type CreditCardRecord } from './components/OverviewView';
import {
  CashFlowReportsView,
  type TransactionRecord,
  type BudgetAlertRecord,
} from './components/CashFlowReportsView';
import {
  CardsPluggyView,
  type PluggyConnectionSlot,
} from './components/CardsPluggyView';
import { SavingsGoalsView, type SavingsGoalRecord } from './components/SavingsGoalsView';
import { WorkspaceHubView } from './components/WorkspaceHubView';
import {
  AddBillModal,
  IncomeAndHouseSettingsView,
  InvoiceModal,
} from './components/ModalsAndDrawers';
import { VoiceAssistantWidget } from './components/VoiceAssistantWidget';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import {
  SlideViewTransition,
  ShimmerActionButton,
  EditorialModalShell,
  EDITORIAL_EASE,
  EDITORIAL_EXIT_EASE,
} from './components/MotionPrimitives';

type ActiveSection =
  | 'overview'
  | 'cashflow'
  | 'cards'
  | 'house'
  | 'savings'
  | 'income'
  | 'workspace';

const SECTION_TITLES: Record<ActiveSection, string> = {
  overview: 'Visão geral',
  cards: 'Pluggy (2 Contas)',
  cashflow: 'Fluxo & Insights',
  savings: 'Nossa reserva',
  house: 'Casa & Contas',
  income: 'Renda & Divisão',
  workspace: 'Google Workspace',
};

const INITIAL_FALLBACK_BILLS: BillItem[] = [
  {
    id: 101,
    title: 'Supermercado & Padaria (H B Carioca 1/2 e 2/2)',
    amount: 250.0,
    dueDay: 7,
    category: 'house',
    isHousingCost: true,
    paidBy: 'user',
    isShared: true,
    isPaid: true,
    monthKey: '2026-11',
    iconType: 'card',
  },
  {
    id: 102,
    title: 'Casa & Construção (Obramax Atacado)',
    amount: 134.63,
    dueDay: 16,
    category: 'house',
    isHousingCost: true,
    paidBy: 'user',
    isShared: true,
    isPaid: true,
    monthKey: '2026-11',
    iconType: 'crane',
  },
  {
    id: 103,
    title: 'Restaurantes & Café (Estrela Café / Monique)',
    amount: 183.05,
    dueDay: 8,
    category: 'house',
    isHousingCost: false,
    paidBy: 'partner',
    isShared: true,
    isPaid: true,
    monthKey: '2026-11',
    iconType: 'heart',
  },
  {
    id: 104,
    title: 'Telecom & Internet (Claro S.A. + Net Serviço)',
    amount: 54.78,
    dueDay: 10,
    category: 'house',
    isHousingCost: true,
    paidBy: 'user',
    isShared: true,
    isPaid: false,
    monthKey: '2026-11',
    iconType: 'wifi',
  },
  {
    id: 105,
    title: 'Saúde & Farmácia (RD Saúde — Raia Drogasil)',
    amount: 54.13,
    dueDay: 13,
    category: 'house',
    isHousingCost: true,
    paidBy: 'user',
    isShared: true,
    isPaid: true,
    monthKey: '2026-11',
    iconType: 'shield',
  },
  {
    id: 106,
    title: 'Aplicação CDB Porquinho — Banco Inter S.A.',
    amount: 333.33,
    dueDay: 14,
    category: 'personal',
    isHousingCost: false,
    paidBy: 'user',
    isShared: false,
    isPaid: true,
    monthKey: '2026-11',
    iconType: 'piggy',
  },
  {
    id: 107,
    title: 'Fatura Nubank (GOLD) — Mastercard',
    amount: 125.0,
    dueDay: 16,
    category: 'personal',
    isHousingCost: false,
    paidBy: 'user',
    isShared: false,
    isPaid: false,
    monthKey: '2026-11',
    iconType: 'card',
  },
  {
    id: 108,
    title: 'Mobilidade Urbana (Uber & 99 — 12 corridas)',
    amount: 62.21,
    dueDay: 15,
    category: 'personal',
    isHousingCost: false,
    paidBy: 'user',
    isShared: false,
    isPaid: true,
    monthKey: '2026-11',
    iconType: 'zap',
  },
  {
    id: 109,
    title: 'Compras & Serviços Digitais (Americanas / GGMax)',
    amount: 48.8,
    dueDay: 12,
    category: 'personal',
    isHousingCost: false,
    paidBy: 'user',
    isShared: false,
    isPaid: true,
    monthKey: '2026-11',
    iconType: 'card',
  },
  {
    id: 110,
    title: 'Fatura Banco Inter (GOLD) — Mastercard',
    amount: 9.99,
    dueDay: 15,
    category: 'personal',
    isHousingCost: false,
    paidBy: 'user',
    isShared: false,
    isPaid: false,
    monthKey: '2026-11',
    iconType: 'card',
  },
];

const INITIAL_PLUGGY_SLOTS: PluggyConnectionSlot[] = [
  {
    slot: 'user',
    ownerName: 'Alan Pires',
    roleLabel: 'Titular',
    itemId: '7982b3e3-d73a-49f1-bc68-dbf48c8e55a6',
    institutionName: 'Nubank & Open Finance · Alan',
    status: 'connected',
    lastSyncAt: null,
    accountsCount: 3,
    transactionsCount: 5,
    totalBalance: 515.9,
  },
  {
    slot: 'partner',
    ownerName: 'Larissa Ferraz',
    roleLabel: 'Namorada',
    itemId: null,
    institutionName: 'Aguardando conexão Pluggy',
    status: 'pending',
    lastSyncAt: null,
    accountsCount: 0,
    transactionsCount: 0,
    totalBalance: 0,
  },
];

const MONTHS = ['Outubro 2026', 'Novembro 2026', 'Dezembro 2026', 'Janeiro 2027'];

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [monthIdx, setMonthIdx] = useState(1);
  const [darkMode, setDarkMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [profile, setProfile] = useState<CoupleProfile>({
    displayName: 'Alan Pires',
    partnerName: 'Larissa Ferraz',
    userSalary: 1588.58,
    partnerSalary: 1251.69,
    dayToDayBudget: 140.0,
    pixSettled: false,
  });
  const [pluggyConnections, setPluggyConnections] =
    useState<PluggyConnectionSlot[]>(INITIAL_PLUGGY_SLOTS);
  const [bills, setBills] = useState<BillItem[]>(INITIAL_FALLBACK_BILLS);
  const [creditCards, setCreditCards] = useState<CreditCardRecord[]>([
    {
      id: 201,
      name: 'Nubank (GOLD)',
      brand: 'mastercard',
      tier: 'MASTERCARD GOLD',
      status: 'Aberta',
      dueDate: '16/11',
      currentInvoice: 125.0,
      availableLimit: 1175.0,
      nextJanInvoice: 112.5,
      nextFebInvoice: 98.0,
      colorTheme: 'purple',
      pluggyItemId: '7982b3e3-d73a-49f1-bc68-dbf48c8e55a6',
      owner: 'user',
    },
    {
      id: 202,
      name: 'Banco Inter (GOLD)',
      brand: 'mastercard',
      tier: 'MASTERCARD GOLD',
      status: 'Aberta',
      dueDate: '15/11',
      currentInvoice: 9.99,
      availableLimit: 514.89,
      nextJanInvoice: 9.99,
      nextFebInvoice: 9.99,
      colorTheme: 'orange',
      pluggyItemId: '3c8b3fca-d92e-47cb-bcb0-04a301b29920',
      owner: 'user',
    },
    {
      id: 203,
      name: 'Banco Santander Pessoa Física',
      brand: 'santander',
      tier: 'CONTA CORRENTE & PIX',
      status: 'Ativa',
      dueDate: '10/11',
      currentInvoice: 241.05,
      availableLimit: 621.45,
      nextJanInvoice: 210.0,
      nextFebInvoice: 195.0,
      colorTheme: 'dark',
      pluggyItemId: '33115539-9017-4732-b3d2-4d23c9caa164',
      owner: 'user',
    },
  ]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalRecord[]>([
    {
      id: 301,
      title: 'CDB Porquinho — Banco Inter S.A. (100% CDI)',
      category: 'Open Finance Pluggy · Renda Fixa CDB',
      currentAmount: 333.75,
      targetAmount: 1000.0,
      monthlyContribution: 333.33,
      deadline: 'Outubro 2028',
    },
    {
      id: 302,
      title: 'Saldo em Conta Corrente — Banco Inter S.A.',
      category: 'Open Finance Pluggy · Liquidez Imediata',
      currentAmount: 181.14,
      targetAmount: 1000.0,
      monthlyContribution: 181.14,
      deadline: 'Disponível Hoje',
    },
    {
      id: 303,
      title: 'CDB Nu Financeira S.A. — Nubank (100% CDI)',
      category: 'Open Finance Pluggy · Renda Fixa RDB',
      currentAmount: 1.01,
      targetAmount: 500.0,
      monthlyContribution: 100.0,
      deadline: 'Outubro 2028',
    },
  ]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([
    {
      id: 1,
      description: 'Aplicação - Cdb Porq Obj Banco Inter S A',
      merchant: 'Banco Inter',
      amount: 333.33,
      category: 'Investments',
      date: '2026-11-14',
      accountName: 'Banco Inter',
      source: 'pluggy_live',
      isRecurring: true,
      owner: 'user',
    },
    {
      id: 2,
      description: 'Pix enviado - Rd Saude',
      merchant: 'Banco Inter',
      amount: 54.13,
      category: 'Healthcare',
      date: '2026-11-13',
      accountName: 'Banco Inter',
      source: 'pluggy_live',
      isRecurring: false,
      owner: 'user',
    },
    {
      id: 3,
      description: 'LIQUIDO DE VENCIMENTO SPDM - ASS 61699567013170',
      merchant: 'Banco Santander PF',
      amount: 621.45,
      category: 'Salary',
      date: '2026-11-10',
      accountName: 'Banco Santander PF',
      source: 'pluggy_live',
      isRecurring: true,
      owner: 'user',
    },
    {
      id: 4,
      description: 'H B Carioca 2/2',
      merchant: 'Nubank',
      amount: 125.0,
      category: 'Groceries',
      date: '2026-11-07',
      accountName: 'Nubank (GOLD)',
      source: 'pluggy_live',
      isRecurring: false,
      owner: 'user',
    },
    {
      id: 5,
      description: 'Pix recebido - Adsumus Engenharia E Seguranca Contra Incendio',
      merchant: 'Banco Inter',
      amount: 330.0,
      category: 'Transfer - PIX',
      date: '2026-11-04',
      accountName: 'Banco Inter',
      source: 'pluggy_live',
      isRecurring: true,
      owner: 'user',
    },
  ]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlertRecord[]>([
    {
      id: 1,
      category: 'Mobilidade Urbana (Uber & 99)',
      limitAmount: 50.0,
      currentSpent: 62.21,
      isRead: false,
      pushEnabled: true,
    },
    {
      id: 2,
      category: 'Fatura Nubank Mastercard Gold',
      limitAmount: 100.0,
      currentSpent: 125.0,
      isRead: false,
      pushEnabled: true,
    },
    {
      id: 3,
      category: 'Alimentação & Café (H B Carioca / Estrela)',
      limitAmount: 200.0,
      currentSpent: 241.05,
      isRead: false,
      pushEnabled: true,
    },
  ]);

  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [addBillDefaultCat, setAddBillDefaultCat] = useState<'house' | 'personal'>('house');
  const [selectedCardForInvoice, setSelectedCardForInvoice] = useState<CreditCardRecord | null>(
    null
  );
  const [showNotificationsPopover, setShowNotificationsPopover] = useState(false);
  const [pushBanner, setPushBanner] = useState<{ title: string; body: string } | null>(null);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const buildAuthHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const idToken = await getIdToken();
    if (idToken) {
      headers.Authorization = `Bearer ${idToken}`;
    }
    return headers;
  };

  const fetchWorkspace = useCallback(async () => {
    try {
      const headers = await buildAuthHeaders();
      const res = await fetch('/api/workspace', { headers });
      if (!res.ok) return;
      const data = await res.json();
      if (data.profile) setProfile(data.profile);
      if (Array.isArray(data.pluggyConnections) && data.pluggyConnections.length === 2) {
        setPluggyConnections(data.pluggyConnections);
      }
      if (Array.isArray(data.bills)) setBills(data.bills);
      if (Array.isArray(data.creditCards)) setCreditCards(data.creditCards);
      if (Array.isArray(data.savingsGoals)) setSavingsGoals(data.savingsGoals);
      if (Array.isArray(data.transactions)) setTransactions(data.transactions);
      if (Array.isArray(data.budgetAlerts)) setBudgetAlerts(data.budgetAlerts);
    } catch (err) {
      console.error('Error loading workspace:', err);
    }
  }, []);

  useEffect(() => {
    const unsub = initAuth(
      (user) => {
        setIsAuthenticated(true);
        setUserEmail(user.email);
        fetchWorkspace();
      },
      () => {
        setIsAuthenticated(false);
        setUserEmail(null);
        fetchWorkspace();
      }
    );
    return () => unsub();
  }, [fetchWorkspace]);

  const triggerPushNotification = (title: string, body: string) => {
    setPushBanner({ title, body });
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') new Notification(title, { body });
        });
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setIsAuthenticated(true);
        setUserEmail(res.user.email);
        await fetchWorkspace();
        triggerPushNotification(
          'Conta Google Conectada — Tapioca Pay',
          `Bem-vindo(a), ${res.user.displayName || res.user.email}!`
        );
      }
    } catch (err: any) {
      if (
        err?.code !== 'auth/popup-closed-by-user' &&
        err?.code !== 'auth/cancelled-popup-request'
      ) {
        triggerPushNotification(
          'Autenticação Google',
          err.message || 'Não foi possível concluir o login com Google.'
        );
      }
    }
  };

  const handleToggleBillPaid = async (billId: number, nextPaid: boolean) => {
    setBills((prev) => prev.map((b) => (b.id === billId ? { ...b, isPaid: nextPaid } : b)));
    try {
      const headers = await buildAuthHeaders();
      await fetch(`/api/bills/${billId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ isPaid: nextPaid }),
      });
    } catch (err) {
      console.error('Failed to update bill paid state:', err);
    }
  };

  const handleCreateBill = async (payload: {
    title: string;
    amount: number;
    dueDay: number;
    category: 'house' | 'personal';
    isHousingCost: boolean;
    paidBy: 'user' | 'partner';
    isShared: boolean;
    iconType: string;
  }) => {
    const optimisticBill: BillItem = {
      id: Date.now(),
      ...payload,
      isPaid: false,
      monthKey: '2026-11',
    };
    setBills((prev) => [...prev, optimisticBill]);

    if (payload.amount >= 200) {
      triggerPushNotification(
        `Alerta de Despesa: ${payload.title}`,
        `Novo lançamento de R$ ${formatBRL(payload.amount)} registrado no Tapioca Pay.`
      );
    }

    try {
      const headers = await buildAuthHeaders();
      await fetch('/api/bills', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      await fetchWorkspace();
    } catch (err) {
      console.error('Error creating bill:', err);
    }
  };

  const handleDeleteBill = async (billId: number) => {
    setBills((prev) => prev.filter((b) => b.id !== billId));
    try {
      const headers = await buildAuthHeaders();
      await fetch(`/api/bills/${billId}`, { method: 'DELETE', headers });
    } catch (err) {
      console.error('Error deleting bill:', err);
    }
  };

  const handleSettlePix = async (settled: boolean) => {
    setProfile((prev) => ({ ...prev, pixSettled: settled }));
    try {
      const headers = await buildAuthHeaders();
      await fetch('/api/profile', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ pixSettled: settled }),
      });
    } catch (err) {
      console.error('Error updating pix settled:', err);
    }
  };

  const handleUpdateProfile = async (updates: Partial<CoupleProfile>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
    try {
      const headers = await buildAuthHeaders();
      await fetch('/api/profile', {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  const handleCreateGoal = async (payload: {
    title: string;
    category: string;
    targetAmount: number;
    monthlyContribution: number;
    deadline: string;
  }) => {
    const newGoal: SavingsGoalRecord = {
      id: Date.now(),
      currentAmount: 0,
      ...payload,
    };
    setSavingsGoals((prev) => [...prev, newGoal]);
    try {
      const headers = await buildAuthHeaders();
      await fetch('/api/goals', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      await fetchWorkspace();
    } catch (err) {
      console.error('Error creating goal:', err);
    }
  };

  const handleContributeGoal = async (goalId: number, amount: number) => {
    setSavingsGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, currentAmount: g.currentAmount + amount } : g))
    );
    try {
      const headers = await buildAuthHeaders();
      await fetch('/api/goals', {
        method: 'POST',
        headers,
        body: JSON.stringify({ goalId, contributionAmount: amount }),
      });
    } catch (err) {
      console.error('Error contributing to goal:', err);
    }
  };

  const handleApplySavingsSuggestion = async (suggestion: CostReductionSuggestion) => {
    if (savingsGoals[0]) {
      await handleContributeGoal(savingsGoals[0].id, suggestion.potentialMonthlySavings);
    }
    triggerPushNotification(
      'Meta de Redução de Custos Aplicada!',
      `Economia mensal de R$ ${formatBRL(suggestion.potentialMonthlySavings)} direcionada para "${
        savingsGoals[0]?.title || 'CDB Porquinho Banco Inter'
      }".`
    );
  };

  const handleSyncPluggyInstitution = async (institutionName: string, itemId?: string) => {
    try {
      const headers = await buildAuthHeaders();
      await fetch('/api/pluggy/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ institutionName, itemId }),
      });
      await fetchWorkspace();
      triggerPushNotification(
        `Sincronização Open Finance Concluída`,
        `${institutionName} atualizado via Pluggy no Tapioca Pay.`
      );
    } catch (err) {
      console.error('Error syncing Pluggy:', err);
    }
  };

  const handleQuickSyncAllPluggy = async () => {
    const activeSlots = pluggyConnections.filter((s) => s.status === 'connected' && s.itemId);
    if (activeSlots.length === 0) {
      navigateTo('cards');
      return;
    }
    try {
      const headers = await buildAuthHeaders();
      for (const s of activeSlots) {
        await fetch('/api/pluggy/sync', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            institutionName: s.institutionName,
            itemId: s.itemId,
            slot: s.slot,
          }),
        });
      }
      await fetchWorkspace();
      triggerPushNotification(
        'Sincronização Pluggy Concluída',
        `${activeSlots.length} conexão(ões) Open Finance atualizada(s) no Tapioca Pay.`
      );
    } catch (err) {
      console.error('Error quick syncing Pluggy:', err);
    }
  };

  const handleDisconnectPluggySlot = async (slot: 'user' | 'partner') => {
    const headers = await buildAuthHeaders();
    const res = await fetch('/api/pluggy/disconnect', {
      method: 'POST',
      headers,
      body: JSON.stringify({ slot }),
    });
    if (!res.ok) {
      throw new Error('Falha ao desconectar conta Pluggy.');
    }
    await fetchWorkspace();
  };

  const connectedPluggyCount = pluggyConnections.filter((c) => c.status === 'connected').length;

  const navMenuItems: Array<{
    id: ActiveSection;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'overview', label: 'Visão geral', icon: <LayoutGrid className="w-4 h-4" /> },
    { id: 'cards', label: 'Pluggy (2 Contas)', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'cashflow', label: 'Fluxo & Insights', icon: <ArrowLeftRight className="w-4 h-4" /> },
    { id: 'savings', label: 'Nossa reserva', icon: <PiggyBank className="w-4 h-4" /> },
  ];

  const navSettingsItems: Array<{
    id: ActiveSection;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'house', label: 'Casa & Contas', icon: <Building2 className="w-4 h-4" /> },
    { id: 'income', label: 'Renda & Divisão', icon: <Wallet className="w-4 h-4" /> },
    { id: 'workspace', label: 'Google Workspace', icon: <Share2 className="w-4 h-4" /> },
  ];

  const navigateTo = (sec: ActiveSection) => {
    setActiveSection(sec);
    setMobileMenuOpen(false);
    setShowNotificationsPopover(false);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#F7F8F7] dark:bg-[#060807] text-[#0B110E] dark:text-[#F3F5F4] flex flex-col lg:flex-row">
      {/* DESKTOP ARCHITECTURAL HAIRLINE RAIL (lg+) */}
      <aside
        aria-label="Menu lateral Tapioca Pay"
        className="hidden lg:flex w-[236px] sticky top-0 h-screen shrink-0 bg-[#F1F3F2] dark:bg-[#090C0B] border-r border-[#E4E7E5] dark:border-[#1B231F] px-3.5 py-5 flex-col justify-between select-none"
      >
        <div className="space-y-5">
          {/* Clean Brand Wordmark (No Subtitle Clutter) */}
          <div className="px-1.5 pb-4 border-b border-[#E4E7E5] dark:border-[#1B231F]">
            <button
              type="button"
              onClick={() => navigateTo('overview')}
              className="w-full text-left flex items-center gap-2.5 group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl overflow-hidden border border-[#0B110E]/10 dark:border-white/10 shrink-0 bg-[#0B130F]">
                <img
                  src="/assets/aistudio/2_326139fa.png"
                  alt="Emblema Tapioca Pay"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="font-editorial text-[19px] font-extrabold tracking-tight text-[#0B110E] dark:text-[#F3F5F4] leading-none flex items-baseline gap-1 whitespace-nowrap">
                <span>Tapioca</span>
                <span className="font-accent-serif text-[#56AD17] dark:text-[#8CE02C] font-semibold">
                  pay
                </span>
              </div>
            </button>
          </div>

          {/* Search Command Palette Trigger */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            className="w-full h-9 px-3 rounded-lg bg-white dark:bg-[#0D1210] border border-[#E4E7E5] dark:border-[#1B231F] hover:border-[#0B110E]/25 dark:hover:border-[#8CE02C]/40 flex items-center justify-between gap-2 text-xs text-[#5C6660] dark:text-[#8C9891] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="w-3.5 h-3.5 text-[#56AD17] dark:text-[#8CE02C] shrink-0" />
              <span className="truncate">Buscar ou comando...</span>
            </span>
            <kbd className="font-code text-[10px] px-1.5 py-0.5 rounded bg-[#F1F3F2] dark:bg-[#141C17] text-[#0B110E] dark:text-[#D5E0D9] shrink-0">
              ⌘K
            </kbd>
          </button>

          <nav aria-label="Navegação principal" className="space-y-5">
            <div>
              <div className="px-2.5 text-[11px] font-semibold tracking-wide text-[#5C6660] dark:text-[#6E7A73] mb-1.5">
                Principal
              </div>
              <ul className="space-y-0.5">
                {navMenuItems.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => navigateTo(item.id)}
                        className={`relative w-full h-9 px-2.5 rounded-lg text-[13px] flex items-center justify-between gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                          isActive
                            ? 'text-[#0B110E] dark:text-white font-semibold'
                            : 'text-[#4B5550] dark:text-[#8C9891] hover:bg-[#E7EAE8]/70 dark:hover:bg-[#121815] hover:text-[#0B110E] dark:hover:text-white font-medium'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active-rail"
                            transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                            className="absolute inset-0 rounded-lg bg-white dark:bg-[#141C17] border border-[#E4E7E5] dark:border-[#24302A] shadow-2xs"
                          />
                        )}
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-r-full bg-[#56AD17] dark:bg-[#8CE02C] z-20" />
                        )}
                        <div className="relative z-10 flex items-center gap-2.5">
                          <span
                            className={
                              isActive
                                ? 'text-[#56AD17] dark:text-[#8CE02C]'
                                : 'text-[#6A756F] dark:text-[#6E7A73]'
                            }
                          >
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </div>
                        {item.id === 'cards' && (
                          <span
                            className={`relative z-10 font-mono-num text-[11px] font-semibold ${
                              isActive ? 'text-[#56AD17] dark:text-[#8CE02C]' : 'text-[#5C6660] dark:text-[#8C9891]'
                            }`}
                          >
                            {connectedPluggyCount}/2
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <div className="px-2.5 text-[11px] font-semibold tracking-wide text-[#5C6660] dark:text-[#6E7A73] mb-1.5">
                Ajustes do Casal
              </div>
              <ul className="space-y-0.5">
                {navSettingsItems.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => navigateTo(item.id)}
                        className={`relative w-full h-9 px-2.5 rounded-lg text-[13px] flex items-center gap-2.5 transition-colors whitespace-nowrap cursor-pointer ${
                          isActive
                            ? 'text-[#0B110E] dark:text-white font-semibold'
                            : 'text-[#4B5550] dark:text-[#8C9891] hover:bg-[#E7EAE8]/70 dark:hover:bg-[#121815] hover:text-[#0B110E] dark:hover:text-white font-medium'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active-rail"
                            transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                            className="absolute inset-0 rounded-lg bg-white dark:bg-[#141C17] border border-[#E4E7E5] dark:border-[#24302A] shadow-2xs"
                          />
                        )}
                        {isActive && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-r-full bg-[#56AD17] dark:bg-[#8CE02C] z-20" />
                        )}
                        <span
                          className={`relative z-10 ${
                            isActive
                              ? 'text-[#56AD17] dark:text-[#8CE02C]'
                              : 'text-[#6A756F] dark:text-[#6E7A73]'
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span className="relative z-10">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </div>

        {/* Bottom Theme Switcher + Alan & Larissa Profile */}
        <div className="flex flex-col gap-3 pt-4 border-t border-[#E4E7E5] dark:border-[#1B231F]">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-[#5C6660] dark:text-[#8C9891] flex items-center gap-1.5">
              {darkMode ? (
                <Moon className="w-3.5 h-3.5 text-[#8CE02C]" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-[#D97706]" />
              )}
              <span>Tema</span>
            </span>
            <div className="flex items-center bg-[#E4E7E5] dark:bg-[#111714] p-0.5 rounded-lg">
              <button
                type="button"
                aria-label="Ativar tema claro"
                onClick={() => setDarkMode(false)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                  !darkMode
                    ? 'bg-white text-[#0B110E] shadow-2xs'
                    : 'text-[#5C6660] dark:text-[#8C9891]'
                }`}
              >
                Claro
              </button>
              <button
                type="button"
                aria-label="Ativar tema escuro"
                onClick={() => setDarkMode(true)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                  darkMode
                    ? 'bg-[#19221D] text-[#F3F5F4] shadow-2xs'
                    : 'text-[#5C6660]'
                }`}
              >
                Escuro
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigateTo('cards')}
            className="w-full p-2.5 rounded-xl bg-white dark:bg-[#0D1210] border border-[#E4E7E5] dark:border-[#1B231F] flex items-center justify-between text-left hover:border-[#0B110E]/25 dark:hover:border-[#8CE02C]/40 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex -space-x-2 shrink-0">
                <span className="w-7 h-7 rounded-full bg-[#0B130F] text-[#8CE02C] text-[10px] font-bold flex items-center justify-center ring-2 ring-[#F1F3F2] dark:ring-[#090C0B] font-editorial">
                  AL
                </span>
                <span className="w-7 h-7 rounded-full bg-[#D97706] text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#F1F3F2] dark:ring-[#090C0B] font-editorial">
                  LF
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#0B110E] dark:text-[#F3F5F4] truncate">
                  {profile.displayName.split(' ')[0]} &amp; {profile.partnerName.split(' ')[0]}
                </div>
                <div className="text-[11px] text-[#5C6660] dark:text-[#8C9891] truncate">
                  {connectedPluggyCount}/2 Pluggy
                </div>
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#5C6660] shrink-0" />
          </button>
        </div>
      </aside>

      {/* MOBILE / TABLET BOTTOM SHEET (< lg) */}
      <EditorialModalShell
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        ariaLabel="Menu Tapioca Pay"
        variant="sheet"
        containerClassName="lg:hidden flex items-end justify-center"
      >
        <div className="w-full bg-[#F7F8F7] dark:bg-[#090C0B] rounded-t-3xl border-t border-[#E4E7E5] dark:border-[#1B231F] px-5 pt-3 pb-7 pb-safe max-h-[85vh] overflow-y-auto shadow-2xl space-y-5">
            <div className="w-10 h-1 rounded-full bg-[#CFD5D1] dark:bg-[#27332D] mx-auto" />

            {/* Sheet Header: Couple summary + close */}
            <div className="flex items-center justify-between gap-3 pb-3.5 border-b border-[#E4E7E5] dark:border-[#1B231F]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex -space-x-2 shrink-0">
                  <span className="w-9 h-9 rounded-full bg-[#0B130F] text-[#8CE02C] text-xs font-bold flex items-center justify-center ring-2 ring-[#F7F8F7] dark:ring-[#090C0B] font-editorial">
                    AL
                  </span>
                  <span className="w-9 h-9 rounded-full bg-[#D97706] text-white text-xs font-bold flex items-center justify-center ring-2 ring-[#F7F8F7] dark:ring-[#090C0B] font-editorial">
                    LF
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[#0B110E] dark:text-[#F3F5F4] truncate">
                    {profile.displayName.split(' ')[0]} &amp; {profile.partnerName.split(' ')[0]}
                  </div>
                  <div className="text-xs text-[#5C6660] dark:text-[#8C9891] truncate">
                    Namorada · {connectedPluggyCount}/2 Pluggy conectado
                  </div>
                </div>
              </div>
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setMobileMenuOpen(false)}
                className="w-10 h-10 rounded-xl bg-[#ECEFEE] dark:bg-[#141C17] text-[#5C6660] dark:text-[#8C9891] flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Month Selector + Theme Toggle Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-[#0D1210] border border-[#E4E7E5] dark:border-[#1B231F]">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => setMonthIdx((prev) => Math.max(0, prev - 1))}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#0B110E] dark:text-[#F3F5F4]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-editorial font-bold text-sm text-[#0B110E] dark:text-[#F3F5F4]">
                  {MONTHS[monthIdx]}
                </span>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => setMonthIdx((prev) => Math.min(MONTHS.length - 1, prev + 1))}
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-[#0B110E] dark:text-[#F3F5F4]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-[#0D1210] border border-[#E4E7E5] dark:border-[#1B231F]">
                <span className="text-xs font-medium text-[#5C6660] dark:text-[#8C9891] flex items-center gap-1.5">
                  {darkMode ? (
                    <Moon className="w-3.5 h-3.5 text-[#8CE02C]" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-[#D97706]" />
                  )}
                  <span>Tema</span>
                </span>
                <div className="flex items-center bg-[#F1F3F2] dark:bg-[#141C17] p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setDarkMode(false)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      !darkMode ? 'bg-white text-[#0B110E]' : 'text-[#5C6660]'
                    }`}
                  >
                    Claro
                  </button>
                  <button
                    type="button"
                    onClick={() => setDarkMode(true)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                      darkMode ? 'bg-[#19221D] text-[#F3F5F4]' : 'text-[#5C6660]'
                    }`}
                  >
                    Escuro
                  </button>
                </div>
              </div>
            </div>

            {/* Casal & Ajustes Routes */}
            <div>
              <div className="px-1 text-xs font-semibold text-[#5C6660] dark:text-[#8C9891] mb-2">
                Casal &amp; Ajustes
              </div>
              <ul className="space-y-1.5">
                {navSettingsItems.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => navigateTo(item.id)}
                        className={`w-full min-h-[48px] px-3.5 py-3 rounded-xl text-sm flex items-center justify-between transition-colors ${
                          isActive
                            ? 'bg-[#0B130F] dark:bg-[#19221D] text-white font-semibold'
                            : 'bg-white dark:bg-[#0D1210] border border-[#E4E7E5] dark:border-[#1B231F] text-[#0B110E] dark:text-[#F3F5F4]'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={
                              isActive
                                ? 'text-[#8CE02C]'
                                : 'text-[#5C6660] dark:text-[#8C9891]'
                            }
                          >
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </span>
                        <ChevronRight className="w-4 h-4 opacity-50" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Actions: Busca + Copiloto AI + Google */}
            <div className="space-y-2.5 pt-2 border-t border-[#E4E7E5] dark:border-[#1B231F]">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsCommandPaletteOpen(true);
                }}
                className="w-full min-h-[46px] px-4 rounded-xl bg-white dark:bg-[#0D1210] border border-[#E4E7E5] dark:border-[#1B231F] text-[#0B110E] dark:text-[#F3F5F4] text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Search className="w-4 h-4 text-[#56AD17] dark:text-[#8CE02C]" />
                <span>Busca Rápida &amp; Atalhos</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsVoiceStudioOpen(true);
                }}
                className="w-full min-h-[48px] px-4 rounded-xl bg-[#0B130F] dark:bg-[#8CE02C] text-white dark:text-[#060807] text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Bot className="w-4 h-4 text-[#8CE02C] dark:text-[#060807]" />
                <span>Copiloto Tapioca AI (Chat &amp; Voz)</span>
              </button>

              {!isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] text-sm font-medium text-[#0B110E] dark:text-[#F3F5F4]"
                >
                  Conectar Google Workspace
                </button>
              ) : (
                <button
                  type="button"
                  onClick={logout}
                  className="w-full min-h-[48px] px-4 rounded-xl border border-[#8CE02C]/40 text-sm font-medium text-[#0B110E] dark:text-[#8CE02C]"
                >
                  {userEmail?.split('@')[0]} · Sair
                </button>
              )}
            </div>
          </div>
      </EditorialModalShell>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 min-w-0 pb-24 lg:pb-10 px-4 sm:px-6 lg:px-9 pt-3 lg:pt-5 space-y-6 max-w-[1440px] mx-auto w-full">
        {/* COMPACT MOBILE TOP HEADER (< lg, strictly 48px height, frosted hairline) */}
        <header className="flex lg:hidden items-center justify-between gap-2 h-12 bg-white/90 dark:bg-[#0D1210]/90 backdrop-blur-md rounded-xl border border-[#E4E7E5] dark:border-[#1B231F] px-2.5 relative">
          <button
            type="button"
            onClick={() => navigateTo('overview')}
            className="flex items-center gap-2 min-w-0 text-left"
          >
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-[#0B130F] shrink-0">
              <img
                src="/assets/aistudio/2_326139fa.png"
                alt="Tapioca Pay"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0">
              <div className="font-editorial text-sm font-bold text-[#0B110E] dark:text-[#F3F5F4] leading-tight truncate">
                Tapioca <span className="font-accent-serif text-[#56AD17] dark:text-[#8CE02C]">pay</span>
              </div>
              <div className="text-[10px] text-[#5C6660] dark:text-[#8C9891] truncate leading-tight">
                {SECTION_TITLES[activeSection]} · {MONTHS[monthIdx].split(' ')[0]}
              </div>
            </div>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Abrir Copiloto Tapioca AI"
              onClick={() => setIsVoiceStudioOpen(true)}
              className="w-9 h-9 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-[#F1F3F2] dark:bg-[#141C17] flex items-center justify-center text-[#0B110E] dark:text-[#8CE02C]"
            >
              <Bot className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Abrir alertas"
              onClick={() => setShowNotificationsPopover((prev) => !prev)}
              className="w-9 h-9 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] flex items-center justify-center text-[#3D4741] dark:text-[#D5E0D9] relative"
            >
              <Bell className="w-4 h-4" />
              {budgetAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#D97706] text-white text-[9px] font-bold px-1.5 rounded-full leading-tight">
                  {budgetAlerts.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setAddBillDefaultCat('house');
                setIsAddBillOpen(true);
              }}
              className="min-h-[36px] px-3 rounded-lg bg-[#0B130F] dark:bg-[#8CE02C] text-[#F3F5F4] dark:text-[#060807] text-xs font-semibold flex items-center gap-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 text-[#8CE02C] dark:text-[#060807]" />
              <span>Novo</span>
            </button>
          </div>

          {showNotificationsPopover && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white dark:bg-[#0D1210] rounded-2xl border border-[#E4E7E5] dark:border-[#1B231F] shadow-xl p-4 z-40 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-editorial font-bold text-sm text-[#0B110E] dark:text-white">
                  Alertas Open Finance
                </span>
                <button
                  type="button"
                  onClick={() => setShowNotificationsPopover(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5C6660] hover:text-[#0B110E]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {budgetAlerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-2.5 rounded-xl bg-[#FEF7EC] dark:bg-[#1E1A11] border border-[#F3D9B1] dark:border-[#3A2F1C]"
                  >
                    <div className="font-bold text-[#9A5B13] dark:text-[#F1B74A]">
                      {al.category}
                    </div>
                    <div className="text-[11px] text-[#5C6660] dark:text-[#B8AE9E] mt-0.5 tabular-nums">
                      Realizado R$ {formatBRL(al.currentSpent)} · Meta R$ {formatBRL(al.limitAmount)}
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNotificationsPopover(false);
                  navigateTo('cashflow');
                }}
                className="w-full min-h-[40px] py-2 text-center font-semibold text-[#0B110E] dark:text-[#8CE02C] bg-[#F1F3F2] dark:bg-[#141C17] rounded-xl"
              >
                Ver Relatório de Custos →
              </button>
            </div>
          )}
        </header>

        {/* ARCHITECTURAL DESKTOP TOP BAR (lg+) — Crisp 3-Zone Contract */}
        <header className="hidden lg:flex items-center justify-between gap-8 h-14 pb-3 border-b border-[#E4E7E5] dark:border-[#1B231F]">
          {/* Zone 1: Active Section + Month Switcher + Unboxed Metadata */}
          <div className="flex items-center gap-3.5 whitespace-nowrap shrink-0">
            <span className="font-editorial text-xl font-bold text-[#0B110E] dark:text-[#F3F5F4]">
              {SECTION_TITLES[activeSection]}
            </span>

            <span className="text-[#D4D8D5] dark:text-[#27332D]" aria-hidden="true">
              /
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => setMonthIdx((prev) => Math.max(0, prev - 1))}
                className="p-1.5 text-[#5C6660] hover:text-[#0B110E] dark:hover:text-white hover:bg-[#ECEFEE] dark:hover:bg-[#141C17] rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMonthIdx(1)}
                className="flex items-baseline gap-1.5 px-1 cursor-pointer"
              >
                <span className="font-editorial text-[15px] font-bold text-[#0B110E] dark:text-[#F3F5F4] tracking-tight">
                  {MONTHS[monthIdx].split(' ')[0]}
                </span>
                <span className="font-accent-serif text-sm text-[#56AD17] dark:text-[#8CE02C]">
                  {MONTHS[monthIdx].split(' ')[1]}
                </span>
              </button>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => setMonthIdx((prev) => Math.min(MONTHS.length - 1, prev + 1))}
                className="p-1.5 text-[#5C6660] hover:text-[#0B110E] dark:hover:text-white hover:bg-[#ECEFEE] dark:hover:bg-[#141C17] rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <span className="text-xs text-[#5C6660] dark:text-[#8C9891] pl-3 border-l border-[#E4E7E5] dark:border-[#1B231F] tabular-nums">
              {connectedPluggyCount}/2 Pluggy · {transactions.length} lançamentos
            </span>
          </div>

          {/* Zone 2 & 3: Search + Copilot + Alerts + Primary Action */}
          <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              aria-label="Abrir busca rápida e atalhos"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D1210] border border-[#E4E7E5] dark:border-[#1B231F] text-[#5C6660] dark:text-[#8C9891] hover:border-[#0B110E]/25 text-xs font-medium transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Buscar</span>
              <kbd className="font-code text-[10px] px-1 py-0.2 rounded bg-[#F1F3F2] dark:bg-[#141C17] text-[#0B110E] dark:text-[#D5E0D9]">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setIsVoiceStudioOpen(true)}
              aria-label="Abrir Copiloto Tapioca AI"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D1210] text-[#0B110E] dark:text-[#F3F5F4] hover:border-[#56AD17] border border-[#E4E7E5] dark:border-[#1B231F] text-xs font-semibold transition-colors cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 text-[#56AD17] dark:text-[#8CE02C]" />
              <span>Copiloto AI</span>
            </button>

            {!isAuthenticated ? (
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E4E7E5] dark:border-[#1B231F] bg-white dark:bg-[#0D1210] text-xs font-medium text-[#3D4741] dark:text-[#D5E0D9] hover:border-[#0B110E]/25 transition-colors cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
                <span>Google</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#8CE02C]/40 bg-[#8CE02C]/10 text-xs font-medium text-[#0B110E] dark:text-[#8CE02C] cursor-pointer"
              >
                <span>{userEmail?.split('@')[0]} · Sair</span>
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                aria-label="Abrir alertas de despesas"
                onClick={() => setShowNotificationsPopover((prev) => !prev)}
                className="w-8 h-8 rounded-lg bg-white dark:bg-[#0D1210] border border-[#E4E7E5] dark:border-[#1B231F] flex items-center justify-center text-[#3D4741] dark:text-[#D5E0D9] hover:border-[#0B110E]/25 transition-colors relative cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {budgetAlerts.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#D97706] text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-tight">
                    {budgetAlerts.length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotificationsPopover && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { duration: 0.24, ease: EDITORIAL_EASE },
                    }}
                    exit={{
                      opacity: 0,
                      y: -6,
                      scale: 0.98,
                      transition: { duration: 0.16, ease: EDITORIAL_EXIT_EASE },
                    }}
                    className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#0D1210] rounded-2xl border border-[#E4E7E5] dark:border-[#1B231F] shadow-xl p-4 z-40 space-y-3 text-xs whitespace-normal origin-top-right"
                  >
                  <div className="flex items-center justify-between">
                    <span className="font-editorial font-bold text-sm text-[#0B110E] dark:text-white">
                      Alertas Open Finance
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNotificationsPopover(false)}
                      className="text-[#5C6660] hover:text-[#0B110E] dark:hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {budgetAlerts.map((al) => (
                      <div
                        key={al.id}
                        className="p-2.5 rounded-xl bg-[#FEF7EC] dark:bg-[#1E1A11] border border-[#F3D9B1] dark:border-[#3A2F1C]"
                      >
                        <div className="font-bold text-[#9A5B13] dark:text-[#F1B74A]">
                          {al.category}
                        </div>
                        <div className="text-[11px] text-[#5C6660] dark:text-[#B8AE9E] mt-0.5 tabular-nums">
                          Realizado R$ {formatBRL(al.currentSpent)} · Meta R${' '}
                          {formatBRL(al.limitAmount)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNotificationsPopover(false);
                      navigateTo('cashflow');
                    }}
                    className="w-full py-1.5 text-center font-semibold text-[#56AD17] dark:text-[#8CE02C] hover:underline cursor-pointer"
                  >
                    Ver Relatório de Custos →
                  </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <ShimmerActionButton
              type="button"
              variant="forest"
              onClick={() => {
                setAddBillDefaultCat('house');
                setIsAddBillOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5 text-[#8CE02C] dark:text-[#060807] stroke-[2.5]" />
              <span>Novo lançamento</span>
            </ShimmerActionButton>
          </div>
        </header>

        {/* PUSH NOTIFICATION BANNER */}
        <AnimatePresence>
          {pushBanner && (
            <motion.div
              role="status"
              initial={{ opacity: 0, y: -10, scale: 0.99 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                transition: { duration: 0.28, ease: EDITORIAL_EASE },
              }}
              exit={{
                opacity: 0,
                y: -8,
                scale: 0.99,
                transition: { duration: 0.18, ease: EDITORIAL_EXIT_EASE },
              }}
              className="bg-[#0B130F] text-[#F3F5F4] rounded-xl p-4 flex items-center justify-between gap-4 shadow-md border border-[#1E2823]"
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-[#8CE02C] flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-[#060807]" />
                </span>
                <div>
                  <div className="text-xs font-bold">{pushBanner.title}</div>
                  <div className="text-[11px] text-[#A2B0A8] mt-0.5">{pushBanner.body}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPushBanner(null)}
                aria-label="Dispensar notificação"
                className="text-[#8C9891] hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* MAIN VIEW SWITCHER */}
        <main>
          <SlideViewTransition viewKey={activeSection}>
            {activeSection === 'overview' && (
              <OverviewView
                profile={profile}
                pluggyConnections={pluggyConnections}
                bills={bills}
                creditCards={creditCards}
                transactions={transactions}
                savingsGoals={savingsGoals}
                onToggleBillPaid={handleToggleBillPaid}
                onSettlePix={handleSettlePix}
                onEditSalaryClick={() => navigateTo('income')}
                onOpenInvoiceModal={(card) => setSelectedCardForInvoice(card)}
                onOpenAddBillModal={(cat) => {
                  setAddBillDefaultCat(cat || 'house');
                  setIsAddBillOpen(true);
                }}
                onNavigateToCards={() => navigateTo('cards')}
                onNavigateSection={(sec) => navigateTo(sec)}
                onQuickSyncPluggy={handleQuickSyncAllPluggy}
                onOpenCopilot={() => setIsVoiceStudioOpen(true)}
              />
            )}

            {activeSection === 'cashflow' && (
              <CashFlowReportsView
                profile={profile}
                bills={bills}
                transactions={transactions}
                budgetAlerts={budgetAlerts}
                onApplySavingsSuggestion={handleApplySavingsSuggestion}
                onTriggerPushNotification={triggerPushNotification}
              />
            )}

            {activeSection === 'cards' && (
              <CardsPluggyView
                profile={profile}
                pluggyConnections={pluggyConnections}
                creditCards={creditCards}
                transactions={transactions}
                onSyncPluggyInstitution={handleSyncPluggyInstitution}
                onDisconnectSlot={handleDisconnectPluggySlot}
                onOpenInvoiceModal={(card) => setSelectedCardForInvoice(card)}
                onRefreshWorkspace={fetchWorkspace}
                clientUserId={userEmail || 'alanpires.contato@gmail.com'}
              />
            )}

            {activeSection === 'house' && (
              <IncomeAndHouseSettingsView
                profile={profile}
                bills={bills}
                mode="house_bills"
                onUpdateProfile={handleUpdateProfile}
                onToggleBillPaid={handleToggleBillPaid}
                onSettlePix={handleSettlePix}
                onDeleteBill={handleDeleteBill}
                onOpenAddBillModal={(cat) => {
                  setAddBillDefaultCat(cat || 'house');
                  setIsAddBillOpen(true);
                }}
              />
            )}

            {activeSection === 'savings' && (
              <SavingsGoalsView
                goals={savingsGoals}
                onCreateGoal={handleCreateGoal}
                onContributeGoal={handleContributeGoal}
              />
            )}

            {activeSection === 'income' && (
              <IncomeAndHouseSettingsView
                profile={profile}
                bills={bills}
                mode="income"
                onUpdateProfile={handleUpdateProfile}
                onToggleBillPaid={handleToggleBillPaid}
                onSettlePix={handleSettlePix}
                onDeleteBill={handleDeleteBill}
                onOpenAddBillModal={(cat) => {
                  setAddBillDefaultCat(cat || 'house');
                  setIsAddBillOpen(true);
                }}
              />
            )}

            {activeSection === 'workspace' && (
              <WorkspaceHubView
                profile={profile}
                bills={bills}
                isAuthenticated={isAuthenticated}
                onRequestGoogleSignIn={handleGoogleLogin}
              />
            )}
          </SlideViewTransition>
        </main>
      </div>

      {/* MOBILE BOTTOM TAB BAR (< lg) — 5 ergonomic destinations with shared spring top laser */}
      <nav
        aria-label="Navegação rápida mobile"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-[58px] pb-safe bg-[#F7F8F7]/92 dark:bg-[#090C0B]/92 backdrop-blur-xl border-t border-[#E4E7E5] dark:border-[#1B231F] grid grid-cols-5 items-center px-1"
      >
        {(
          [
            { id: 'overview', label: 'Resumo', icon: <LayoutGrid className="w-4 h-4" /> },
            { id: 'cards', label: 'Pluggy', icon: <CreditCard className="w-4 h-4" /> },
            { id: 'cashflow', label: 'Fluxo', icon: <ArrowLeftRight className="w-4 h-4" /> },
            { id: 'savings', label: 'Reserva', icon: <PiggyBank className="w-4 h-4" /> },
          ] as const
        ).map((tab) => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTo(tab.id)}
              className={`relative h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-[#0B110E] dark:text-[#8CE02C] font-bold'
                  : 'text-[#5C6660] dark:text-[#8C9891]'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-tab-indicator"
                  transition={{ type: 'spring', stiffness: 440, damping: 34 }}
                  className="absolute top-0 w-7 h-0.5 rounded-full bg-[#56AD17] dark:bg-[#8CE02C]"
                />
              )}
              {tab.id === 'cards' ? (
                <div className="relative">
                  {tab.icon}
                  <span className="absolute -top-1 -right-2.5 text-[9px] font-mono-num font-bold text-[#56AD17] dark:text-[#8CE02C]">
                    {connectedPluggyCount}/2
                  </span>
                </div>
              ) : (
                tab.icon
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className={`relative h-full min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors ${
            ['house', 'income', 'workspace'].includes(activeSection)
              ? 'text-[#0B110E] dark:text-[#8CE02C] font-bold'
              : 'text-[#5C6660] dark:text-[#8C9891]'
          }`}
        >
          {['house', 'income', 'workspace'].includes(activeSection) && (
            <motion.span
              layoutId="mobile-tab-indicator"
              transition={{ type: 'spring', stiffness: 440, damping: 34 }}
              className="absolute top-0 w-7 h-0.5 rounded-full bg-[#56AD17] dark:bg-[#8CE02C]"
            />
          )}
          <SlidersHorizontal className="w-4 h-4" />
          <span>Mais</span>
        </button>
      </nav>

      {/* MODALS */}
      <AddBillModal
        isOpen={isAddBillOpen}
        defaultCategory={addBillDefaultCat}
        partnerName={profile.partnerName}
        onClose={() => setIsAddBillOpen(false)}
        onCreateBill={handleCreateBill}
      />

      <InvoiceModal
        card={selectedCardForInvoice}
        transactions={transactions}
        onClose={() => setSelectedCardForInvoice(null)}
      />

      <VoiceAssistantWidget
        isOpen={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
        profile={profile}
        bills={bills}
        onWorkspaceMutated={fetchWorkspace}
        onNavigateSection={navigateTo}
      />

      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        bills={bills}
        transactions={transactions}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode((prev) => !prev)}
        onNavigate={navigateTo}
        onOpenNewBill={() => {
          setAddBillDefaultCat('house');
          setIsAddBillOpen(true);
        }}
        onOpenCopilot={() => setIsVoiceStudioOpen(true)}
        onQuickSyncPluggy={handleQuickSyncAllPluggy}
      />
      </div>
    </MotionConfig>
  );
}
