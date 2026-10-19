import { z } from 'zod';

import { isoDate, nonNegativePaise, paise, uuid } from './commonValidator.js';

/**
 * Request schemas for the savings-goal routes.
 *
 * Amounts follow the same integer-paise rule as transactions and budgets: the
 * client sends 1000000 for ₹10,000.00, never 10000.0. `savedAmount` uses the
 * non-negative variant because a goal can legitimately start at zero, while
 * `targetAmount` uses the shared positive one because a zero target has no
 * meaningful completion.
 *
 * Deadlines are calendar dates (`YYYY-MM-DD`). A past deadline is allowed on
 * purpose: a goal that has already missed its date still needs to be
 * representable, and the service reports it as overdue with the whole
 * remainder due now. Rejecting it here would make that edge case unreachable.
 */

/**
 * Stricter than `isoDate` alone: `Date.parse('2027-02-30')` rolls over into
 * March instead of failing, so the parts are round-tripped through Date.UTC to
 * prove the date is real.
 */
const deadline = isoDate.refine((value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}, 'Deadline must be a real calendar date');

const goalFields = {
  name: z.string().trim().min(1, 'Name is required').max(100),
  targetAmount: paise,
  savedAmount: nonNegativePaise,
  deadline,
};

export const createGoalSchema = z.object({
  ...goalFields,
  savedAmount: goalFields.savedAmount.default(0),
});

/**
 * Partial update. At least one field is required, otherwise a PATCH would
 * quietly do nothing and answer 200, which reads like a successful change.
 */
export const updateGoalSchema = z
  .object({
    name: goalFields.name.optional(),
    targetAmount: goalFields.targetAmount.optional(),
    savedAmount: goalFields.savedAmount.optional(),
    deadline: goalFields.deadline.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const idParamSchema = z.object({ id: uuid });
