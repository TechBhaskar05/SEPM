import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Savings-goal maths and CRUD.
 *
 * `calculateRequiredMonthlyContribution`, `getMonthsUntilDeadline` and
 * `toGoalView` take plain values and a fixed `now`, so they are asserted with
 * literals and no database in between. The service tests use a mocked Prisma
 * client and a frozen clock: the contribution defaults to "today", and a test
 * that quietly changed meaning next month would be worse than no test.
 */

vi.mock('../../src/lib/prismaClient.js', () => ({
  default: {
    savingsGoal: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const prisma = (await import('../../src/lib/prismaClient.js')).default;
const {
  calculateRequiredMonthlyContribution,
  createGoal,
  deleteGoal,
  getGoal,
  getGoalsForUser,
  getMonthsUntilDeadline,
  toGoalView,
  updateGoal,
} = await import('../../src/services/goalService.js');
const { createGoalSchema, updateGoalSchema } =
  await import('../../src/validators/goalValidator.js');

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '99999999-9999-9999-9999-999999999999';
const GOAL_ID = '55555555-5555-5555-5555-555555555555';
const OTHER_GOAL_ID = '66666666-6666-6666-6666-666666666666';

/** A Wednesday, well away from month boundaries. */
const NOW = new Date('2026-10-19T12:00:00.000Z');

function goalRow(overrides = {}) {
  return {
    id: GOAL_ID,
    userId: USER_ID,
    name: 'New laptop',
    targetAmount: 1000000, // ₹10,000
    savedAmount: 250000, // ₹2,500
    deadline: new Date('2027-01-31T00:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Freeze "today" for the service path, which derives the contribution from
  // the current date. The pure suites pass NOW explicitly instead.
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * The four scenarios the contribution function is specified against.
 *
 * Each asserts the exact value AND that the result is a finite, non-negative
 * integer. The extra assertions matter for the overdue case: an exact-value
 * check alone on a divide-by-zero bug would pass only if it expected Infinity,
 * and nothing here should ever be able to produce that.
 */
describe('calculateRequiredMonthlyContribution — specified edge cases', () => {
  it('a goal several months out amortises the remainder', () => {
    // Oct 19 2026 -> Jan 31 2027 is 3 calendar months.
    // 1,000,000 - 250,000 = 750,000 paise, so 250,000 paise/month.
    const result = calculateRequiredMonthlyContribution(goalRow(), NOW);

    expect(result).toBe(250000);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('a goal due this month requires the whole remainder', () => {
    const result = calculateRequiredMonthlyContribution(
      goalRow({ deadline: '2026-10-31' }),
      NOW,
    );

    expect(result).toBe(750000);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('a goal with a past deadline requires the whole remainder, not 0', () => {
    // Decided behaviour: there are no months left to spread the remainder
    // over, so the full 750,000 paise is due now. Returning 0 would claim the
    // goal needs nothing more; dividing by zero would give Infinity.
    const result = calculateRequiredMonthlyContribution(
      goalRow({ deadline: '2026-09-30' }),
      NOW,
    );

    expect(result).toBe(750000);
    expect(Number.isFinite(result)).toBe(true);
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('a goal already fully saved requires 0', () => {
    const result = calculateRequiredMonthlyContribution(
      goalRow({ savedAmount: 1000000 }),
      NOW,
    );

    expect(result).toBe(0);
    expect(result).toBeGreaterThanOrEqual(0);
  });
});

describe('calculateRequiredMonthlyContribution — pure', () => {
  it('rounds up to the next whole paisa so the goal is never short', () => {
    // 100000 / 3 = 33333.33 -> 33334, not 33333.
    expect(
      calculateRequiredMonthlyContribution(
        goalRow({ savedAmount: 900000 }),
        NOW,
      ),
    ).toBe(33334);
  });

  it('requires the whole remainder on the deadline day', () => {
    expect(
      calculateRequiredMonthlyContribution(
        goalRow({ deadline: new Date('2026-10-19T00:00:00.000Z') }),
        NOW,
      ),
    ).toBe(750000);
  });

  it('requires the whole remainder when the deadline was in a previous month', () => {
    expect(
      calculateRequiredMonthlyContribution(
        goalRow({ deadline: new Date('2025-12-31T00:00:00.000Z') }),
        NOW,
      ),
    ).toBe(750000);
  });

  it('returns 0 when the goal is over-saved', () => {
    expect(
      calculateRequiredMonthlyContribution(
        goalRow({ savedAmount: 1200000 }),
        NOW,
      ),
    ).toBe(0);
  });

  it('returns 0 for a met goal even after the deadline', () => {
    expect(
      calculateRequiredMonthlyContribution(
        goalRow({
          savedAmount: 1000000,
          deadline: new Date('2020-01-01T00:00:00.000Z'),
        }),
        NOW,
      ),
    ).toBe(0);
  });

  it('never returns a fractional paisa', () => {
    // One paisa spread over three months still needs one paisa each month.
    expect(
      calculateRequiredMonthlyContribution(
        goalRow({ targetAmount: 1000000, savedAmount: 999999 }),
        NOW,
      ),
    ).toBe(1);
  });

  it('counts a deadline next month as one month', () => {
    expect(
      calculateRequiredMonthlyContribution(
        goalRow({ deadline: new Date('2026-11-01T00:00:00.000Z') }),
        NOW,
      ),
    ).toBe(750000);
  });

  it('handles the year boundary', () => {
    // Dec 15 -> Feb 1 is 2 calendar months.
    expect(
      calculateRequiredMonthlyContribution(
        goalRow({ deadline: new Date('2027-02-01T00:00:00.000Z') }),
        new Date('2026-12-15T00:00:00.000Z'),
      ),
    ).toBe(375000);
  });

  it('accepts a date-only deadline string', () => {
    expect(
      calculateRequiredMonthlyContribution(
        { ...goalRow(), deadline: '2027-01-31' },
        NOW,
      ),
    ).toBe(250000);
  });

  it('rejects a non-integer amount rather than rounding it', () => {
    expect(() =>
      calculateRequiredMonthlyContribution(
        goalRow({ targetAmount: 1000000.5 }),
        NOW,
      ),
    ).toThrow(/non-negative integer/i);
  });

  it('rejects a negative saved amount', () => {
    expect(() =>
      calculateRequiredMonthlyContribution(goalRow({ savedAmount: -1 }), NOW),
    ).toThrow(/non-negative integer/i);
  });

  it('rejects an impossible calendar date', () => {
    expect(() =>
      calculateRequiredMonthlyContribution(
        goalRow({ deadline: '2027-02-30' }),
        NOW,
      ),
    ).toThrow(/real calendar date/i);
  });

  it('rejects a missing goal or deadline', () => {
    expect(() => calculateRequiredMonthlyContribution(null, NOW)).toThrow(
      /Goal is required/i,
    );
    expect(() =>
      calculateRequiredMonthlyContribution(
        { targetAmount: 1000, savedAmount: 0 },
        NOW,
      ),
    ).toThrow(/valid date/i);
  });
});

describe('getMonthsUntilDeadline — pure', () => {
  it('is 0 once the deadline has passed', () => {
    expect(getMonthsUntilDeadline('2026-10-18', NOW)).toBe(0);
  });

  it('is 1 on the deadline day', () => {
    expect(getMonthsUntilDeadline('2026-10-19', NOW)).toBe(1);
  });

  it('is 1 for a later day in the current month', () => {
    expect(getMonthsUntilDeadline('2026-10-31', NOW)).toBe(1);
  });

  it('is the calendar-month difference for a future deadline', () => {
    expect(getMonthsUntilDeadline('2027-01-31', NOW)).toBe(3);
  });

  it('crosses the year boundary correctly', () => {
    expect(getMonthsUntilDeadline('2027-02-01', '2026-12-15')).toBe(2);
  });

  it('accepts Date objects as well as strings', () => {
    expect(
      getMonthsUntilDeadline(new Date('2027-01-31T00:00:00.000Z'), NOW),
    ).toBe(3);
  });
});

describe('toGoalView — derived fields', () => {
  it('adds the contribution, months left and progress', () => {
    const view = toGoalView(goalRow(), NOW);

    expect(view.remainingAmount).toBe(750000);
    expect(view.monthsRemaining).toBe(3);
    expect(view.requiredMonthlyContribution).toBe(250000);
    expect(view.progressPercent).toBe(25);
    expect(view.isAchieved).toBe(false);
    expect(view.isOverdue).toBe(false);
  });

  it('keeps the stored paise columns untouched', () => {
    const view = toGoalView(goalRow(), NOW);
    expect(view.targetAmount).toBe(1000000);
    expect(view.savedAmount).toBe(250000);
  });

  it('flags an overdue goal and requires the whole remainder', () => {
    const view = toGoalView(
      goalRow({ deadline: new Date('2026-09-30T00:00:00.000Z') }),
      NOW,
    );

    expect(view.monthsRemaining).toBe(0);
    expect(view.isOverdue).toBe(true);
    expect(view.requiredMonthlyContribution).toBe(750000);
  });

  it('flags a met goal as achieved, not overdue, even past its deadline', () => {
    const view = toGoalView(
      goalRow({
        savedAmount: 1000000,
        deadline: new Date('2020-01-01T00:00:00.000Z'),
      }),
      NOW,
    );

    expect(view.remainingAmount).toBe(0);
    expect(view.requiredMonthlyContribution).toBe(0);
    expect(view.isAchieved).toBe(true);
    expect(view.isOverdue).toBe(false);
  });

  it('rounds progressPercent to 2dp', () => {
    const view = toGoalView(goalRow({ savedAmount: 333333 }), NOW);
    expect(view.progressPercent).toBe(33.33);
  });

  it('shows over-saving above 100% rather than clamping it', () => {
    const view = toGoalView(goalRow({ savedAmount: 1250000 }), NOW);
    expect(view.progressPercent).toBe(125);
  });
});

describe('goalValidator', () => {
  it('defaults savedAmount to 0', () => {
    const parsed = createGoalSchema.parse({
      name: '  Japan trip  ',
      targetAmount: 5000000,
      deadline: '2027-03-31',
    });

    expect(parsed).toEqual({
      name: 'Japan trip',
      targetAmount: 5000000,
      savedAmount: 0,
      deadline: '2027-03-31',
    });
  });

  it('rejects a fractional amount', () => {
    expect(() =>
      createGoalSchema.parse({
        name: 'Trip',
        targetAmount: 5000.5,
        deadline: '2027-03-31',
      }),
    ).toThrow(/integer/i);
  });

  it('rejects a negative savedAmount', () => {
    expect(() =>
      createGoalSchema.parse({
        name: 'Trip',
        targetAmount: 5000,
        savedAmount: -1,
        deadline: '2027-03-31',
      }),
    ).toThrow(/negative/i);
  });

  it('rejects an impossible calendar date', () => {
    expect(() =>
      createGoalSchema.parse({
        name: 'Trip',
        targetAmount: 5000,
        deadline: '2027-02-30',
      }),
    ).toThrow(/real calendar date/i);
  });

  it('accepts a past deadline, so an overdue goal is representable', () => {
    expect(() =>
      createGoalSchema.parse({
        name: 'Old goal',
        targetAmount: 5000,
        deadline: '2020-01-01',
      }),
    ).not.toThrow();
  });

  it('rejects an empty PATCH body', () => {
    expect(() => updateGoalSchema.parse({})).toThrow(/at least one field/i);
  });

  it('accepts a single-field PATCH', () => {
    expect(updateGoalSchema.parse({ savedAmount: 1000 })).toEqual({
      savedAmount: 1000,
    });
  });

  it('strips unknown keys such as userId', () => {
    const parsed = updateGoalSchema.parse({
      savedAmount: 1000,
      userId: OTHER_USER_ID,
    });
    expect(parsed).toEqual({ savedAmount: 1000 });
  });
});

function savedGoal(overrides = {}) {
  return goalRow(overrides);
}

describe('createGoal', () => {
  it('creates the row for the authenticated user and returns the view', async () => {
    prisma.savingsGoal.create.mockResolvedValue(savedGoal({ savedAmount: 0 }));

    const goal = await createGoal(USER_ID, {
      name: 'New laptop',
      targetAmount: 1000000,
      deadline: '2027-01-31',
    });

    expect(prisma.savingsGoal.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        name: 'New laptop',
        targetAmount: 1000000,
        savedAmount: 0,
        deadline: new Date('2027-01-31'),
      },
    });
    expect(goal.requiredMonthlyContribution).toBe(333334);
    expect(goal.monthsRemaining).toBe(3);
  });

  it('keeps a starting savedAmount instead of forcing zero', async () => {
    prisma.savingsGoal.create.mockResolvedValue(savedGoal());

    await createGoal(USER_ID, {
      name: 'New laptop',
      targetAmount: 1000000,
      savedAmount: 250000,
      deadline: '2027-01-31',
    });

    expect(prisma.savingsGoal.create.mock.calls[0][0].data.savedAmount).toBe(
      250000,
    );
  });
});

describe('getGoalsForUser', () => {
  it('scopes the query to the user and orders by soonest deadline', async () => {
    prisma.savingsGoal.findMany.mockResolvedValue([goalRow()]);

    const goals = await getGoalsForUser(USER_ID);

    expect(prisma.savingsGoal.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: [{ deadline: 'asc' }, { name: 'asc' }],
    });
    expect(goals).toHaveLength(1);
    expect(goals[0].requiredMonthlyContribution).toBe(250000);
  });

  it('returns an empty list rather than throwing when there are no goals', async () => {
    prisma.savingsGoal.findMany.mockResolvedValue([]);
    await expect(getGoalsForUser(USER_ID)).resolves.toEqual([]);
  });

  it('maps every row through toGoalView', async () => {
    prisma.savingsGoal.findMany.mockResolvedValue([
      goalRow(),
      goalRow({
        id: OTHER_GOAL_ID,
        savedAmount: 0,
        deadline: new Date('2026-11-30T00:00:00.000Z'),
      }),
    ]);

    const goals = await getGoalsForUser(USER_ID);

    expect(goals[1].monthsRemaining).toBe(1);
    expect(goals[1].requiredMonthlyContribution).toBe(1000000);
  });
});

describe('getGoal', () => {
  it('looks the goal up by id AND user, so another account cannot read it', async () => {
    prisma.savingsGoal.findFirst.mockResolvedValue(goalRow());

    const goal = await getGoal(USER_ID, GOAL_ID);

    expect(prisma.savingsGoal.findFirst).toHaveBeenCalledWith({
      where: { id: GOAL_ID, userId: USER_ID },
    });
    expect(goal.id).toBe(GOAL_ID);
  });

  it('maps a missing or foreign goal to a 404', async () => {
    prisma.savingsGoal.findFirst.mockResolvedValue(null);

    await expect(getGoal(OTHER_USER_ID, GOAL_ID)).rejects.toMatchObject({
      name: 'NotFoundError',
      status: 404,
      message: 'Savings goal not found',
    });
  });
});

describe('updateGoal', () => {
  beforeEach(() => {
    prisma.savingsGoal.findFirst.mockResolvedValue({ id: GOAL_ID });
  });

  it('checks ownership before writing', async () => {
    prisma.savingsGoal.findFirst.mockResolvedValue(null);

    await expect(
      updateGoal(OTHER_USER_ID, GOAL_ID, { savedAmount: 1000 }),
    ).rejects.toMatchObject({ name: 'NotFoundError', status: 404 });

    expect(prisma.savingsGoal.update).not.toHaveBeenCalled();
  });

  it('writes only the fields that were provided', async () => {
    prisma.savingsGoal.update.mockResolvedValue(
      savedGoal({ savedAmount: 500000 }),
    );

    const goal = await updateGoal(USER_ID, GOAL_ID, { savedAmount: 500000 });

    expect(prisma.savingsGoal.update).toHaveBeenCalledWith({
      where: { id: GOAL_ID },
      data: { savedAmount: 500000 },
    });
    // 500000 remaining over 3 months.
    expect(goal.requiredMonthlyContribution).toBe(166667);
  });

  it('converts a deadline string to a Date', async () => {
    prisma.savingsGoal.update.mockResolvedValue(goalRow());

    await updateGoal(USER_ID, GOAL_ID, { deadline: '2026-12-31' });

    expect(prisma.savingsGoal.update).toHaveBeenCalledWith({
      where: { id: GOAL_ID },
      data: { deadline: new Date('2026-12-31') },
    });
  });

  it('can update several fields at once', async () => {
    prisma.savingsGoal.update.mockResolvedValue(
      savedGoal({ name: 'Japan trip', targetAmount: 2000000 }),
    );

    await updateGoal(USER_ID, GOAL_ID, {
      name: 'Japan trip',
      targetAmount: 2000000,
    });

    expect(prisma.savingsGoal.update.mock.calls[0][0].data).toEqual({
      name: 'Japan trip',
      targetAmount: 2000000,
    });
  });
});

describe('deleteGoal', () => {
  it('checks ownership before deleting', async () => {
    prisma.savingsGoal.findFirst.mockResolvedValue(null);

    await expect(deleteGoal(OTHER_USER_ID, GOAL_ID)).rejects.toMatchObject({
      name: 'NotFoundError',
      status: 404,
    });

    expect(prisma.savingsGoal.delete).not.toHaveBeenCalled();
  });

  it('deletes by id once ownership is established', async () => {
    prisma.savingsGoal.findFirst.mockResolvedValue({ id: GOAL_ID });
    prisma.savingsGoal.delete.mockResolvedValue({});

    await deleteGoal(USER_ID, GOAL_ID);

    expect(prisma.savingsGoal.delete).toHaveBeenCalledWith({
      where: { id: GOAL_ID },
    });
  });
});
