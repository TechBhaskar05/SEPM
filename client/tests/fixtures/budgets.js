import { toBudgetView } from '../../../server/src/services/budgetMath.js';

/**
 * Budget fixtures for the client tests.
 *
 * These go through the server's real `toBudgetView` rather than hand-writing the
 * derived fields (`utilizationPercent`, `thresholdLevel`, `alerts`). The whole
 * point of the assertions these feed is *where the colour changes*, so a fixture
 * that spelled out `thresholdLevel: 'warning'` by hand would just be asserting
 * the fixture back at itself - it would keep passing even if the server moved
 * the threshold from 80% to something else, and that is precisely the regression
 * these tests exist to catch.
 *
 * `budgetMath.js` has no Prisma import, so it loads in jsdom with nothing mocked.
 */

const DEFAULT_CATEGORY = { id: 'cat-food', name: 'Food & Dining' };

/**
 * @param {object} overrides  Fields of the stored row: `spent`, `limitAmount`,
 *                            `period`, `category`. Everything else is filled in.
 * @returns {object} The exact payload GET /api/budgets returns for one budget.
 */
export function budgetFixture({
  id = 'budget-1',
  userId = 'user-1',
  period = '2026-10',
  limitAmount = 100000,
  spent = 0,
  category = DEFAULT_CATEGORY,
} = {}) {
  return toBudgetView({
    id,
    userId,
    categoryId: category.id,
    period,
    limitAmount,
    spent,
    category,
  });
}

/** A row of distinct budgets, each at its own utilization. */
export function budgetRow(specs) {
  return specs.map((spec, index) =>
    budgetFixture({ id: `budget-${index + 1}`, ...spec }),
  );
}
