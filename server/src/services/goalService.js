import prisma from '../lib/prismaClient.js';
import { NotFoundError } from '../lib/errors.js';
import {
  calculateRequiredMonthlyContribution,
  getMonthsUntilDeadline,
  toGoalView,
} from './goalMath.js';

/**
 * Savings-goal CRUD.
 *
 * Business logic only: the controller validates and shapes the response, and
 * this layer owns ownership scoping and the database calls. The maths lives in
 * `goalMath.js` and is re-exported below, so
 * `import { calculateRequiredMonthlyContribution } from './goalService.js'`
 * works and callers have one import for the whole feature.
 *
 * Every query is scoped by `userId` as well as `id`. A goal belonging to
 * someone else gets the same 404 as a goal that does not exist - a 403 would
 * confirm that the id is real and belongs to another account.
 *
 * Money is integer paise end to end (conventions.md, "Money handling"):
 * nothing here parses, converts or formats a rupee amount.
 */

export {
  calculateRequiredMonthlyContribution,
  getMonthsUntilDeadline,
  toGoalView,
};

/**
 * Creates a goal for the authenticated user.
 *
 * `savedAmount` is optional and starts at 0: creating a goal does not mean the
 * user has already put something aside, but allowing a starting amount means an
 * existing goal can be recorded without inventing a contribution history.
 *
 * The deadline arrives as `YYYY-MM-DD` from the validator. `new Date(...)`
 * parses it as UTC midnight, which is what Prisma's `@db.Date` column stores;
 * the maths reads it back as a UTC calendar date for the same reason.
 *
 * @param {string} userId
 * @param {{ name: string, targetAmount: number, savedAmount?: number,
 *   deadline: string|Date }} data  Already validated by goalValidator.
 * @returns {Promise<object>} The created goal with derived fields.
 */
export async function createGoal(userId, data) {
  const goal = await prisma.savingsGoal.create({
    data: {
      userId,
      name: data.name,
      targetAmount: data.targetAmount,
      savedAmount: data.savedAmount ?? 0,
      deadline: new Date(data.deadline),
    },
  });

  return toGoalView(goal);
}

/**
 * Lists a user's goals, soonest deadline first so the most urgent goal is at
 * the top of the page.
 *
 * @param {string} userId
 * @returns {Promise<object[]>} Goals with derived fields attached.
 */
export async function getGoalsForUser(userId) {
  const goals = await prisma.savingsGoal.findMany({
    where: { userId },
    orderBy: [{ deadline: 'asc' }, { name: 'asc' }],
  });

  return goals.map((goal) => toGoalView(goal));
}

/**
 * Reads one goal, scoped to its owner.
 *
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<object>} The goal with derived fields.
 * @throws {NotFoundError} if it does not exist or belongs to another user.
 */
export async function getGoal(userId, id) {
  const goal = await prisma.savingsGoal.findFirst({
    where: { id, userId },
  });

  if (!goal) throw new NotFoundError('Savings goal not found');

  return toGoalView(goal);
}

/**
 * Updates any subset of a goal's editable fields.
 *
 * `userId` is never editable and unknown keys are stripped by the validator,
 * so a client cannot move a goal to another account. Only provided fields are
 * written; a PATCH that changes one field must not blank the others.
 *
 * @param {string} userId
 * @param {string} id
 * @param {{ name?: string, targetAmount?: number, savedAmount?: number,
 *   deadline?: string|Date }} data
 * @returns {Promise<object>} The updated goal with derived fields.
 * @throws {NotFoundError} if it does not exist or belongs to another user.
 */
export async function updateGoal(userId, id, data) {
  const existing = await prisma.savingsGoal.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Savings goal not found');

  const goal = await prisma.savingsGoal.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.targetAmount !== undefined
        ? { targetAmount: data.targetAmount }
        : {}),
      ...(data.savedAmount !== undefined
        ? { savedAmount: data.savedAmount }
        : {}),
      ...(data.deadline !== undefined
        ? { deadline: new Date(data.deadline) }
        : {}),
    },
  });

  return toGoalView(goal);
}

/**
 * Deletes a goal, scoped to its owner.
 *
 * Hard delete: a SavingsGoal has no children, and keeping a soft-deleted row
 * would make every list query and every "is this id mine" check filter on it.
 *
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 * @throws {NotFoundError} if it does not exist or belongs to another user.
 */
export async function deleteGoal(userId, id) {
  const existing = await prisma.savingsGoal.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Savings goal not found');

  await prisma.savingsGoal.delete({ where: { id } });
}
