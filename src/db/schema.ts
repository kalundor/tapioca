import { relations } from 'drizzle-orm';
import { boolean, integer, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').default('Pessoa 1'),
  partnerName: text('partner_name').default('Esposa'),
  userSalary: numeric('user_salary', { precision: 12, scale: 2 }).default('28000.00').notNull(),
  partnerSalary: numeric('partner_salary', { precision: 12, scale: 2 }).default('24000.00').notNull(),
  dayToDayBudget: numeric('day_to_day_budget', { precision: 12, scale: 2 }).default('500.00').notNull(),
  pixSettled: boolean('pix_settled').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bills = pgTable('bills', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  title: text('title').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  dueDay: integer('due_day').notNull(),
  category: text('category').notNull(), // 'house' | 'personal' | 'card' | 'savings' | 'family'
  isHousingCost: boolean('is_housing_cost').default(false).notNull(),
  paidBy: text('paid_by').notNull(), // 'user' | 'partner'
  isShared: boolean('is_shared').default(true).notNull(),
  isPaid: boolean('is_paid').default(false).notNull(),
  monthKey: text('month_key').default('2026-12').notNull(),
  iconType: text('icon_type').default('receipt').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const creditCards = pgTable('credit_cards', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  name: text('name').notNull(),
  brand: text('brand').notNull(), // 'santander' | 'itau' | 'nubank' | 'caixa'
  tier: text('tier').notNull(), // 'UNIQUE' | 'PERSONNALITÉ' | 'ULTRAVIOLETA'
  status: text('status').default('Aberta').notNull(),
  dueDate: text('due_date').notNull(), // e.g. '05/12'
  currentInvoice: numeric('current_invoice', { precision: 12, scale: 2 }).notNull(),
  availableLimit: numeric('available_limit', { precision: 12, scale: 2 }).notNull(),
  nextJanInvoice: numeric('next_jan_invoice', { precision: 12, scale: 2 }).notNull(),
  nextFebInvoice: numeric('next_feb_invoice', { precision: 12, scale: 2 }).notNull(),
  colorTheme: text('color_theme').default('dark').notNull(),
  pluggyItemId: text('pluggy_item_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const savingsGoals = pgTable('savings_goals', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  currentAmount: numeric('current_amount', { precision: 12, scale: 2 }).notNull(),
  targetAmount: numeric('target_amount', { precision: 12, scale: 2 }).notNull(),
  monthlyContribution: numeric('monthly_contribution', { precision: 12, scale: 2 }).notNull(),
  deadline: text('deadline').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  description: text('description').notNull(),
  merchant: text('merchant').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: text('category').notNull(),
  date: text('date').notNull(),
  accountName: text('account_name').notNull(),
  source: text('source').default('pluggy').notNull(), // 'pluggy' | 'manual'
  isRecurring: boolean('is_recurring').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const budgetAlerts = pgTable('budget_alerts', {
  id: serial('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  category: text('category').notNull(),
  limitAmount: numeric('limit_amount', { precision: 12, scale: 2 }).notNull(),
  currentSpent: numeric('current_spent', { precision: 12, scale: 2 }).notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  pushEnabled: boolean('push_enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  bills: many(bills),
  creditCards: many(creditCards),
  savingsGoals: many(savingsGoals),
  transactions: many(transactions),
  budgetAlerts: many(budgetAlerts),
}));
