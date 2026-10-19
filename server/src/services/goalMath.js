/**
 * The pure half of savings-goal logic: deadline arithmetic, the required
 * monthly contribution, and the API projection built from them.
 *
 * Split out of `goalService.js` for the same reason `budgetMath.js` is split
 * out of `budgetService.js`: none of this touches Prisma, so it can be tested
 * with literals and no database mock. `goalService.js` re-exports everything
 * here, so callers can import the whole feature from one place.
 *
 * Money is integer paise end to end (conventions.md, "Money handling"). The
 * contribution is rounded UP to a whole paisa: rounding down would leave the
 * goal a paisa (or more) short at the deadline, and there is no such thing as a
 * fractional paisa to make up the difference.
 *
 * Calendar dates are compared in UTC, matching `periodForDate` in
 * `budgetMath.js`. That keeps the month a deadline falls in independent of the
 * server's timezone; a deadline is a calendar date, not an instant.
 */

import { ValidationError } from '../lib/errors.js';

/**
 * Normalises anything date-like to a UTC midnight Date.
 *
 * A `YYYY-MM-DD` string is treated as a calendar date, not as an instant:
 * `new Date('2027-01-31')` already parses as UTC midnight, but building it from
 * its parts additionally lets this reject impossible dates such as 2027-02-30,
 * which `Date.parse` silently rolls into March.
 *
 * @param {Date|string} value
 * @param {string} field  Human-readable name, used in the error message.
 * @returns {Date} A Date at 00:00:00.000 UTC.
 * @throws {ValidationError} if the value is not a real calendar date.
 */
function toCalendarDate(value, field) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ValidationError(`${field} must be a valid date`);
    }
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  if (typeof value === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2]);
      const day = Number(dateOnly[3]);
      const date = new Date(Date.UTC(year, month - 1, day));

      // Date.UTC normalises out-of-range parts (Feb 30 -> Mar 2), so compare
      // the parts back: only a round trip proves the date was real.
      if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        throw new ValidationError(`${field} must be a real calendar date`);
      }

      return date;
    }

    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return new Date(
        Date.UTC(
          parsed.getUTCFullYear(),
          parsed.getUTCMonth(),
          parsed.getUTCDate(),
        ),
      );
    }
  }

  throw new ValidationError(`${field} must be a valid date`);
}

/**
 * Whole monthly contributions left between now and the deadline.
 *
 * - a deadline earlier than today -> 0 (overdue; nothing left to spread over)
 * - a deadline later today or later this month -> 1 (this month's contribution)
 * - otherwise -> the calendar-month difference, so Oct 19 -> Jan 31 is 3
 *
 * "Deadline this month" is deliberately 1 rather than 0. The user still has
 * this month in which to save, so the remainder is due in one contribution.
 *
 * @param {Date|string} deadline
 * @param {Date|string} [now]  Defaults to the current instant. Pass a fixed
 *   value to make the result deterministic.
 * @returns {number} 0 when overdue, otherwise an integer >= 1.
 */
export function getMonthsUntilDeadline(deadline, now = new Date()) {
  const deadlineDate = toCalendarDate(deadline, 'Deadline');
  const today = toCalendarDate(now, 'Current date');

  if (deadlineDate.getTime() < today.getTime()) return 0;

  const months =
    (deadlineDate.getUTCFullYear() - today.getUTCFullYear()) * 12 +
    (deadlineDate.getUTCMonth() - today.getUTCMonth());

  // Same month (or the deadline is today): one contribution is still possible.
  return Math.max(months, 1);
}

/**
 * Validates a paise field on a goal.
 *
 * The request validator already enforces this; the check is repeated here
 * because the function is exported and callable directly, and a fractional or
 * negative amount would otherwise turn into a fractional contribution.
 */
function assertPaise(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${field} must be a non-negative integer`);
  }
}

/**
 * The amount that must be put aside each month to reach the goal by its
 * deadline: `(targetAmount - savedAmount) / monthsUntil(deadline)`.
 *
 * Edge cases, deliberately:
 * - goal already met (saved >= target) -> 0, even if the deadline has passed
 * - deadline in the past and goal unmet -> the whole remainder, because there
 *   are no future months to spread it over and returning 0 would claim nothing
 *   more is needed
 * - deadline this month or today -> the whole remainder (one month left)
 *
 * Rounds up to a whole paisa, via integer arithmetic, so the monthly amounts
 * always sum to at least the remainder and the goal is not left one paisa
 * short. `(remaining + months - 1) / months` is ceil(remaining / months)
 * without relying on a floating-point division for the decision.
 *
 * @param {{ targetAmount: number, savedAmount?: number, deadline: Date|string }} goal
 * @param {Date|string} [now]  Defaults to the current instant.
 * @returns {number} Integer paise; 0 when the goal is met.
 * @throws {ValidationError} for a missing/invalid goal or malformed amounts.
 */
export function calculateRequiredMonthlyContribution(goal, now = new Date()) {
  if (!goal || typeof goal !== 'object') {
    throw new ValidationError('Goal is required');
  }

  const savedAmount = goal.savedAmount ?? 0;
  assertPaise(goal.targetAmount, 'Target amount');
  assertPaise(savedAmount, 'Saved amount');

  const remaining = goal.targetAmount - savedAmount;
  if (remaining <= 0) return 0;

  const months = getMonthsUntilDeadline(goal.deadline, now);

  // Overdue: the whole remainder is due now. This is the only sensible answer
  // once there are no months left to divide by - dividing by zero would give
  // Infinity, and 0 would say the goal needs nothing more.
  if (months === 0) return remaining;

  return Math.floor((remaining + months - 1) / months);
}

/**
 * Projects the stored columns onto the API shape, adding the derived fields.
 *
 * The contribution is never stored (database-schema.md): it is recomputed on
 * every read, so a goal's advice is always current rather than frozen at the
 * moment it was created.
 *
 * `progressPercent` is rounded to 2dp and is NOT capped at 100 - a user who has
 * saved more than the target should see that, not a silently clamped 100.
 *
 * @param {object} goal  A SavingsGoal row (deadline may be a Date or string).
 * @param {Date|string} [now]
 * @returns {object} The row plus remainingAmount, monthsRemaining,
 *   requiredMonthlyContribution, progressPercent, isAchieved and isOverdue.
 */
export function toGoalView(goal, now = new Date()) {
  const savedAmount = goal.savedAmount ?? 0;
  const remainingAmount = Math.max(goal.targetAmount - savedAmount, 0);
  const monthsRemaining = getMonthsUntilDeadline(goal.deadline, now);
  const requiredMonthlyContribution = calculateRequiredMonthlyContribution(
    { ...goal, savedAmount },
    now,
  );

  const progress = goal.targetAmount > 0 ? savedAmount / goal.targetAmount : 0;

  return {
    ...goal,
    savedAmount,
    remainingAmount,
    monthsRemaining,
    requiredMonthlyContribution,
    progressPercent: Math.round(progress * 10000) / 100,
    isAchieved: remainingAmount === 0,
    isOverdue: monthsRemaining === 0 && remainingAmount > 0,
  };
}
