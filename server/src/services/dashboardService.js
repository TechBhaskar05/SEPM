import prisma from '../lib/prismaClient.js';
import {
  currentPeriod,
  periodRange,
  sumType,
  toCategoryBreakdown,
} from './dashboardMath.js';

/**
 * Dashboard aggregation.
 *
 * Everything that touches more than a handful of rows is computed by Postgres
 * through Prisma `groupBy`; the service only extracts aggregates, resolves
 * category names and computes presentation percentages. Money stays integer
 * paise end to end (conventions.md, "Money handling").
 *
 * Definitions:
 *   - `totalBalance` is all-time income minus all-time expenses. It is the
 *     accumulated net position, not a monthly figure.
 *   - `totalIncome`, `totalExpenses` and `savings` are scoped to `period`
 *     (default: the current UTC month). `savings` is income minus expenses.
 *   - Transfers are excluded from every total: with no account model they are
 *     neither money earned nor money spent.
 */

/** How many rows the dashboard's recent list shows. */
export const RECENT_TRANSACTION_LIMIT = 5;

function toRecentTransaction(transaction) {
  const { category, ...rest } = transaction;

  return {
    ...rest,
    category: category ? { id: category.id, name: category.name } : null,
  };
}

/**
 * @param {string} userId
 * @param {object} [options]
 * @param {string} [options.period]  "YYYY-MM"; defaults to the current month.
 * @returns {Promise<object>} Summary, category breakdown and recent rows.
 */
export async function getDashboard(userId, { period = currentPeriod() } = {}) {
  const { start, end } = periodRange(period);

  const periodWhere = { userId, date: { gte: start, lt: end } };

  // Five independent reads, issued together. `groupBy` lets Postgres do the
  // collapsing; nothing here iterates a ledger in JS.
  //
  // The category list is fetched in parallel rather than after the breakdown
  // because names are only needed for ids the breakdown returns - but waiting
  // for that response first costs a second database round trip, which is the
  // dominant cost on a remote (Neon) database. A user's categories (plus the
  // system defaults) are a small bounded set, so loading them alongside the
  // aggregates is cheaper than a sequential lookup.
  const [
    periodTotals,
    lifetimeTotals,
    categoryRows,
    recentTransactions,
    categories,
  ] = await Promise.all([
    prisma.transaction.groupBy({
      by: ['type'],
      where: periodWhere,
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ['categoryId'],
      where: { ...periodWhere, type: 'expense' },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: RECENT_TRANSACTION_LIMIT,
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.category.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      select: { id: true, name: true },
    }),
  ]);

  const totalIncome = sumType(periodTotals, 'income');
  const totalExpenses = sumType(periodTotals, 'expense');

  return {
    period,
    summary: {
      period,
      totalBalance:
        sumType(lifetimeTotals, 'income') - sumType(lifetimeTotals, 'expense'),
      totalIncome,
      totalExpenses,
      savings: totalIncome - totalExpenses,
    },
    categoryBreakdown: toCategoryBreakdown(
      categoryRows,
      categories,
      totalExpenses,
    ),
    recentTransactions: recentTransactions.map(toRecentTransaction),
    // Phase 11 owns the AI narrative. The field is present so the client can
    // opt in without a shape change, and null means "no callout", not "load
    // failed" - the UI renders nothing when it is null.
    aiSummary: null,
  };
}
