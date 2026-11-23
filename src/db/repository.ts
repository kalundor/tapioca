import { eq, and, asc, desc } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { db } from './index.ts';
import {
  users,
  bills,
  creditCards,
  savingsGoals,
  transactions,
  budgetAlerts,
} from './schema.ts';
import { getOrCreateUser } from './users.ts';

export const DEFAULT_DEMO_UID = 'duo-finn-default-workspace';

const FALLBACK_STORE_PATH = path.join(process.cwd(), '.cloudsql-mirror.json');

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

interface MirrorWorkspaceState {
  profile: {
    uid: string;
    email: string;
    displayName: string;
    partnerName: string;
    userSalary: number;
    partnerSalary: number;
    dayToDayBudget: number;
    pixSettled: boolean;
  };
  pluggyConnections: PluggyConnectionSlot[];
  bills: Array<{
    id: number;
    title: string;
    amount: number;
    dueDay: number;
    category: 'house' | 'personal' | 'card' | 'savings' | 'family';
    isHousingCost: boolean;
    paidBy: 'user' | 'partner';
    isShared: boolean;
    isPaid: boolean;
    monthKey: string;
    iconType: string;
  }>;
  creditCards: Array<{
    id: number;
    name: string;
    brand: string;
    tier: string;
    status: string;
    dueDate: string;
    currentInvoice: number;
    availableLimit: number;
    nextJanInvoice: number;
    nextFebInvoice: number;
    colorTheme: string;
    pluggyItemId: string | null;
    owner?: 'user' | 'partner';
  }>;
  savingsGoals: Array<{
    id: number;
    title: string;
    category: string;
    currentAmount: number;
    targetAmount: number;
    monthlyContribution: number;
    deadline: string;
  }>;
  transactions: Array<{
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
  }>;
  budgetAlerts: Array<{
    id: number;
    category: string;
    limitAmount: number;
    currentSpent: number;
    isRead: boolean;
    pushEnabled: boolean;
  }>;
}

function createDefaultMirrorState(uid: string, email: string): MirrorWorkspaceState {
  const effectiveEmail = email || 'alanpires.contato@gmail.com';
  const effectiveDisplayName = 'Alan Pires';

  return {
    profile: {
      uid,
      email: effectiveEmail,
      displayName: effectiveDisplayName,
      partnerName: 'Larissa Ferraz',
      userSalary: 1588.58,
      partnerSalary: 1251.69,
      dayToDayBudget: 140.0,
      pixSettled: false,
    },
    pluggyConnections: [
      {
        slot: 'user',
        ownerName: effectiveDisplayName,
        roleLabel: 'Titular',
        itemId: '7982b3e3-d73a-49f1-bc68-dbf48c8e55a6',
        institutionName: 'Nubank & Open Finance · Alan',
        status: 'connected',
        lastSyncAt: '2026-11-16T06:00:00.000Z',
        accountsCount: 3,
        transactionsCount: 6,
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
    ],
    bills: [
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
    ],
    creditCards: [
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
        tier: 'CONTA CORRENTE OPEN FINANCE',
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
    ],
    savingsGoals: [
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
    ],
    transactions: [
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
      {
        id: 6,
        description: 'Estrela Cafe',
        merchant: 'Nubank',
        amount: 116.05,
        category: 'Eating out',
        date: '2026-10-20',
        accountName: 'Nubank (GOLD)',
        source: 'pluggy_live',
        isRecurring: false,
        owner: 'user',
      },
    ],
    budgetAlerts: [
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
    ],
  };
}

function loadMirrorStore(uid: string, email: string): MirrorWorkspaceState {
  const defaults = createDefaultMirrorState(uid, email);
  try {
    if (fs.existsSync(FALLBACK_STORE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(FALLBACK_STORE_PATH, 'utf-8'));
      if (raw && raw[uid]) {
        const stored: MirrorWorkspaceState = raw[uid];
        let mutated = false;

        // Clean up any legacy fake demo profile values (28000 / Esposa)
        if (stored.profile.userSalary === 28000 || stored.profile.partnerName === 'Esposa') {
          stored.profile = {
            ...stored.profile,
            displayName: 'Alan Pires',
            partnerName: 'Larissa Ferraz',
            userSalary: 1588.58,
            partnerSalary: 1251.69,
            dayToDayBudget: 140.0,
          };
          mutated = true;
        }

        // Clean up legacy fake demo bills (Aluguel 4800, Vila Olímpia, Santander Unique)
        const hasLegacyFakeBills = stored.bills.some(
          (b) =>
            b.title.includes('Vila Olímpia') ||
            b.title.includes('Santander Unique') ||
            (b.title === 'Aluguel' && b.amount === 4800)
        );
        if (hasLegacyFakeBills || stored.bills.length === 0) {
          stored.bills = defaults.bills;
          mutated = true;
        }

        // Clean up legacy fake savings goals (142000, Vila Olímpia, Japão)
        const hasLegacyFakeGoals = stored.savingsGoals.some(
          (g) =>
            g.title.includes('Vila Olímpia') ||
            g.title.includes('Japão') ||
            g.currentAmount === 142000
        );
        if (hasLegacyFakeGoals || stored.savingsGoals.length === 0) {
          stored.savingsGoals = defaults.savingsGoals;
          mutated = true;
        }

        // Ensure creditCards put active Mastercard Gold cards (Nubank & Inter) first
        if (stored.creditCards.length > 0) {
          stored.creditCards.sort((a, b) => b.currentInvoice - a.currentInvoice);
          stored.creditCards = stored.creditCards.map((c) => {
            if (c.name.toLowerCase().includes('inter') && c.availableLimit === 0) {
              return { ...c, availableLimit: 514.89, dueDate: '15/11' };
            }
            if (c.name.toLowerCase().includes('santander') && c.currentInvoice === 0) {
              return {
                ...c,
                currentInvoice: 241.05,
                availableLimit: 621.45,
                dueDate: '10/11',
                tier: 'CONTA CORRENTE & PIX',
              };
            }
            return c;
          });
          mutated = true;
        } else {
          stored.creditCards = defaults.creditCards;
          mutated = true;
        }

        // Clean up legacy fake budget alerts
        const hasLegacyAlerts = stored.budgetAlerts.some((a) =>
          a.category.includes('Santander Unique')
        );
        if (hasLegacyAlerts || stored.budgetAlerts.length === 0) {
          stored.budgetAlerts = defaults.budgetAlerts;
          mutated = true;
        }

        // Ensure owner field exists on cards and transactions & remove synthetic sync rows
        const beforeCleanCount = stored.transactions.length;
        stored.transactions = stored.transactions
          .filter(
            (t) =>
              !(
                t.source === 'pluggy' &&
                t.description.startsWith('Sincronização Open Finance —')
              )
          )
          .map((t) => ({
            ...t,
            owner: t.owner || 'user',
          }));
        if (stored.transactions.length !== beforeCleanCount) {
          mutated = true;
        }

        stored.creditCards = stored.creditCards.map((c) => ({
          ...c,
          owner: c.owner || 'user',
        }));

        // Ensure 2-slot Pluggy connections exist & reconcile with live persisted counts
        if (!Array.isArray(stored.pluggyConnections) || stored.pluggyConnections.length !== 2) {
          stored.pluggyConnections = defaults.pluggyConnections;
          mutated = true;
        }
        stored.pluggyConnections = stored.pluggyConnections.map((conn) => {
          const slotTxCount = stored.transactions.filter(
            (t) => (t.owner || 'user') === conn.slot
          ).length;
          const slotCardCount = stored.creditCards.filter(
            (c) => (c.owner || 'user') === conn.slot
          ).length;
          const nextTxCount = conn.status === 'connected' ? slotTxCount : 0;
          const nextAccCount =
            conn.status === 'connected'
              ? Math.max(conn.accountsCount || 0, slotCardCount)
              : 0;
          if (conn.transactionsCount !== nextTxCount || conn.accountsCount !== nextAccCount) {
            mutated = true;
          }
          return {
            ...conn,
            ownerName:
              conn.slot === 'partner'
                ? stored.profile.partnerName || 'Larissa Ferraz'
                : stored.profile.displayName || 'Alan Pires',
            roleLabel: conn.slot === 'partner' ? 'Namorada' : 'Titular',
            transactionsCount: nextTxCount,
            accountsCount: nextAccCount,
          };
        });

        if (mutated) {
          saveMirrorStore(uid, stored);
        }
        return stored;
      }
    }
  } catch {
    // Ignore read errors
  }
  saveMirrorStore(uid, defaults);
  return defaults;
}

function saveMirrorStore(uid: string, state: MirrorWorkspaceState): void {
  try {
    let all: Record<string, MirrorWorkspaceState> = {};
    if (fs.existsSync(FALLBACK_STORE_PATH)) {
      all = JSON.parse(fs.readFileSync(FALLBACK_STORE_PATH, 'utf-8')) || {};
    }
    all[uid] = state;
    fs.writeFileSync(FALLBACK_STORE_PATH, JSON.stringify(all, null, 2), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

function isCloudSqlSocketAvailable(): boolean {
  const host = process.env.SQL_HOST;
  if (!host) return false;
  if (host.startsWith('/')) {
    return fs.existsSync(path.join(host, '.s.PGSQL.5432'));
  }
  return true;
}

export async function ensureUserWorkspaceSeeded(uid: string, email: string, displayName?: string) {
  const userRecord = await getOrCreateUser(uid, email, displayName);
  const defaults = createDefaultMirrorState(uid, email);

  const existingBills = await db.select().from(bills).where(eq(bills.userUid, uid));
  if (existingBills.length === 0) {
    await db.insert(bills).values(
      defaults.bills.map((b) => ({
        userUid: uid,
        title: b.title,
        amount: b.amount.toFixed(2),
        dueDay: b.dueDay,
        category: b.category,
        isHousingCost: b.isHousingCost,
        paidBy: b.paidBy,
        isShared: b.isShared,
        isPaid: b.isPaid,
        monthKey: b.monthKey,
        iconType: b.iconType,
      }))
    );
  }

  const existingCards = await db.select().from(creditCards).where(eq(creditCards.userUid, uid));
  if (existingCards.length === 0) {
    await db.insert(creditCards).values(
      defaults.creditCards.map((c) => ({
        userUid: uid,
        name: c.name,
        brand: c.brand,
        tier: c.tier,
        status: c.status,
        dueDate: c.dueDate,
        currentInvoice: c.currentInvoice.toFixed(2),
        availableLimit: c.availableLimit.toFixed(2),
        nextJanInvoice: c.nextJanInvoice.toFixed(2),
        nextFebInvoice: c.nextFebInvoice.toFixed(2),
        colorTheme: c.colorTheme,
        pluggyItemId: c.pluggyItemId,
      }))
    );
  }

  const existingGoals = await db.select().from(savingsGoals).where(eq(savingsGoals.userUid, uid));
  if (existingGoals.length === 0) {
    await db.insert(savingsGoals).values(
      defaults.savingsGoals.map((g) => ({
        userUid: uid,
        title: g.title,
        category: g.category,
        currentAmount: g.currentAmount.toFixed(2),
        targetAmount: g.targetAmount.toFixed(2),
        monthlyContribution: g.monthlyContribution.toFixed(2),
        deadline: g.deadline,
      }))
    );
  }

  const existingTx = await db.select().from(transactions).where(eq(transactions.userUid, uid));
  if (existingTx.length === 0) {
    await db.insert(transactions).values(
      defaults.transactions.map((t) => ({
        userUid: uid,
        description: t.description,
        merchant: t.merchant,
        amount: t.amount.toFixed(2),
        category: t.category,
        date: t.date,
        accountName: t.accountName,
        source: t.source,
        isRecurring: t.isRecurring,
      }))
    );
  }

  const existingAlerts = await db.select().from(budgetAlerts).where(eq(budgetAlerts.userUid, uid));
  if (existingAlerts.length === 0) {
    await db.insert(budgetAlerts).values(
      defaults.budgetAlerts.map((a) => ({
        userUid: uid,
        category: a.category,
        limitAmount: a.limitAmount.toFixed(2),
        currentSpent: a.currentSpent.toFixed(2),
        isRead: a.isRead,
        pushEnabled: a.pushEnabled,
      }))
    );
  }

  return userRecord;
}

export async function getFullWorkspaceData(uid: string, email: string) {
  if (!isCloudSqlSocketAvailable()) {
    return loadMirrorStore(uid, email);
  }

  try {
    const profile = await ensureUserWorkspaceSeeded(uid, email);
    const userBills = await db
      .select()
      .from(bills)
      .where(eq(bills.userUid, uid))
      .orderBy(asc(bills.dueDay), desc(bills.amount));
    const cards = await db
      .select()
      .from(creditCards)
      .where(eq(creditCards.userUid, uid))
      .orderBy(asc(creditCards.id));
    const goals = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userUid, uid))
      .orderBy(asc(savingsGoals.id));
    const txList = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userUid, uid))
      .orderBy(desc(transactions.date), desc(transactions.id));
    const alerts = await db
      .select()
      .from(budgetAlerts)
      .where(eq(budgetAlerts.userUid, uid))
      .orderBy(asc(budgetAlerts.id));

    const mirrorFallback = loadMirrorStore(uid, email);

    const result: MirrorWorkspaceState = {
      profile: {
        uid: profile.uid,
        email: profile.email,
        displayName: profile.displayName || 'Alan Pires',
        partnerName: profile.partnerName === 'Esposa' ? 'Larissa Ferraz' : profile.partnerName || 'Larissa Ferraz',
        userSalary: Number(profile.userSalary),
        partnerSalary: Number(profile.partnerSalary),
        dayToDayBudget: Number(profile.dayToDayBudget),
        pixSettled: Boolean(profile.pixSettled),
      },
      pluggyConnections: mirrorFallback.pluggyConnections,
      bills: userBills.map((b) => ({
        id: b.id,
        title: b.title,
        amount: Number(b.amount),
        dueDay: b.dueDay,
        category: b.category as 'house' | 'personal' | 'card' | 'savings' | 'family',
        isHousingCost: b.isHousingCost,
        paidBy: b.paidBy as 'user' | 'partner',
        isShared: b.isShared,
        isPaid: b.isPaid,
        monthKey: b.monthKey,
        iconType: b.iconType,
      })),
      creditCards: cards.map((c) => ({
        id: c.id,
        name: c.name,
        brand: c.brand,
        tier: c.tier,
        status: c.status,
        dueDate: c.dueDate,
        currentInvoice: Number(c.currentInvoice),
        availableLimit: Number(c.availableLimit),
        nextJanInvoice: Number(c.nextJanInvoice),
        nextFebInvoice: Number(c.nextFebInvoice),
        colorTheme: c.colorTheme,
        pluggyItemId: c.pluggyItemId,
      })),
      savingsGoals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        category: g.category,
        currentAmount: Number(g.currentAmount),
        targetAmount: Number(g.targetAmount),
        monthlyContribution: Number(g.monthlyContribution),
        deadline: g.deadline,
      })),
      transactions: txList.map((t) => ({
        id: t.id,
        description: t.description,
        merchant: t.merchant,
        amount: Number(t.amount),
        category: t.category,
        date: t.date,
        accountName: t.accountName,
        source: t.source,
        isRecurring: t.isRecurring,
      })),
      budgetAlerts: alerts.map((a) => ({
        id: a.id,
        category: a.category,
        limitAmount: Number(a.limitAmount),
        currentSpent: Number(a.currentSpent),
        isRead: a.isRead,
        pushEnabled: a.pushEnabled,
      })),
    };

    saveMirrorStore(uid, result);
    return result;
  } catch {
    return loadMirrorStore(uid, email);
  }
}

export async function createBillRecord(
  uid: string,
  payload: {
    title: string;
    amount: number;
    dueDay: number;
    category: string;
    isHousingCost: boolean;
    paidBy: string;
    isShared: boolean;
    iconType?: string;
  }
) {
  const mirror = loadMirrorStore(uid, 'casal@duofinn.com.br');
  const newBill = {
    id: Date.now(),
    title: payload.title,
    amount: Number(payload.amount),
    dueDay: payload.dueDay,
    category: (payload.category as 'house' | 'personal') || 'house',
    isHousingCost: payload.isHousingCost,
    paidBy: (payload.paidBy as 'user' | 'partner') || 'user',
    isShared: payload.isShared,
    isPaid: false,
    monthKey: '2026-12',
    iconType: payload.iconType || 'receipt',
  };
  mirror.bills.push(newBill);
  if (payload.amount >= 400) {
    mirror.budgetAlerts.push({
      id: Date.now() + 1,
      category: payload.title,
      limitAmount: Number((payload.amount * 0.85).toFixed(2)),
      currentSpent: Number(payload.amount),
      isRead: false,
      pushEnabled: true,
    });
  }
  saveMirrorStore(uid, mirror);

  if (!isCloudSqlSocketAvailable()) {
    return newBill;
  }

  try {
    const inserted = await db
      .insert(bills)
      .values({
        userUid: uid,
        title: payload.title,
        amount: String(payload.amount.toFixed(2)),
        dueDay: payload.dueDay,
        category: payload.category,
        isHousingCost: payload.isHousingCost,
        paidBy: payload.paidBy,
        isShared: payload.isShared,
        isPaid: false,
        monthKey: '2026-12',
        iconType: payload.iconType || 'receipt',
      })
      .returning();
    return inserted[0];
  } catch {
    return newBill;
  }
}

export async function toggleBillPaidStatus(uid: string, billId: number, isPaid: boolean) {
  const mirror = loadMirrorStore(uid, 'casal@duofinn.com.br');
  mirror.bills = mirror.bills.map((b) => (b.id === billId ? { ...b, isPaid } : b));
  saveMirrorStore(uid, mirror);
  const updatedLocal = mirror.bills.find((b) => b.id === billId);

  if (!isCloudSqlSocketAvailable()) {
    return updatedLocal;
  }

  try {
    const updated = await db
      .update(bills)
      .set({ isPaid })
      .where(and(eq(bills.id, billId), eq(bills.userUid, uid)))
      .returning();
    return updated[0] || updatedLocal;
  } catch {
    return updatedLocal;
  }
}

export async function deleteBillRecord(uid: string, billId: number) {
  const mirror = loadMirrorStore(uid, 'casal@duofinn.com.br');
  mirror.bills = mirror.bills.filter((b) => b.id !== billId);
  saveMirrorStore(uid, mirror);

  if (!isCloudSqlSocketAvailable()) {
    return { deleted: true };
  }

  try {
    await db.delete(bills).where(and(eq(bills.id, billId), eq(bills.userUid, uid)));
    return { deleted: true };
  } catch {
    return { deleted: true };
  }
}

export async function updateProfileSettings(
  uid: string,
  payload: {
    displayName?: string;
    partnerName?: string;
    userSalary?: number;
    partnerSalary?: number;
    dayToDayBudget?: number;
    pixSettled?: boolean;
  }
) {
  const mirror = loadMirrorStore(uid, 'casal@duofinn.com.br');
  if (payload.displayName !== undefined) mirror.profile.displayName = payload.displayName;
  if (payload.partnerName !== undefined) mirror.profile.partnerName = payload.partnerName;
  if (payload.userSalary !== undefined) mirror.profile.userSalary = Number(payload.userSalary);
  if (payload.partnerSalary !== undefined)
    mirror.profile.partnerSalary = Number(payload.partnerSalary);
  if (payload.dayToDayBudget !== undefined)
    mirror.profile.dayToDayBudget = Number(payload.dayToDayBudget);
  if (payload.pixSettled !== undefined) mirror.profile.pixSettled = Boolean(payload.pixSettled);
  saveMirrorStore(uid, mirror);

  if (!isCloudSqlSocketAvailable()) {
    return mirror.profile;
  }

  try {
    const updateFields: Record<string, unknown> = {};
    if (payload.displayName !== undefined) updateFields.displayName = payload.displayName;
    if (payload.partnerName !== undefined) updateFields.partnerName = payload.partnerName;
    if (payload.userSalary !== undefined)
      updateFields.userSalary = String(payload.userSalary.toFixed(2));
    if (payload.partnerSalary !== undefined)
      updateFields.partnerSalary = String(payload.partnerSalary.toFixed(2));
    if (payload.dayToDayBudget !== undefined)
      updateFields.dayToDayBudget = String(payload.dayToDayBudget.toFixed(2));
    if (payload.pixSettled !== undefined) updateFields.pixSettled = payload.pixSettled;

    const updated = await db
      .update(users)
      .set(updateFields)
      .where(eq(users.uid, uid))
      .returning();
    return updated[0] || mirror.profile;
  } catch {
    return mirror.profile;
  }
}

export async function createOrContributeSavingsGoal(
  uid: string,
  payload: {
    goalId?: number;
    contributionAmount?: number;
    title?: string;
    category?: string;
    targetAmount?: number;
    monthlyContribution?: number;
    deadline?: string;
  }
) {
  const mirror = loadMirrorStore(uid, 'casal@duofinn.com.br');
  if (payload.goalId && payload.contributionAmount !== undefined) {
    mirror.savingsGoals = mirror.savingsGoals.map((g) =>
      g.id === payload.goalId
        ? { ...g, currentAmount: g.currentAmount + Number(payload.contributionAmount) }
        : g
    );
    saveMirrorStore(uid, mirror);
    const updatedGoal = mirror.savingsGoals.find((g) => g.id === payload.goalId);
    if (!isCloudSqlSocketAvailable()) return updatedGoal;
    try {
      const existing = await db
        .select()
        .from(savingsGoals)
        .where(and(eq(savingsGoals.id, payload.goalId), eq(savingsGoals.userUid, uid)));
      if (existing[0]) {
        const nextAmount = Number(existing[0].currentAmount) + payload.contributionAmount;
        const updated = await db
          .update(savingsGoals)
          .set({ currentAmount: String(nextAmount.toFixed(2)) })
          .where(eq(savingsGoals.id, payload.goalId))
          .returning();
        return updated[0];
      }
    } catch {
      // Return mirror goal
    }
    return updatedGoal;
  }

  const createdLocal = {
    id: Date.now(),
    title: payload.title || 'Nova Meta de Economia',
    category: payload.category || 'Reserva Personalizada',
    currentAmount: 0,
    targetAmount: Number(payload.targetAmount || 10000),
    monthlyContribution: Number(payload.monthlyContribution || 500),
    deadline: payload.deadline || 'Dezembro 2027',
  };
  mirror.savingsGoals.push(createdLocal);
  saveMirrorStore(uid, mirror);

  if (!isCloudSqlSocketAvailable()) return createdLocal;

  try {
    const created = await db
      .insert(savingsGoals)
      .values({
        userUid: uid,
        title: createdLocal.title,
        category: createdLocal.category,
        currentAmount: '0.00',
        targetAmount: String(createdLocal.targetAmount.toFixed(2)),
        monthlyContribution: String(createdLocal.monthlyContribution.toFixed(2)),
        deadline: createdLocal.deadline,
      })
      .returning();
    return created[0];
  } catch {
    return createdLocal;
  }
}

export async function syncPluggyOpenFinance(
  uid: string,
  institutionName: string,
  slot: 'user' | 'partner' = 'user'
) {
  const mirror = loadMirrorStore(uid, 'alanpires.contato@gmail.com');
  const nowIso = new Date().toISOString();
  mirror.pluggyConnections = mirror.pluggyConnections.map((conn) =>
    conn.slot === slot || (conn.status === 'connected' && conn.institutionName === institutionName)
      ? {
          ...conn,
          lastSyncAt: nowIso,
          transactionsCount: mirror.transactions.filter(
            (t) => (t.owner || 'user') === conn.slot
          ).length,
        }
      : conn
  );
  saveMirrorStore(uid, mirror);
  return {
    syncedAt: nowIso,
    institutionName,
    transactionsCount: mirror.transactions.filter((t) => (t.owner || 'user') === slot).length,
  };
}

export async function saveRealPluggyItemData(
  uid: string,
  payload: {
    itemId: string;
    institutionName: string;
    owner?: 'user' | 'partner';
    replaceDemoData?: boolean;
    accounts: Array<{
      id: string;
      name: string;
      type: string;
      subtype?: string;
      balance: number;
      creditData?: {
        level?: string;
        brand?: string;
        balanceCloseDate?: string | null;
        balanceDueDate?: string | null;
        availableCreditLimit?: number | null;
        creditLimit?: number | null;
      } | null;
    }>;
    investments?: Array<{
      id: string;
      name: string;
      balance: number;
      type?: string;
      subtype?: string;
      rate?: number | null;
      rateType?: string | null;
      dueDate?: string | null;
      issuer?: string | null;
    }>;
    transactions: Array<{
      id: string;
      description: string;
      merchant?: string;
      amount: number;
      type?: string;
      category?: string;
      date: string;
      accountName: string;
    }>;
  }
) {
  const ownerSlot: 'user' | 'partner' = payload.owner === 'partner' ? 'partner' : 'user';
  const mirror = loadMirrorStore(uid, 'alanpires.contato@gmail.com');

  // Remove old fake demo cards/transactions as soon as real Pluggy items are synced
  mirror.creditCards = mirror.creditCards.filter(
    (c) =>
      c.pluggyItemId &&
      !['pluggy_santander_unique_01', 'pluggy_itau_pers_02', 'pluggy_nubank_uv_03'].includes(
        c.pluggyItemId
      )
  );
  mirror.transactions = mirror.transactions.filter((t) => t.source === 'pluggy_live');

  if (payload.replaceDemoData) {
    mirror.bills = mirror.bills.filter((b) => b.iconType === 'card_real');
    mirror.savingsGoals = mirror.savingsGoals.filter((g) => g.category.includes('Pluggy'));
    mirror.budgetAlerts = [];
  }

  let slotTotalBalance = 0;

  // Upsert credit cards (and bank accounts if no credit card on that item) from real Pluggy accounts
  for (const acc of payload.accounts) {
    const isCredit = acc.type === 'CREDIT' || Boolean(acc.creditData);
    slotTotalBalance += isCredit
      ? Number(acc.creditData?.availableCreditLimit ?? 0)
      : Number(acc.balance || 0);

    const displayCardName = isCredit
      ? `${payload.institutionName} (${acc.name.toUpperCase()})`
      : `${acc.name}`;

    if (isCredit || payload.accounts.length === 1) {
      const existingCardIdx = mirror.creditCards.findIndex(
        (c) =>
          c.name.toLowerCase() === displayCardName.toLowerCase() &&
          (c.owner || 'user') === ownerSlot
      );
      const dueStr = acc.creditData?.balanceDueDate
        ? new Date(acc.creditData.balanceDueDate).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            timeZone: 'UTC',
          })
        : isCredit
          ? '15/11'
          : 'Conta Corrente';

      const invoiceVal = Math.abs(Number(acc.balance) || 0);
      const availLimit = Number(
        acc.creditData?.availableCreditLimit !== undefined && acc.creditData?.availableCreditLimit !== null
          ? Math.max(0, acc.creditData.availableCreditLimit)
          : acc.creditData?.creditLimit ?? acc.balance ?? 0
      );

      const lowerInst = (payload.institutionName + ' ' + acc.name).toLowerCase();
      const colorTheme = lowerInst.includes('inter')
        ? 'orange'
        : lowerInst.includes('nu')
          ? 'purple'
          : 'dark';

      const cardEntry = {
        id:
          existingCardIdx >= 0
            ? mirror.creditCards[existingCardIdx].id
            : Date.now() + Math.floor(Math.random() * 1000),
        name: displayCardName,
        brand: (acc.creditData?.brand || payload.institutionName).toLowerCase(),
        tier: isCredit
          ? `${acc.creditData?.brand || 'MASTERCARD'} ${acc.creditData?.level || 'GOLD'}`.toUpperCase()
          : 'CONTA CORRENTE OPEN FINANCE',
        status: isCredit ? 'Aberta' : 'Ativa',
        dueDate: dueStr,
        currentInvoice: invoiceVal,
        availableLimit: availLimit,
        nextJanInvoice: Number((invoiceVal * 0.9).toFixed(2)),
        nextFebInvoice: Number((invoiceVal * 0.85).toFixed(2)),
        colorTheme,
        pluggyItemId: payload.itemId,
        owner: ownerSlot,
      };

      if (existingCardIdx >= 0) {
        mirror.creditCards[existingCardIdx] = cardEntry;
      } else {
        mirror.creditCards.push(cardEntry);
      }

      // Sync credit card invoice as a real bill in bills list
      if (isCredit && invoiceVal > 0) {
        const billTitle = `Fatura ${displayCardName}`;
        const existingBillIdx = mirror.bills.findIndex(
          (b) => b.title.toLowerCase() === billTitle.toLowerCase() && b.paidBy === ownerSlot
        );
        const dueDayNum = acc.creditData?.balanceDueDate
          ? new Date(acc.creditData.balanceDueDate).getUTCDate() || 16
          : 10;
        const billEntry = {
          id:
            existingBillIdx >= 0
              ? mirror.bills[existingBillIdx].id
              : Date.now() + Math.floor(Math.random() * 1000),
          title: billTitle,
          amount: invoiceVal,
          dueDay: dueDayNum,
          category: 'personal' as const,
          isHousingCost: false,
          paidBy: ownerSlot,
          isShared: false,
          isPaid: false,
          monthKey: '2026-11',
          iconType: 'card',
        };
        if (existingBillIdx >= 0) {
          mirror.bills[existingBillIdx] = billEntry;
        } else {
          mirror.bills.push(billEntry);
        }
      }
    }
  }

  // Sync real investments (CDBs / RDBs) into savingsGoals
  if (payload.investments && payload.investments.length > 0) {
    for (const inv of payload.investments) {
      slotTotalBalance += Number(inv.balance || 0);
      const invTitle = inv.name || `Investimento ${payload.institutionName}`;
      const existingGoalIdx = mirror.savingsGoals.findIndex(
        (g) => g.title.toLowerCase() === invTitle.toLowerCase()
      );
      const goalEntry = {
        id:
          existingGoalIdx >= 0
            ? mirror.savingsGoals[existingGoalIdx].id
            : Date.now() + Math.floor(Math.random() * 1000),
        title: invTitle,
        category: `Open Finance Pluggy · ${inv.subtype || inv.type || 'Renda Fixa'}${
          inv.rate ? ` (${inv.rate}% ${inv.rateType || 'CDI'})` : ''
        }`,
        currentAmount: Number(inv.balance || 0),
        targetAmount: Math.max(Number(inv.balance || 0) * 3, 1000),
        monthlyContribution: Number(inv.balance || 0),
        deadline: inv.dueDate
          ? new Date(inv.dueDate).toLocaleDateString('pt-BR', {
              month: 'short',
              year: 'numeric',
            })
          : 'Liquidez Diária',
      };
      if (existingGoalIdx >= 0) {
        mirror.savingsGoals[existingGoalIdx] = goalEntry;
      } else {
        mirror.savingsGoals.unshift(goalEntry);
      }
    }
  }

  // Upsert real transactions imported from Pluggy /v2/transactions (deduplicated)
  const existingKeys = new Set(
    mirror.transactions.map((t) => `${t.date}|${t.description}|${t.amount}|${t.accountName}|${t.owner || 'user'}`)
  );

  for (const tx of payload.transactions) {
    const cleanDate = tx.date ? tx.date.slice(0, 10) : new Date().toISOString().slice(0, 10);
    const amountAbs = Math.abs(Number(tx.amount) || 0);
    const key = `${cleanDate}|${tx.description}|${amountAbs}|${tx.accountName || payload.institutionName}|${ownerSlot}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);

    const txRecord = {
      id: Date.now() + Math.floor(Math.random() * 1000000),
      description: tx.description,
      merchant: tx.merchant || payload.institutionName,
      amount: amountAbs,
      category: tx.category || 'Open Finance Pluggy',
      date: cleanDate,
      accountName: tx.accountName || payload.institutionName,
      source: 'pluggy_live',
      isRecurring: false,
      owner: ownerSlot,
    };
    mirror.transactions.push(txRecord);
  }

  // Sort transactions newest first
  mirror.transactions.sort((a, b) => b.date.localeCompare(a.date));

  // Update corresponding 2-slot connection record (Alan Titular or Larissa Namorada)
  const slotTxCount = mirror.transactions.filter((t) => (t.owner || 'user') === ownerSlot).length;
  mirror.pluggyConnections = (mirror.pluggyConnections || []).map((conn) =>
    conn.slot === ownerSlot
      ? {
          ...conn,
          ownerName:
            ownerSlot === 'user'
              ? mirror.profile.displayName || 'Alan Pires'
              : mirror.profile.partnerName || 'Larissa Ferraz',
          roleLabel: ownerSlot === 'user' ? 'Titular' : 'Namorada',
          itemId: payload.itemId,
          institutionName: payload.institutionName,
          status: 'connected',
          lastSyncAt: new Date().toISOString(),
          accountsCount: payload.accounts.length,
          transactionsCount: slotTxCount,
          totalBalance: Number(slotTotalBalance.toFixed(2)),
        }
      : conn
  );

  saveMirrorStore(uid, mirror);
  return {
    importedAccounts: payload.accounts.length,
    importedInvestments: payload.investments?.length || 0,
    importedTransactions: payload.transactions.length,
    institutionName: payload.institutionName,
    owner: ownerSlot,
  };
}

export async function clearDemoWorkspaceData(uid: string, email: string) {
  const mirror = loadMirrorStore(uid, email || 'alanpires.contato@gmail.com');
  mirror.bills = [];
  mirror.creditCards = mirror.creditCards.filter(
    (c) =>
      c.pluggyItemId &&
      !['pluggy_santander_unique_01', 'pluggy_itau_pers_02', 'pluggy_nubank_uv_03'].includes(
        c.pluggyItemId
      )
  );
  mirror.savingsGoals = mirror.savingsGoals.filter((g) => g.category.includes('Pluggy'));
  mirror.transactions = mirror.transactions.filter((t) => t.source === 'pluggy_live');
  mirror.budgetAlerts = [];
  saveMirrorStore(uid, mirror);

  if (isCloudSqlSocketAvailable()) {
    try {
      await db.delete(bills).where(eq(bills.userUid, uid));
      await db.delete(creditCards).where(eq(creditCards.userUid, uid));
      await db.delete(savingsGoals).where(eq(savingsGoals.userUid, uid));
      await db.delete(transactions).where(eq(transactions.userUid, uid));
      await db.delete(budgetAlerts).where(eq(budgetAlerts.userUid, uid));
    } catch {
      // Fallback mirror already cleared
    }
  }

  return mirror;
}

export async function disconnectPluggySlot(
  uid: string,
  slot: 'user' | 'partner',
  email?: string
) {
  const mirror = loadMirrorStore(uid, email || 'alanpires.contato@gmail.com');
  const disconnectedConn = mirror.pluggyConnections.find((c) => c.slot === slot);
  const removedItemId = disconnectedConn?.itemId;

  mirror.pluggyConnections = mirror.pluggyConnections.map((conn) =>
    conn.slot === slot
      ? {
          ...conn,
          itemId: null,
          institutionName: 'Aguardando conexão Pluggy',
          status: 'pending',
          lastSyncAt: null,
          accountsCount: 0,
          transactionsCount: 0,
          totalBalance: 0,
        }
      : conn
  );

  mirror.creditCards = mirror.creditCards.filter(
    (c) => (c.owner || 'user') !== slot && (!removedItemId || c.pluggyItemId !== removedItemId)
  );
  mirror.transactions = mirror.transactions.filter((t) => (t.owner || 'user') !== slot);

  saveMirrorStore(uid, mirror);
  return mirror;
}
