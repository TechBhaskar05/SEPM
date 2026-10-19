/**
 * Pure helpers for the dashboard aggregation.
 *
 * Kept apart from `dashboardService.js` so the period boundaries and the
 * projection of Prisma's grouped rows can be unit tested without a database
 * mock. Money stays integer paise throughout; nothing here divides an amount
 * except to express a category's share of the period's spending as a
 * percentage for display.
 */

import { periodForDate } from './budgetMath.js';

/**
 * The "YYYY-MM" period for `now`, defaulting to the current instant. Delegates
 * to `periodForDate`, which reads the date in UTC - the same rule budgets use,
 * so a dashboard and a budget never disagree about which month a transaction
 * belongs to.
 */
export function currentPeriod(now = new Date()) {
  return periodForDate(now);
}

/**
 * First instant of `period` (inclusive) and first instant of the next period
 * (exclusive), both at UTC midnight.
 *
 * An exclusive upper bound is deliberate: `lt: end` cannot miss a row stored
 * late on the last day of the month the way `lte: lastDay` would, because the
 * date column still carries a time component at the Postgres boundary.
 *
 * @param {string} period  "YYYY-MM", already validated by the route schema.
 * @returns {{ start: Date, end: Date }}
 */
export function periodRange(period) {
  const [year, month] = period.split('-').map(Number);

  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

/**
 * One type's total from a Prisma `groupBy` result, or 0 when the user has no
 * rows of that type.
 *
 * This is an aggregate lookup, not a JS sum over transactions: Prisma has
 * already collapsed the rows before the service sees them.
 */
export function sumType(groupedTotals, type) {
  const row = groupedTotals.find((entry) => entry.type === type);
  return row?._sum?.amount ?? 0;
}

/**
 * Projects category `groupBy` rows onto the API shape, resolving names and
 * computing each category's share of the period's expenses.
 *
 * `percentage` is rounded to two decimal places for display. It is derived
 * from an aggregate total, so it stays correct as the ledger grows rather than
 * being re-summed here.
 */
export function toCategoryBreakdown(rows, categories, totalExpenses) {
  const nameById = new Map(
    categories.map((category) => [category.id, category.name]),
  );

  return rows.map((row) => {
    const amount = row._sum?.amount ?? 0;

    return {
      categoryId: row.categoryId,
      categoryName: row.categoryId
        ? (nameById.get(row.categoryId) ?? 'Unknown category')
        : 'Uncategorised',
      amount,
      percentage:
        totalExpenses > 0
          ? Math.round((amount / totalExpenses) * 10000) / 100
          : 0,
    };
  });
}
