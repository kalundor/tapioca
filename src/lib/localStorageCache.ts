import type { BillItem, CoupleProfile } from '../utils/financeMath';
import type { CreditCardRecord } from '../components/OverviewView';
import type {
  TransactionRecord,
  BudgetAlertRecord,
} from '../components/CashFlowReportsView';
import type { PluggyConnectionSlot } from '../components/CardsPluggyView';
import type { SavingsGoalRecord } from '../components/SavingsGoalsView';

export interface CachedWorkspacePayload {
  version: 1;
  updatedAt: string;
  profile: CoupleProfile;
  pluggyConnections: PluggyConnectionSlot[];
  bills: BillItem[];
  creditCards: CreditCardRecord[];
  savingsGoals: SavingsGoalRecord[];
  transactions: TransactionRecord[];
  budgetAlerts: BudgetAlertRecord[];
}

const WORKSPACE_STORAGE_KEY = 'tapioca_pay_workspace_v1';
const THEME_STORAGE_KEY = 'tapioca_pay_theme_v1';

function isValidProfile(value: unknown): value is CoupleProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.displayName === 'string' &&
    typeof candidate.partnerName === 'string' &&
    typeof candidate.userSalary === 'number' &&
    typeof candidate.partnerSalary === 'number' &&
    typeof candidate.dayToDayBudget === 'number' &&
    typeof candidate.pixSettled === 'boolean'
  );
}

export function loadCachedWorkspace(): CachedWorkspacePayload | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedWorkspacePayload>;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !isValidProfile(parsed.profile) ||
      !Array.isArray(parsed.bills) ||
      !Array.isArray(parsed.creditCards) ||
      !Array.isArray(parsed.savingsGoals) ||
      !Array.isArray(parsed.transactions) ||
      !Array.isArray(parsed.budgetAlerts)
    ) {
      return null;
    }

    return {
      version: 1,
      updatedAt:
        typeof parsed.updatedAt === 'string'
          ? parsed.updatedAt
          : new Date().toISOString(),
      profile: parsed.profile,
      pluggyConnections: Array.isArray(parsed.pluggyConnections)
        ? parsed.pluggyConnections
        : [],
      bills: parsed.bills,
      creditCards: parsed.creditCards,
      savingsGoals: parsed.savingsGoals,
      transactions: parsed.transactions,
      budgetAlerts: parsed.budgetAlerts,
    };
  } catch {
    return null;
  }
}

export function saveCachedWorkspace(
  payload: Omit<CachedWorkspacePayload, 'version' | 'updatedAt'>
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const snapshot: CachedWorkspacePayload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      ...payload,
    };
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Gracefully ignore storage quota or private-mode restrictions
  }
}

export function loadCachedDarkMode(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  } catch {
    return false;
  }
}

export function saveCachedDarkMode(isDark: boolean): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
  } catch {
    // Gracefully ignore storage restrictions
  }
}
