import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Dashboard aggregation.
 *
 * The service is exercised with a mocked Prisma client, so these tests assert
 * the query shape and the projection of grouped rows rather than any database
 * behaviour. The pure period/percentage helpers are tested directly.
 */

vi.mock('../../src/lib/prismaClient.js', () => ({
  default: {
    transaction: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
  },
}));

const prisma = (await import('../../src/lib/prismaClient.js')).default;
const { currentPeriod, periodRange, sumType, toCategoryBreakdown } =
  await import('../../src/services/dashboardMath.js');
const { getDashboard, RECENT_TRANSACTION_LIMIT } =
  await import('../../src/services/dashboardService.js');

const USER_ID = '11111111-1111-1111-1111-111111111111';
const FOOD_ID = '33333333-3333-3333-3333-333333333333';
const TRANSPORT_ID = '44444444-4444-4444-4444-444444444444';
const TX_ID = '55555555-5555-5555-5555-555555555555';

/**
 * Routes the three `groupBy` calls to their fixtures: the category breakdown
 * groups by categoryId, the period totals carry a date filter, and the
 * remaining call is the all-time balance.
 */
function mockGroupedData({
  periodTotals = [],
  lifetimeTotals = [],
  categoryRows = [],
} = {}) {
  prisma.transaction.groupBy.mockImplementation((args) => {
    if (args.by.includes('categoryId')) return Promise.resolve(categoryRows);
    if (args.where.date) return Promise.resolve(periodTotals);
    return Promise.resolve(lifetimeTotals);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-19T12:00:00.000Z'));

  prisma.transaction.groupBy.mockReset();
  prisma.transaction.findMany.mockReset();
  prisma.category.findMany.mockReset();

  mockGroupedData();
  prisma.transaction.findMany.mockResolvedValue([]);
  prisma.category.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('period helpers — pure', () => {
  it('currentPeriod reads the UTC month', () => {
    expect(currentPeriod()).toBe('2026-10');
  });

  it('currentPeriod accepts an explicit clock', () => {
    expect(currentPeriod(new Date('2026-01-01T00:00:00.000Z'))).toBe('2026-01');
  });

  it('periodRange starts at UTC midnight on the first and ends at the next month', () => {
    const { start, end } = periodRange('2026-10');

    expect(start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('periodRange handles a December to January boundary', () => {
    const { start, end } = periodRange('2026-12');

    expect(start.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('sumType returns 0 when a type has no rows', () => {
    expect(sumType([], 'income')).toBe(0);
    expect(
      sumType([{ type: 'expense', _sum: { amount: 500 } }], 'income'),
    ).toBe(0);
  });

  it('toCategoryBreakdown resolves names and rounds percentages', () => {
    const rows = [
      { categoryId: FOOD_ID, _sum: { amount: 333 } },
      { categoryId: null, _sum: { amount: 667 } },
    ];

    expect(
      toCategoryBreakdown(rows, [{ id: FOOD_ID, name: 'Food & Dining' }], 1000),
    ).toEqual([
      {
        categoryId: FOOD_ID,
        categoryName: 'Food & Dining',
        amount: 333,
        percentage: 33.3,
      },
      {
        categoryId: null,
        categoryName: 'Uncategorised',
        amount: 667,
        percentage: 66.7,
      },
    ]);
  });

  it('toCategoryBreakdown returns 0% for an empty spend total', () => {
    const [entry] = toCategoryBreakdown(
      [{ categoryId: FOOD_ID, _sum: { amount: 0 } }],
      [{ id: FOOD_ID, name: 'Food & Dining' }],
      0,
    );

    expect(entry.percentage).toBe(0);
  });
});

describe('getDashboard', () => {
  it('defaults to the current period', async () => {
    const dashboard = await getDashboard(USER_ID);

    expect(dashboard.period).toBe('2026-10');
    expect(dashboard.summary.period).toBe('2026-10');
  });

  it('uses the supplied period for the scoped reads', async () => {
    await getDashboard(USER_ID, { period: '2026-03' });

    const periodCall = prisma.transaction.groupBy.mock.calls.find(
      ([args]) => args.where.date,
    );
    expect(periodCall[0].where.date.gte.toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    );
    expect(periodCall[0].where.date.lt.toISOString()).toBe(
      '2026-04-01T00:00:00.000Z',
    );
  });

  it('computes income, expenses and savings from the period aggregates', async () => {
    mockGroupedData({
      periodTotals: [
        { type: 'income', _sum: { amount: 900000 } },
        { type: 'expense', _sum: { amount: 350000 } },
        // A transfer is deliberately not income or an expense.
        { type: 'transfer', _sum: { amount: 50000 } },
      ],
    });

    const { summary } = await getDashboard(USER_ID);

    expect(summary.totalIncome).toBe(900000);
    expect(summary.totalExpenses).toBe(350000);
    expect(summary.savings).toBe(550000);
  });

  it('reports a negative saving when the month spends more than it earns', async () => {
    mockGroupedData({
      periodTotals: [
        { type: 'income', _sum: { amount: 100000 } },
        { type: 'expense', _sum: { amount: 250000 } },
      ],
    });

    const { summary } = await getDashboard(USER_ID);

    expect(summary.savings).toBe(-150000);
  });

  it('computes total balance from all-time income minus all-time expenses', async () => {
    mockGroupedData({
      lifetimeTotals: [
        { type: 'income', _sum: { amount: 5000000 } },
        { type: 'expense', _sum: { amount: 1250000 } },
      ],
    });

    const { summary } = await getDashboard(USER_ID);

    expect(summary.totalBalance).toBe(3750000);
  });

  it('returns zeros for an empty ledger', async () => {
    const dashboard = await getDashboard(USER_ID);

    expect(dashboard.summary).toEqual({
      period: '2026-10',
      totalBalance: 0,
      totalIncome: 0,
      totalExpenses: 0,
      savings: 0,
    });
    expect(dashboard.categoryBreakdown).toEqual([]);
    expect(dashboard.recentTransactions).toEqual([]);
    expect(dashboard.aiSummary).toBeNull();
  });

  it('resolves category names and keeps the aggregate order', async () => {
    mockGroupedData({
      periodTotals: [{ type: 'expense', _sum: { amount: 100000 } }],
      categoryRows: [
        { categoryId: FOOD_ID, _sum: { amount: 70000 } },
        { categoryId: TRANSPORT_ID, _sum: { amount: 30000 } },
      ],
    });
    prisma.category.findMany.mockResolvedValue([
      { id: FOOD_ID, name: 'Food & Dining' },
      { id: TRANSPORT_ID, name: 'Transport' },
    ]);

    const { categoryBreakdown } = await getDashboard(USER_ID);

    expect(categoryBreakdown).toEqual([
      {
        categoryId: FOOD_ID,
        categoryName: 'Food & Dining',
        amount: 70000,
        percentage: 70,
      },
      {
        categoryId: TRANSPORT_ID,
        categoryName: 'Transport',
        amount: 30000,
        percentage: 30,
      },
    ]);
  });

  it('labels an uncategorised group instead of dropping it', async () => {
    mockGroupedData({
      categoryRows: [{ categoryId: null, _sum: { amount: 4200 } }],
    });

    const { categoryBreakdown } = await getDashboard(USER_ID);

    expect(categoryBreakdown).toEqual([
      {
        categoryId: null,
        categoryName: 'Uncategorised',
        amount: 4200,
        percentage: 0,
      },
    ]);
  });

  it("loads the user's categories in parallel with the aggregates", async () => {
    mockGroupedData({
      categoryRows: [{ categoryId: FOOD_ID, _sum: { amount: 1000 } }],
    });
    prisma.category.findMany.mockResolvedValue([
      { id: FOOD_ID, name: 'Food & Dining' },
    ]);

    await getDashboard(USER_ID);

    expect(prisma.category.findMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: USER_ID }, { userId: null }] },
      select: { id: true, name: true },
    });
  });

  it('returns the latest five transactions, newest first', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: TX_ID,
        userId: USER_ID,
        categoryId: FOOD_ID,
        type: 'expense',
        amount: 124900,
        description: 'Zoya Textiles',
        paymentMethod: 'UPI',
        date: new Date('2026-10-18T00:00:00.000Z'),
        source: 'manual',
        createdAt: new Date('2026-10-18T09:00:00.000Z'),
        category: { id: FOOD_ID, name: 'Food & Dining' },
      },
    ]);

    const { recentTransactions } = await getDashboard(USER_ID);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: RECENT_TRANSACTION_LIMIT,
      include: { category: { select: { id: true, name: true } } },
    });
    expect(recentTransactions).toEqual([
      {
        id: TX_ID,
        userId: USER_ID,
        categoryId: FOOD_ID,
        type: 'expense',
        amount: 124900,
        description: 'Zoya Textiles',
        paymentMethod: 'UPI',
        date: new Date('2026-10-18T00:00:00.000Z'),
        source: 'manual',
        createdAt: new Date('2026-10-18T09:00:00.000Z'),
        category: { id: FOOD_ID, name: 'Food & Dining' },
      },
    ]);
  });

  it('keeps an uncategorised recent transaction as null', async () => {
    prisma.transaction.findMany.mockResolvedValue([
      {
        id: TX_ID,
        userId: USER_ID,
        categoryId: null,
        type: 'expense',
        amount: 5000,
        description: 'Corner shop',
        paymentMethod: null,
        date: new Date('2026-10-17T00:00:00.000Z'),
        source: 'manual',
        createdAt: new Date('2026-10-17T09:00:00.000Z'),
        category: null,
      },
    ]);

    const { recentTransactions } = await getDashboard(USER_ID);

    expect(recentTransactions[0].category).toBeNull();
  });
});
