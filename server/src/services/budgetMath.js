/**
 * The pure half of budget logic: utilization, threshold bands, and the API
 * shape derived from them.
 *
 * Split out of `budgetService.js` because that module imports Prisma and the
 * database client, and none of the maths below touches either. Keeping the two
 * apart means this file can be imported - and unit tested - with no database
 * mocks and no generated client, and it lets the client's own component tests
 * build fixtures from the exact function that ships, rather than from a
 * hand-copied reimplementation of the thresholds that could quietly drift away
 * from them.
 *
 * `budgetService.js` re-exports everything here, so callers that already
 * import from the service are unaffected.
 *
 * Money is integer paise end to end (conventions.md, "Money handling"): nothing
 * here parses, divides or converts a rupee amount.
 */

/** Alert levels, in the order a budget climbs through them. */
export const THRESHOLD_APPROACHING = 'approaching';
export const THRESHOLD_EXCEEDED = 'exceeded';
export const THRESHOLD_OK = 'ok';

/** utilization >= 0.80 -> "approaching budget" alert (features.md). */
export const APPROACHING_THRESHOLD = 0.8;
/** utilization >= 1.00 -> "budget exceeded" alert. */
export const EXCEEDED_THRESHOLD = 1;

/**
 * The "YYYY-MM" period a date falls in, using UTC so the bucket a transaction
 * lands in does not depend on the server's timezone.
 *
 * Pure: no clock, no database, no locale. The month comes from the caller's
 * date rather than `new Date()` on purpose - a transaction entered for last
 * month belongs to last month's budget.
 */
export function periodForDate(date) {
  const value = date instanceof Date ? date : new Date(date);
  const year = value.getUTCFullYear().toString().padStart(4, '0');
  const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Fraction of a budget that has been spent. 1 means exactly spent.
 *
 * A zero or negative limit has no meaningful ratio, so it yields 0 rather than
 * Infinity or NaN. The schema refuses a non-positive limitAmount, so this only
 * guards a direct service call or a legacy row.
 */
export function calculateUtilization(spent, limitAmount) {
  if (!limitAmount || limitAmount <= 0) return 0;
  return spent / limitAmount;
}

/**
 * Threshold state for a budget, as a pure function of its two numbers.
 *
 * Returns both the level and the alerts that produced it, so a caller can render
 * "over budget" without re-deriving the comparison, and a caller that wants
 * only a boolean can read `exceeded`.
 *
 * 0.8 and 1 are `>=` on purpose: hitting 80% of a budget exactly is the alert
 * firing, not one paisa short of it.
 */
export function evaluateThresholds(spent, limitAmount) {
  const utilization = calculateUtilization(spent, limitAmount);

  const alerts = [];
  if (utilization >= APPROACHING_THRESHOLD) alerts.push(APPROACHING_THRESHOLD);
  if (utilization >= EXCEEDED_THRESHOLD) alerts.push(EXCEEDED_THRESHOLD);

  const level =
    utilization >= EXCEEDED_THRESHOLD
      ? THRESHOLD_EXCEEDED
      : utilization >= APPROACHING_THRESHOLD
        ? THRESHOLD_APPROACHING
        : THRESHOLD_OK;

  return { utilization, level, alerts };
}

/**
 * Projects the stored columns onto the API shape, adding the derived fields.
 *
 * Exported so the transaction path can describe a budget it has not loaded.
 */
export function toBudgetView(budget) {
  const { category, ...rest } = budget;
  const { utilization, level, alerts } = evaluateThresholds(
    budget.spent,
    budget.limitAmount,
  );

  return {
    ...rest,
    ...(category ? { category } : {}),
    remainingAmount: Math.max(budget.limitAmount - budget.spent, 0),
    utilization,
    utilizationPercent: Math.round(utilization * 10000) / 100,
    thresholdLevel: level,
    alerts,
  };
}
