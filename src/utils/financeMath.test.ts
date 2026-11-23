import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHouseSplit,
  calculatePredictedBalance,
  calculateHousingBenchmark,
  splitBRLParts,
  buildAnnualExpenseSeries,
  filterAndZoomExpenseSeries,
  type BillItem,
  type CoupleProfile,
} from './financeMath';

const defaultProfile: CoupleProfile = {
  displayName: 'Pessoa 1',
  partnerName: 'Esposa',
  userSalary: 28000.0,
  partnerSalary: 24000.0,
  dayToDayBudget: 500.0,
  pixSettled: false,
};

const referenceBills: BillItem[] = [
  // Shared house bills (Divisão da casa: total R$ 15.332,44)
  {
    id: 1,
    title: 'Aluguel',
    amount: 4800.0,
    dueDay: 5,
    category: 'house',
    isHousingCost: true,
    paidBy: 'partner',
    isShared: true,
    isPaid: false,
    monthKey: '2026-12',
    iconType: 'key',
  },
  {
    id: 2,
    title: 'Reserva',
    amount: 4000.0,
    dueDay: 5,
    category: 'house',
    isHousingCost: false,
    paidBy: 'user',
    isShared: true,
    isPaid: false,
    monthKey: '2026-12',
    iconType: 'piggy',
  },
  {
    id: 3,
    title: 'Apartamento Vila Olímpia',
    amount: 2332.54,
    dueDay: 1,
    category: 'house',
    isHousingCost: true,
    paidBy: 'partner',
    isShared: true,
    isPaid: false,
    monthKey: '2026-12',
    iconType: 'crane',
  },
  {
    id: 4,
    title: 'Cartão da casa',
    amount: 2150.0,
    dueDay: 5,
    category: 'house',
    isHousingCost: true,
    paidBy: 'user',
    isShared: true,
    isPaid: false,
    monthKey: '2026-12',
    iconType: 'card',
  },
  {
    id: 5,
    title: 'Condomínio',
    amount: 1580.0,
    dueDay: 5,
    category: 'house',
    isHousingCost: true,
    paidBy: 'user',
    isShared: true,
    isPaid: false,
    monthKey: '2026-12',
    iconType: 'building',
  },
  {
    id: 6,
    title: 'Luz',
    amount: 340.0,
    dueDay: 8,
    category: 'house',
    isHousingCost: true,
    paidBy: 'user',
    isShared: true,
    isPaid: false,
    monthKey: '2026-12',
    iconType: 'zap',
  },
  {
    id: 7,
    title: 'Internet',
    amount: 129.9,
    dueDay: 10,
    category: 'house',
    isHousingCost: true,
    paidBy: 'user',
    isShared: true,
    isPaid: false,
    monthKey: '2026-12',
    iconType: 'wifi',
  },
  // Personal bills paid by user (Contas pessoais: R$ 14.529,50)
  {
    id: 8,
    title: 'Fatura Santander Unique',
    amount: 7999.7,
    dueDay: 5,
    category: 'personal',
    isHousingCost: false,
    paidBy: 'user',
    isShared: false,
    isPaid: false,
    monthKey: '2026-12',
    iconType: 'card',
  },
  {
    id: 9,
    title: 'Ajuda pra família',
    amount: 3000.0,
    dueDay: 5,
    category: 'personal',
    isHousingCost: false,
    paidBy: 'user',
    isShared: false,
    isPaid: false,
    monthKey: '2026-12',
    iconType: 'heart',
  },
  {
    id: 10,
    title: 'Investimento Previdência & Ações',
    amount: 3349.9,
    dueDay: 12,
    category: 'personal',
    isHousingCost: false,
    paidBy: 'user',
    isShared: false,
    isPaid: false,
    monthKey: '2026-12',
    iconType: 'trending',
  },
  {
    id: 11,
    title: 'Seguro Residencial & Pet',
    amount: 179.9,
    dueDay: 12,
    category: 'personal',
    isHousingCost: false,
    paidBy: 'user',
    isShared: false,
    isPaid: false,
    monthKey: '2026-12',
    iconType: 'shield',
  },
];

test('calculateHouseSplit matches reference image numbers accurately', () => {
  const split = calculateHouseSplit(referenceBills);
  assert.equal(split.totalHouseBills, 15332.44);
  assert.equal(split.userPaidTotal, 8199.9);
  assert.equal(split.partnerPaidTotal, 7132.54);
  assert.equal(split.eachShare50, 7666.22);
  assert.equal(split.pixSettlementAmount, 533.68);
  assert.equal(split.whoOwesWhom, 'partner_owes_user');
});

test('calculatePredictedBalance matches R$ 5.304,28 leftover and percentages', () => {
  const summary = calculatePredictedBalance(defaultProfile, referenceBills);
  assert.equal(summary.salary, 28000.0);
  assert.equal(summary.userHouseShare, 7666.22);
  assert.equal(summary.personalBillsTotal, 14529.5);
  assert.equal(summary.dayToDayBudget, 500.0);
  assert.equal(summary.predictedLeftover, 5304.28);
  assert.equal(summary.userHouseSharePct, 27);
  assert.equal(summary.personalBillsPct, 52);
  assert.equal(summary.dayToDayPct, 2);
  assert.equal(summary.predictedLeftoverPct, 19);
});

test('calculateHousingBenchmark computes R$ 5.666,22 (20% of salary) in solo mode', () => {
  const benchmark = calculateHousingBenchmark(defaultProfile, referenceBills, 'solo');
  assert.equal(benchmark.userHousingCost, 5666.22);
  assert.equal(benchmark.housingPctOfSalary, 20);
  assert.equal(benchmark.isWithinRecommended30Pct, true);
  assert.equal(benchmark.items.length, 6);
});

test('splitBRLParts formats integer and cents correctly', () => {
  const parts = splitBRLParts(5304.28);
  assert.equal(parts.integerPart, '5.304');
  assert.equal(parts.centsPart, '28');
});

test('filterAndZoomExpenseSeries supports category filtering and date range zoom', () => {
  const series = buildAnnualExpenseSeries(referenceBills, 28000);
  assert.equal(series.length, 12);
  assert.equal(series[11].monthLabel, 'Dez');
  assert.equal(series[11].moradia, 7666.22);
  assert.equal(series[11].cartoes, 7999.7);

  // Zoom into Q4 (Out-Dez, indices 9..11) and filter only 'moradia'
  const q4Moradia = filterAndZoomExpenseSeries(series, {
    activeCategories: ['moradia'],
    startIndex: 9,
    endIndex: 11,
    zoomScale: 1.5,
  });

  assert.equal(q4Moradia.points.length, 3);
  assert.equal(q4Moradia.points[2].filteredTotal, 7666.22);
  assert.equal(q4Moradia.points[2].categoryValues.cartoes, 0);
  assert.equal(q4Moradia.peakMonth.label, 'Dez');
});

