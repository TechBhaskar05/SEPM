import { toGoalView } from '../../../server/src/services/goalMath.js';

/**
 * Goal fixtures for the client tests.
 *
 * Like the budget fixtures, these go through the server's real `toGoalView`
 * instead of hand-writing `requiredMonthlyContribution`, `progressPercent`,
 * `isAchieved` and `isOverdue`. Those derived fields are exactly what the card
 * renders, so a hand-written fixture would assert itself back at the test and
 * would keep passing if the service changed its rounding or overdue rules.
 *
 * `goalMath.js` has no Prisma import, so it loads in jsdom with nothing mocked.
 *
 * The fixed `now` is 19 Oct 2026, which makes the default deadline (31 Jan
 * 2027) three monthly contributions away.
 */
const NOW = '2026-10-19T12:00:00.000Z';

/**
 * @param {object} overrides  Fields of the stored row: `name`, `targetAmount`,
 *                            `savedAmount`, `deadline`. Everything else is
 *                            filled in.
 * @returns {object} The exact payload GET /api/savings-goals returns.
 */
export function goalFixture({
  id = 'goal-1',
  userId = 'user-1',
  name = 'Japan trip',
  targetAmount = 1000000,
  savedAmount = 250000,
  deadline = '2027-01-31',
  ...rest
} = {}) {
  return toGoalView(
    {
      id,
      userId,
      name,
      targetAmount,
      savedAmount,
      deadline,
      ...rest,
    },
    NOW,
  );
}
