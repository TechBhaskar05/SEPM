import { Prisma } from '../generated/prisma/index.js';

import prisma from '../lib/prismaClient.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../lib/errors.js';
import {
  APPROACHING_THRESHOLD,
  EXCEEDED_THRESHOLD,
  THRESHOLD_APPROACHING,
  THRESHOLD_EXCEEDED,
  THRESHOLD_OK,
  calculateUtilization,
  evaluateThresholds,
  periodForDate,
  toBudgetView,
} from './budgetMath.js';

/**
 * Budget CRUD and the concurrency-safe spend increment.
 *
 * The utilization and threshold maths lives in `budgetMath.js` and is
 * re-exported below, so `import { evaluateThresholds } from './budgetService.js'`
 * keeps working for callers that want both halves from one place.
 *
 * Money is integer paise end to end (conventions.md, "Money handling"):
 * nothing here parses, divides or converts a rupee amount.
 *
 * Spend is only ever moved with an atomic `{ increment }`. The
 * read-then-write form conventions.md forbids loses updates whenever two
 * requests touch one budget, which is the normal case rather than a rare race.
 */

export {
  APPROACHING_THRESHOLD,
  EXCEEDED_THRESHOLD,
  THRESHOLD_APPROACHING,
  THRESHOLD_EXCEEDED,
  THRESHOLD_OK,
  calculateUtilization,
  evaluateThresholds,
  periodForDate,
  toBudgetView,
};

/** Shape sent to the client for a budget, including the derived fields. */
const CATEGORY_SELECT = { select: { id: true, name: true } };

/**
 * Adds `amount` paise to a budget's spend in a single atomic statement.
 *
 * The increment is evaluated by Postgres inside the statement, so N concurrent
 * calls all land - none reads a stale `spent`. The service takes the client as
 * an argument so the caller can hand it a `$transaction` handle and get the
 * increment committed atomically with its own writes; without one it uses the
 * shared client.
 *
 * This is deliberately NOT `budget = get(); budget.spent += amount; save()`.
 *
 * @param {string} budgetId
 * @param {number} amount  Paise to add. Must be a positive integer.
 * @param {object} [client] Prisma client or `$transaction` handle.
 * @returns {Promise<object>} The updated budget row, projected for the API.
 * @throws {ValidationError} if `amount` is not a positive integer.
 * @throws {NotFoundError} if the budget does not exist.
 */
export async function applyTransactionToBudget(
  budgetId,
  amount,
  client = prisma,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new ValidationError('Budget increment must be a positive integer');
  }

  try {
    const budget = await client.budget.update({
      where: { id: budgetId },
      // One statement, one round trip, evaluated by the database. `spent` is
      // never read into JS first, so nothing here can interleave.
      data: { spent: { increment: amount } },
      include: { category: CATEGORY_SELECT },
    });
    return toBudgetView(budget);
  } catch (error) {
    // P2025 = "record to update not found". Only Prisma can raise it here, so
    // anything else is a real fault and is left to the error handler.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundError('Budget not found');
    }
    throw error;
  }
}

/**
 * Creates a monthly budget for one category.
 *
 * The unique constraint on (userId, categoryId, period) is the real guarantee
 * against duplicates; the explicit check below exists to return a message that
 * says which field collided instead of the generic 409 the error handler emits
 * for P2002. It narrows the race window, it does not close it.
 */
export async function createBudget(
  userId,
  { categoryId, period, limitAmount },
) {
  await assertCategoryUsable(userId, categoryId);

  const existing = await prisma.budget.findUnique({
    where: { userId_categoryId_period: { userId, categoryId, period } },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError(
      'A budget for this category and period already exists',
    );
  }

  try {
    const budget = await prisma.budget.create({
      data: { userId, categoryId, period, limitAmount, spent: 0 },
      include: { category: CATEGORY_SELECT },
    });
    return toBudgetView(budget);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      // Two creates raced past the check above; the constraint settled it.
      throw new ConflictError(
        'A budget for this category and period already exists',
      );
    }
    throw error;
  }
}

/**
 * Lists a user's budgets, newest period first, each with its utilization.
 *
 * @param {string} userId
 * @param {object} [filters] `{ period, categoryId }`; both optional, and an
 *   absent `period` returns every period the user has.
 */
export async function getBudgetsForUser(userId, { period, categoryId } = {}) {
  const budgets = await prisma.budget.findMany({
    where: {
      userId,
      ...(period ? { period } : {}),
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: [{ period: 'desc' }, { limitAmount: 'desc' }],
    include: { category: CATEGORY_SELECT },
  });

  return budgets.map(toBudgetView);
}

/** One budget, scoped to its owner. 404 rather than 403 for someone else's id. */
export async function getBudget(userId, id) {
  const budget = await prisma.budget.findFirst({
    where: { id, userId },
    include: { category: CATEGORY_SELECT },
  });

  if (!budget) throw new NotFoundError('Budget not found');

  return toBudgetView(budget);
}

/**
 * Updates a budget's limit. `spent` is not editable - it is a running total
 * owned by transactionService, and accepting a client value for it would undo
 * every atomicity guarantee the column has.
 */
export async function updateBudget(userId, id, { limitAmount }) {
  const existing = await prisma.budget.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Budget not found');

  const budget = await prisma.budget.update({
    where: { id },
    data: { limitAmount },
    include: { category: CATEGORY_SELECT },
  });

  return toBudgetView(budget);
}

/** Deletes a budget. Its transactions are untouched - they only ever joined it. */
export async function deleteBudget(userId, id) {
  const existing = await prisma.budget.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Budget not found');

  await prisma.budget.delete({ where: { id } });
}

/**
 * A budget may only be attached to a category the user owns, or to a system
 * category (userId null). Anything else would either 404 on the FK or, worse,
 * let one user budget against another user's category.
 */
async function assertCategoryUsable(userId, categoryId) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, userId: true },
  });

  // One message for "no such category" and "not yours": distinguishing them
  // confirms the existence of another user's category id.
  if (!category || (category.userId !== null && category.userId !== userId)) {
    throw new ValidationError('Category not found');
  }
}
