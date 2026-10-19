import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/prismaClient.js', () => ({
  default: {
    subscription: {
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
  createSubscription,
  daysUntilRenewal,
  deleteSubscription,
  getSubscription,
  getSubscriptionsForUser,
  rollupSubscriptions,
  toSubscriptionView,
  updateSubscription,
} = await import('../../src/services/subscriptionService.js');
const { createSubscriptionSchema, updateSubscriptionSchema } =
  await import('../../src/validators/subscriptionValidator.js');
const { NotFoundError, ValidationError } =
  await import('../../src/lib/errors.js');

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '99999999-9999-9999-9999-999999999999';
const SUBSCRIPTION_ID = '55555555-5555-5555-5555-555555555555';
const OTHER_SUBSCRIPTION_ID = '66666666-6666-6666-6666-666666666666';

const NOW = new Date('2026-10-19T12:00:00.000Z');

function subscriptionRow(overrides = {}) {
  return {
    id: SUBSCRIPTION_ID,
    userId: USER_ID,
    name: 'Netflix',
    amount: 64900,
    frequency: 'monthly',
    nextRenewalDate: new Date('2026-10-24T00:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('rollupSubscriptions', () => {
  it('returns zero totals for no subscriptions', () => {
    expect(rollupSubscriptions([])).toEqual({
      monthlyTotal: 0,
      annualTotal: 0,
    });
  });

  it('sums monthly subscriptions across the month and the year', () => {
    const result = rollupSubscriptions([
      subscriptionRow({ amount: 64900 }),
      subscriptionRow({ id: OTHER_SUBSCRIPTION_ID, amount: 129900 }),
    ]);

    expect(result).toEqual({ monthlyTotal: 194800, annualTotal: 2337600 });
  });

  it('treats a yearly subscription as its monthly equivalent', () => {
    const result = rollupSubscriptions([
      subscriptionRow({ frequency: 'yearly', amount: 1200000 }),
    ]);

    expect(result).toEqual({ monthlyTotal: 100000, annualTotal: 1200000 });
  });

  it('combines monthly and yearly subscriptions', () => {
    const result = rollupSubscriptions([
      subscriptionRow({ amount: 64900 }),
      subscriptionRow({
        id: OTHER_SUBSCRIPTION_ID,
        frequency: 'yearly',
        amount: 1200000,
      }),
    ]);

    expect(result).toEqual({ monthlyTotal: 164900, annualTotal: 1978800 });
  });

  it('combines several monthly and yearly subscriptions into both totals', () => {
    const result = rollupSubscriptions([
      subscriptionRow({ amount: 64900 }),
      subscriptionRow({ id: OTHER_SUBSCRIPTION_ID, amount: 129900 }),
      subscriptionRow({
        id: '77777777-7777-7777-7777-777777777777',
        frequency: 'yearly',
        amount: 1200000,
      }),
      subscriptionRow({
        id: '88888888-8888-8888-8888-888888888888',
        frequency: 'yearly',
        amount: 600000,
      }),
    ]);

    expect(result).toEqual({
      monthlyTotal: 344800,
      annualTotal: 4137600,
    });
    expect(result.monthlyTotal * 12).toBe(result.annualTotal);
  });

  it('rounds a yearly monthly-equivalent to the nearest paisa', () => {
    expect(
      rollupSubscriptions([
        subscriptionRow({ frequency: 'yearly', amount: 1000 }),
      ]),
    ).toEqual({ monthlyTotal: 83, annualTotal: 1000 });

    expect(
      rollupSubscriptions([
        subscriptionRow({ frequency: 'yearly', amount: 1006 }),
      ]),
    ).toEqual({ monthlyTotal: 84, annualTotal: 1006 });
  });

  it('always returns integer paise', () => {
    const result = rollupSubscriptions([
      subscriptionRow({ frequency: 'yearly', amount: 999 }),
      subscriptionRow({
        id: OTHER_SUBSCRIPTION_ID,
        frequency: 'yearly',
        amount: 1001,
      }),
    ]);

    expect(Number.isInteger(result.monthlyTotal)).toBe(true);
    expect(Number.isInteger(result.annualTotal)).toBe(true);
  });

  it('rejects an unknown frequency rather than guessing', () => {
    expect(() =>
      rollupSubscriptions([subscriptionRow({ frequency: 'weekly' })]),
    ).toThrow(ValidationError);
  });
});

describe('daysUntilRenewal', () => {
  it('counts whole UTC calendar days from today', () => {
    expect(daysUntilRenewal('2026-10-24', NOW)).toBe(5);
    expect(daysUntilRenewal('2026-10-26', NOW)).toBe(7);
  });

  it('is zero for a renewal later the same day', () => {
    expect(daysUntilRenewal(new Date('2026-10-19T23:59:59.000Z'), NOW)).toBe(0);
  });

  it('crosses a month boundary correctly', () => {
    expect(daysUntilRenewal('2026-11-01', NOW)).toBe(13);
    expect(
      daysUntilRenewal('2027-01-01', new Date('2026-12-31T23:00:00.000Z')),
    ).toBe(1);
  });

  it('returns a negative count for an overdue renewal', () => {
    expect(daysUntilRenewal('2026-10-18', NOW)).toBe(-1);
    expect(daysUntilRenewal('2026-10-01', NOW)).toBe(-18);
  });

  it('rejects an unparseable date', () => {
    expect(() => daysUntilRenewal('not-a-date', NOW)).toThrow(ValidationError);
  });
});

describe('toSubscriptionView', () => {
  it('adds renewal timing and flags to the stored row', () => {
    const view = toSubscriptionView(subscriptionRow(), NOW);

    expect(view).toMatchObject({
      id: SUBSCRIPTION_ID,
      daysUntilRenewal: 5,
      isRenewalSoon: true,
      isRenewalOverdue: false,
    });
  });

  it('marks day 7 as soon and day 8 as not soon', () => {
    expect(
      toSubscriptionView(
        subscriptionRow({
          nextRenewalDate: new Date('2026-10-26T00:00:00.000Z'),
        }),
        NOW,
      ).isRenewalSoon,
    ).toBe(true);

    expect(
      toSubscriptionView(
        subscriptionRow({
          nextRenewalDate: new Date('2026-10-27T00:00:00.000Z'),
        }),
        NOW,
      ).isRenewalSoon,
    ).toBe(false);
  });

  it('marks a past renewal as overdue, not soon', () => {
    const view = toSubscriptionView(
      subscriptionRow({
        nextRenewalDate: new Date('2026-10-18T00:00:00.000Z'),
      }),
      NOW,
    );

    expect(view.daysUntilRenewal).toBe(-1);
    expect(view.isRenewalSoon).toBe(false);
    expect(view.isRenewalOverdue).toBe(true);
  });
});

describe('createSubscription', () => {
  it('scopes the row to the user and stores a calendar date', async () => {
    const row = subscriptionRow();
    prisma.subscription.create.mockResolvedValue(row);

    const result = await createSubscription(USER_ID, {
      name: 'Netflix',
      amount: 64900,
      frequency: 'monthly',
      nextRenewalDate: '2026-10-24',
    });

    expect(prisma.subscription.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        name: 'Netflix',
        amount: 64900,
        frequency: 'monthly',
        nextRenewalDate: new Date('2026-10-24'),
      },
    });
    expect(result.daysUntilRenewal).toBe(5);
  });
});

describe('getSubscriptionsForUser', () => {
  it('scopes, orders and returns the rollup with the rows', async () => {
    prisma.subscription.findMany.mockResolvedValue([
      subscriptionRow(),
      subscriptionRow({
        id: OTHER_SUBSCRIPTION_ID,
        frequency: 'yearly',
        amount: 1200000,
      }),
    ]);

    const result = await getSubscriptionsForUser(USER_ID);

    expect(prisma.subscription.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: [{ nextRenewalDate: 'asc' }, { name: 'asc' }],
    });
    expect(result.subscriptions).toHaveLength(2);
    expect(result.rollup).toEqual({
      monthlyTotal: 164900,
      annualTotal: 1978800,
    });
  });
});

describe('getSubscription', () => {
  it('finds the row by id and owner', async () => {
    prisma.subscription.findFirst.mockResolvedValue(subscriptionRow());

    const result = await getSubscription(USER_ID, SUBSCRIPTION_ID);

    expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
      where: { id: SUBSCRIPTION_ID, userId: USER_ID },
    });
    expect(result.id).toBe(SUBSCRIPTION_ID);
  });

  it("treats another user's subscription as missing", async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);

    await expect(
      getSubscription(OTHER_USER_ID, SUBSCRIPTION_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('updateSubscription', () => {
  it('writes only the provided fields', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: SUBSCRIPTION_ID });
    prisma.subscription.update.mockResolvedValue(
      subscriptionRow({ name: 'Netflix Premium', amount: 79900 }),
    );

    const result = await updateSubscription(USER_ID, SUBSCRIPTION_ID, {
      name: 'Netflix Premium',
      amount: 79900,
    });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: SUBSCRIPTION_ID },
      data: { name: 'Netflix Premium', amount: 79900 },
    });
    expect(result.name).toBe('Netflix Premium');
  });

  it('converts a provided renewal date to a Date', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: SUBSCRIPTION_ID });
    prisma.subscription.update.mockResolvedValue(
      subscriptionRow({
        nextRenewalDate: new Date('2026-11-01T00:00:00.000Z'),
      }),
    );

    await updateSubscription(USER_ID, SUBSCRIPTION_ID, {
      nextRenewalDate: '2026-11-01',
    });

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { id: SUBSCRIPTION_ID },
      data: { nextRenewalDate: new Date('2026-11-01') },
    });
  });

  it("refuses to update another user's subscription", async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);

    await expect(
      updateSubscription(OTHER_USER_ID, SUBSCRIPTION_ID, { amount: 100 }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(prisma.subscription.update).not.toHaveBeenCalled();
  });
});

describe('deleteSubscription', () => {
  it('deletes only an owned subscription', async () => {
    prisma.subscription.findFirst.mockResolvedValue({ id: SUBSCRIPTION_ID });

    await deleteSubscription(USER_ID, SUBSCRIPTION_ID);

    expect(prisma.subscription.delete).toHaveBeenCalledWith({
      where: { id: SUBSCRIPTION_ID },
    });
  });

  it("does not delete a row that is not the caller's", async () => {
    prisma.subscription.findFirst.mockResolvedValue(null);

    await expect(
      deleteSubscription(OTHER_USER_ID, SUBSCRIPTION_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(prisma.subscription.delete).not.toHaveBeenCalled();
  });
});

describe('subscription validators', () => {
  const valid = {
    name: 'Netflix',
    amount: 64900,
    frequency: 'monthly',
    nextRenewalDate: '2026-10-24',
  };

  it('accepts a valid create payload and strips unknown keys', () => {
    const parsed = createSubscriptionSchema.parse({
      ...valid,
      userId: OTHER_USER_ID,
      id: OTHER_SUBSCRIPTION_ID,
    });

    expect(parsed).toEqual(valid);
  });

  it('trims the name', () => {
    expect(
      createSubscriptionSchema.parse({ ...valid, name: '  Netflix  ' }).name,
    ).toBe('Netflix');
  });

  it.each([
    ['zero amount', { amount: 0 }],
    ['fractional paise', { amount: 649.5 }],
    ['unknown frequency', { frequency: 'weekly' }],
    ['impossible date', { nextRenewalDate: '2027-02-30' }],
    ['empty name', { name: '   ' }],
  ])('rejects %s', (_label, overrides) => {
    expect(() =>
      createSubscriptionSchema.parse({ ...valid, ...overrides }),
    ).toThrow();
  });

  it('accepts a single-field update', () => {
    expect(updateSubscriptionSchema.parse({ frequency: 'yearly' })).toEqual({
      frequency: 'yearly',
    });
  });

  it('rejects an empty update', () => {
    expect(() => updateSubscriptionSchema.parse({})).toThrow();
  });
});
