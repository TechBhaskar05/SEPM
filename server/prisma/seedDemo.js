import 'dotenv/config';

import bcrypt from 'bcrypt';

import prisma from '../src/lib/prismaClient.js';

const DEMO_EMAIL = 'demo@example.com';
const DEMO_NAME = 'Demo User';
const DEMO_PASSWORD = 'Demo@12345';
const SALT_ROUNDS = 12;

const now = new Date();
const today = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
);

function thisMonth(day) {
  return new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      Math.min(day, today.getUTCDate()),
    ),
  );
}

function monthsAgo(months, day) {
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - months, day),
  );
}

function monthsFromNow(months, day) {
  return new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + months, day),
  );
}

function daysFromNow(days) {
  return new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() + days,
    ),
  );
}

function periodForDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

const CATEGORY_NAMES = [
  'Food & Dining',
  'Groceries',
  'Transport',
  'Utilities',
  'Health',
  'Entertainment',
  'Shopping',
  'Salary',
  'Housing',
  'Other',
];

const TRANSACTION_SEEDS = [
  {
    type: 'income',
    amount: 8500000,
    description: 'Salary — Acme Corp',
    category: 'Salary',
    paymentMethod: 'Net banking',
    date: thisMonth(1),
  },
  {
    type: 'income',
    amount: 1800000,
    description: 'Freelance invoice #2213',
    category: 'Salary',
    paymentMethod: 'Net banking',
    date: thisMonth(10),
  },
  {
    type: 'transfer',
    amount: 2000000,
    description: 'Transfer to savings account',
    category: 'Other',
    paymentMethod: 'Net banking',
    date: thisMonth(2),
  },
  {
    type: 'expense',
    amount: 129900,
    description: 'Netflix subscription',
    category: 'Entertainment',
    paymentMethod: 'Credit card',
    date: thisMonth(5),
  },
  {
    type: 'expense',
    amount: 40000,
    description: 'PVR movie tickets',
    category: 'Entertainment',
    paymentMethod: 'UPI',
    date: thisMonth(14),
  },
  {
    type: 'expense',
    amount: 29900,
    description: 'Metro recharge',
    category: 'Transport',
    paymentMethod: 'UPI',
    date: thisMonth(9),
  },
  {
    type: 'expense',
    amount: 86000,
    description: 'Uber rides',
    category: 'Transport',
    paymentMethod: 'Credit card',
    date: thisMonth(6),
  },
  {
    type: 'expense',
    amount: 94100,
    description: 'Indian Oil fuel',
    category: 'Transport',
    paymentMethod: 'Debit card',
    date: thisMonth(12),
  },
  {
    type: 'expense',
    amount: 450000,
    description: 'Electricity bill',
    category: 'Utilities',
    paymentMethod: 'Auto-pay',
    date: thisMonth(15),
  },
  {
    type: 'expense',
    amount: 235000,
    description: 'BigBasket weekly groceries',
    category: 'Groceries',
    paymentMethod: 'Credit card',
    date: thisMonth(16),
  },
  {
    type: 'expense',
    amount: 155000,
    description: "Nature's Basket groceries",
    category: 'Groceries',
    paymentMethod: 'UPI',
    date: thisMonth(8),
  },
  {
    type: 'expense',
    amount: 64050,
    description: 'Swiggy dinner',
    category: 'Food & Dining',
    paymentMethod: 'UPI',
    date: thisMonth(17),
  },
  {
    type: 'expense',
    amount: 179950,
    description: 'Dinner at Fatty Bao',
    category: 'Food & Dining',
    paymentMethod: 'Credit card',
    date: thisMonth(6),
  },
  {
    type: 'expense',
    amount: 38000,
    description: 'Third Wave Coffee',
    category: 'Food & Dining',
    paymentMethod: 'UPI',
    date: thisMonth(12),
  },
  {
    type: 'expense',
    amount: 125000,
    description: 'Truffles dinner',
    category: 'Food & Dining',
    paymentMethod: 'Credit card',
    date: thisMonth(13),
  },
  {
    type: 'expense',
    amount: 72000,
    description: 'Domino’s pizza',
    category: 'Food & Dining',
    paymentMethod: 'UPI',
    date: thisMonth(8),
  },
  {
    type: 'expense',
    amount: 45000,
    description: 'Starbucks coffee',
    category: 'Food & Dining',
    paymentMethod: 'Credit card',
    date: thisMonth(11),
  },
  {
    type: 'expense',
    amount: 29000,
    description: 'Local bakery',
    category: 'Food & Dining',
    paymentMethod: 'Cash',
    date: thisMonth(7),
  },
  {
    type: 'expense',
    amount: 95000,
    description: 'Biryani House',
    category: 'Food & Dining',
    paymentMethod: 'UPI',
    date: thisMonth(4),
  },
  {
    type: 'expense',
    amount: 32000,
    description: 'Cafe Coffee Day',
    category: 'Food & Dining',
    paymentMethod: 'UPI',
    date: thisMonth(3),
  },
  {
    type: 'expense',
    amount: 125000,
    description: 'Apollo Pharmacy',
    category: 'Health',
    paymentMethod: 'UPI',
    date: thisMonth(11),
  },
  {
    type: 'expense',
    amount: 124950,
    description: 'Zoya Textiles — kurta',
    category: 'Shopping',
    paymentMethod: 'UPI',
    date: thisMonth(18),
  },
  {
    type: 'income',
    amount: 8500000,
    description: 'Salary — Acme Corp',
    category: 'Salary',
    paymentMethod: 'Net banking',
    date: monthsAgo(1, 1),
  },
  {
    type: 'expense',
    amount: 1800000,
    description: 'Monthly rent',
    category: 'Housing',
    paymentMethod: 'Net banking',
    date: monthsAgo(1, 3),
  },
  {
    type: 'expense',
    amount: 450000,
    description: 'BigBasket groceries',
    category: 'Groceries',
    paymentMethod: 'Credit card',
    date: monthsAgo(1, 7),
  },
  {
    type: 'expense',
    amount: 300000,
    description: 'Dining out',
    category: 'Food & Dining',
    paymentMethod: 'UPI',
    date: monthsAgo(1, 10),
  },
  {
    type: 'expense',
    amount: 380000,
    description: 'Electricity bill',
    category: 'Utilities',
    paymentMethod: 'Auto-pay',
    date: monthsAgo(1, 12),
  },
  {
    type: 'expense',
    amount: 25000,
    description: 'Metro recharge',
    category: 'Transport',
    paymentMethod: 'UPI',
    date: monthsAgo(1, 5),
  },
  {
    type: 'expense',
    amount: 250000,
    description: 'Shopping',
    category: 'Shopping',
    paymentMethod: 'Credit card',
    date: monthsAgo(1, 15),
  },
  {
    type: 'income',
    amount: 8500000,
    description: 'Salary — Acme Corp',
    category: 'Salary',
    paymentMethod: 'Net banking',
    date: monthsAgo(2, 1),
  },
  {
    type: 'expense',
    amount: 1800000,
    description: 'Monthly rent',
    category: 'Housing',
    paymentMethod: 'Net banking',
    date: monthsAgo(2, 3),
  },
  {
    type: 'expense',
    amount: 420000,
    description: 'Groceries',
    category: 'Groceries',
    paymentMethod: 'Credit card',
    date: monthsAgo(2, 8),
  },
  {
    type: 'expense',
    amount: 400000,
    description: 'Dining out',
    category: 'Food & Dining',
    paymentMethod: 'UPI',
    date: monthsAgo(2, 11),
  },
  {
    type: 'expense',
    amount: 350000,
    description: 'Electricity bill',
    category: 'Utilities',
    paymentMethod: 'Auto-pay',
    date: monthsAgo(2, 13),
  },
  {
    type: 'expense',
    amount: 60000,
    description: 'Metro and cabs',
    category: 'Transport',
    paymentMethod: 'UPI',
    date: monthsAgo(2, 6),
  },
];

const currentPeriod = periodForDate(today);
const currentExpensesByCategory = new Map();

for (const transaction of TRANSACTION_SEEDS) {
  if (
    transaction.type === 'expense' &&
    periodForDate(transaction.date) === currentPeriod
  ) {
    currentExpensesByCategory.set(
      transaction.category,
      (currentExpensesByCategory.get(transaction.category) ?? 0) +
        transaction.amount,
    );
  }
}

const BUDGET_SEEDS = [
  { category: 'Food & Dining', limitAmount: 800000 },
  { category: 'Groceries', limitAmount: 600000 },
  { category: 'Transport', limitAmount: 300000 },
  { category: 'Entertainment', limitAmount: 150000 },
  { category: 'Utilities', limitAmount: 500000 },
  { category: 'Shopping', limitAmount: 500000 },
];

const GOAL_SEEDS = [
  {
    name: 'Emergency fund',
    targetAmount: 20000000,
    savedAmount: 6500000,
    deadline: monthsFromNow(5, 15),
  },
  {
    name: 'Japan trip',
    targetAmount: 15000000,
    savedAmount: 4500000,
    deadline: monthsFromNow(3, 15),
  },
  {
    name: 'New laptop',
    targetAmount: 12000000,
    savedAmount: 11500000,
    deadline: monthsFromNow(1, 15),
  },
];

const SUBSCRIPTION_SEEDS = [
  {
    name: 'Netflix',
    amount: 64900,
    frequency: 'monthly',
    nextRenewalDate: daysFromNow(5),
  },
  {
    name: 'Spotify',
    amount: 11900,
    frequency: 'monthly',
    nextRenewalDate: daysFromNow(7),
  },
  {
    name: 'iCloud+',
    amount: 240000,
    frequency: 'yearly',
    nextRenewalDate: daysFromNow(40),
  },
  {
    name: 'Domain renewal',
    amount: 120000,
    frequency: 'yearly',
    nextRenewalDate: daysFromNow(57),
  },
];

let user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });

if (!user) {
  user = await prisma.user.create({
    data: {
      name: DEMO_NAME,
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS),
    },
  });
} else {
  user = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: DEMO_NAME,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS),
    },
  });
}

await prisma.$transaction([
  prisma.idempotencyKey.deleteMany({ where: { userId: user.id } }),
  prisma.activity.deleteMany({ where: { userId: user.id } }),
  prisma.financialRule.deleteMany({ where: { userId: user.id } }),
  prisma.subscription.deleteMany({ where: { userId: user.id } }),
  prisma.savingsGoal.deleteMany({ where: { userId: user.id } }),
  prisma.budget.deleteMany({ where: { userId: user.id } }),
  prisma.transaction.deleteMany({ where: { userId: user.id } }),
  prisma.category.deleteMany({ where: { userId: user.id } }),
]);

const categoryIds = new Map();

for (const name of CATEGORY_NAMES) {
  let category = await prisma.category.findFirst({
    where: { name, userId: null },
    select: { id: true },
  });

  if (!category) {
    category = await prisma.category.create({
      data: { name },
      select: { id: true },
    });
  }

  categoryIds.set(name, category.id);
}

function categoryId(name) {
  const id = categoryIds.get(name);
  if (!id) throw new Error(`Missing category: ${name}`);
  return id;
}

await prisma.transaction.createMany({
  data: TRANSACTION_SEEDS.map(({ category, ...transaction }) => ({
    ...transaction,
    userId: user.id,
    categoryId: categoryId(category),
    source: 'manual',
  })),
});

await prisma.budget.createMany({
  data: BUDGET_SEEDS.map((budget) => ({
    userId: user.id,
    categoryId: categoryId(budget.category),
    period: currentPeriod,
    limitAmount: budget.limitAmount,
    spent: currentExpensesByCategory.get(budget.category) ?? 0,
  })),
});

await prisma.savingsGoal.createMany({
  data: GOAL_SEEDS.map((goal) => ({ ...goal, userId: user.id })),
});

await prisma.subscription.createMany({
  data: SUBSCRIPTION_SEEDS.map((subscription) => ({
    ...subscription,
    userId: user.id,
  })),
});

const [transactions, budgets, goals, subscriptions] = await Promise.all([
  prisma.transaction.count({ where: { userId: user.id } }),
  prisma.budget.count({ where: { userId: user.id } }),
  prisma.savingsGoal.count({ where: { userId: user.id } }),
  prisma.subscription.count({ where: { userId: user.id } }),
]);

console.log('Demo data seeded.');
console.log(`Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
console.log(
  `Transactions: ${transactions}, budgets: ${budgets}, goals: ${goals}, subscriptions: ${subscriptions}`,
);
console.log(
  `Current budget period: ${currentPeriod} (spent follows the seeded expense transactions)`,
);

await prisma.$disconnect();
