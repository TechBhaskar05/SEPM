import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

/**
 * Savings-goal CRUD over HTTP, against a real database.
 *
 * Refuses to run without TEST_DATABASE_URL so the deleteMany below can never
 * touch the development database.
 */
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    'TEST_DATABASE_URL is not set. Integration tests must not run against the development database.\n' +
      'Create a throwaway database (e.g. a Neon dev branch) and add it to server/.env:\n' +
      '  TEST_DATABASE_URL=postgresql://...',
  );
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const { default: app } = await import('../../src/app.js');
const { default: prisma } = await import('../../src/lib/prismaClient.js');

const TEST_EMAIL_PREFIX = 'it.goal.test.';
const UNIQUE = `${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
const EMAIL = `${TEST_EMAIL_PREFIX}${UNIQUE}@example.com`;
const OTHER_EMAIL = `${TEST_EMAIL_PREFIX}other.${UNIQUE}@example.com`;
const PASSWORD = 'integration-test-password';

let token;
let otherToken;
let userId;

/**
 * A deadline N calendar months from today, on the 15th.
 *
 * The 15th avoids month-length surprises, and using a future month means
 * `monthsRemaining` is exactly N regardless of what day of the month the suite
 * runs on. For N >= 1 this is always in the future.
 */
function deadlineInMonths(months) {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, 15),
  )
    .toISOString()
    .slice(0, 10);
}

function cleanup() {
  // SavingsGoal cascades from User, but delete it explicitly so the intent is
  // visible and a future non-cascading child cannot be missed.
  return prisma.savingsGoal
    .deleteMany({
      where: { user: { email: { startsWith: TEST_EMAIL_PREFIX } } },
    })
    .then(() =>
      prisma.user.deleteMany({
        where: { email: { startsWith: TEST_EMAIL_PREFIX } },
      }),
    );
}

beforeAll(async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set to run integration tests');
  }
  await cleanup();

  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Goal Tester', email: EMAIL, password: PASSWORD });
  expect(res.status).toBe(201);
  token = res.body.token;
  userId = res.body.user.id;

  const other = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Other Tester', email: OTHER_EMAIL, password: PASSWORD });
  expect(other.status).toBe(201);
  otherToken = other.body.token;
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

function auth(accessToken = token) {
  return { Authorization: `Bearer ${accessToken}` };
}

describe('savings goals — CRUD over HTTP', () => {
  let goalId;
  const deadline = deadlineInMonths(3);

  it('creates a goal with the derived monthly contribution', async () => {
    const res = await request(app)
      .post('/api/savings-goals')
      .set(auth())
      // A client-supplied userId must be stripped, never trusted.
      .send({
        userId: '99999999-9999-9999-9999-999999999999',
        name: `Laptop ${UNIQUE}`,
        targetAmount: 1000000,
        savedAmount: 100000,
        deadline,
      });

    expect(res.status).toBe(201);
    expect(res.body.goal).toMatchObject({
      userId,
      name: `Laptop ${UNIQUE}`,
      targetAmount: 1000000,
      savedAmount: 100000,
      remainingAmount: 900000,
      monthsRemaining: 3,
      requiredMonthlyContribution: 300000,
      progressPercent: 10,
      isAchieved: false,
      isOverdue: false,
    });
    goalId = res.body.goal.id;
  });

  it('defaults savedAmount to 0 when it is omitted', async () => {
    const res = await request(app)
      .post('/api/savings-goals')
      .set(auth())
      .send({
        name: `Phone ${UNIQUE}`,
        targetAmount: 500000,
        deadline,
      });

    expect(res.status).toBe(201);
    expect(res.body.goal.savedAmount).toBe(0);
    expect(res.body.goal.requiredMonthlyContribution).toBe(166667);
  });

  it('rejects a fractional target with 400', async () => {
    const res = await request(app)
      .post('/api/savings-goals')
      .set(auth())
      .send({
        name: `Bad ${UNIQUE}`,
        targetAmount: 5000.5,
        deadline,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.targetAmount).toMatch(/integer/i);
  });

  it('rejects a negative savedAmount with 400', async () => {
    const res = await request(app)
      .post('/api/savings-goals')
      .set(auth())
      .send({
        name: `Bad ${UNIQUE}`,
        targetAmount: 500000,
        savedAmount: -1,
        deadline,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.savedAmount).toMatch(/negative/i);
  });

  it('rejects an impossible calendar deadline with 400', async () => {
    const res = await request(app)
      .post('/api/savings-goals')
      .set(auth())
      .send({
        name: `Bad ${UNIQUE}`,
        targetAmount: 500000,
        deadline: '2027-02-30',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details.deadline).toMatch(/real calendar date/i);
  });

  it('rejects a blank name with 400', async () => {
    const res = await request(app)
      .post('/api/savings-goals')
      .set(auth())
      .send({ name: '   ', targetAmount: 500000, deadline });

    expect(res.status).toBe(400);
    expect(res.body.error.details.name).toMatch(/required/i);
  });

  it('lists only the caller goals, soonest deadline first', async () => {
    const res = await request(app).get('/api/savings-goals').set(auth());

    expect(res.status).toBe(200);
    expect(res.body.goals.every((goal) => goal.userId === userId)).toBe(true);
    expect(res.body.goals.some((goal) => goal.id === goalId)).toBe(true);

    const deadlines = res.body.goals.map((goal) =>
      new Date(goal.deadline).getTime(),
    );
    expect(deadlines).toEqual([...deadlines].sort((a, b) => a - b));

    expect(
      res.body.goals.every((goal) =>
        Number.isInteger(goal.requiredMonthlyContribution),
      ),
    ).toBe(true);
  });

  it('reads one goal', async () => {
    const res = await request(app)
      .get(`/api/savings-goals/${goalId}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.goal.id).toBe(goalId);
  });

  it('updates savedAmount and recalculates the contribution', async () => {
    const res = await request(app)
      .patch(`/api/savings-goals/${goalId}`)
      .set(auth())
      .send({ savedAmount: 400000 });

    expect(res.status).toBe(200);
    expect(res.body.goal.savedAmount).toBe(400000);
    expect(res.body.goal.requiredMonthlyContribution).toBe(200000);
  });

  it('does not blank the fields a PATCH omits', async () => {
    const res = await request(app)
      .patch(`/api/savings-goals/${goalId}`)
      .set(auth())
      .send({ name: `Laptop Pro ${UNIQUE}` });

    expect(res.status).toBe(200);
    expect(res.body.goal.name).toBe(`Laptop Pro ${UNIQUE}`);
    expect(res.body.goal.targetAmount).toBe(1000000);
    expect(res.body.goal.savedAmount).toBe(400000);
    expect(res.body.goal.deadline).toBe(
      new Date(`${deadline}T00:00:00.000Z`).toISOString(),
    );
  });

  it('rejects an empty PATCH with 400', async () => {
    const res = await request(app)
      .patch(`/api/savings-goals/${goalId}`)
      .set(auth())
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.details._).toMatch(/at least one field/i);
  });

  it("404s another user's goal for read, update and delete", async () => {
    const read = await request(app)
      .get(`/api/savings-goals/${goalId}`)
      .set(auth(otherToken));
    const update = await request(app)
      .patch(`/api/savings-goals/${goalId}`)
      .set(auth(otherToken))
      .send({ savedAmount: 0 });
    const remove = await request(app)
      .delete(`/api/savings-goals/${goalId}`)
      .set(auth(otherToken));

    expect(read.status).toBe(404);
    expect(update.status).toBe(404);
    expect(remove.status).toBe(404);

    // The owner still has it.
    const stillThere = await request(app)
      .get(`/api/savings-goals/${goalId}`)
      .set(auth());
    expect(stillThere.status).toBe(200);
  });

  it('404s an id that does not exist', async () => {
    const res = await request(app)
      .get('/api/savings-goals/99999999-9999-4999-8999-999999999999')
      .set(auth());

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('deletes a goal and then 404s it', async () => {
    const removed = await request(app)
      .delete(`/api/savings-goals/${goalId}`)
      .set(auth());
    expect(removed.status).toBe(204);

    const after = await request(app)
      .get(`/api/savings-goals/${goalId}`)
      .set(auth());
    expect(after.status).toBe(404);
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/savings-goals')).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/savings-goals')
          .send({ name: 'x', targetAmount: 1, deadline })
      ).status,
    ).toBe(401);
  });
});

describe('savings goals — contribution edge cases over HTTP', () => {
  it('treats a past deadline as overdue and requires the whole remainder', async () => {
    const res = await request(app)
      .post('/api/savings-goals')
      .set(auth())
      .send({
        name: `Overdue ${UNIQUE}`,
        targetAmount: 500000,
        savedAmount: 200000,
        deadline: '2020-01-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.goal).toMatchObject({
      remainingAmount: 300000,
      monthsRemaining: 0,
      requiredMonthlyContribution: 300000,
      isOverdue: true,
      isAchieved: false,
    });
  });

  it('reports a met goal as achieved with nothing left to contribute', async () => {
    const res = await request(app)
      .post('/api/savings-goals')
      .set(auth())
      .send({
        name: `Achieved ${UNIQUE}`,
        targetAmount: 500000,
        savedAmount: 500000,
        deadline: '2020-01-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.goal).toMatchObject({
      remainingAmount: 0,
      requiredMonthlyContribution: 0,
      isAchieved: true,
      isOverdue: false,
    });
  });

  it('rounds a repeating contribution up to whole paise', async () => {
    const res = await request(app)
      .post('/api/savings-goals')
      .set(auth())
      .send({
        name: `Repeating ${UNIQUE}`,
        targetAmount: 100000,
        savedAmount: 0,
        deadline: deadlineInMonths(3),
      });

    expect(res.status).toBe(201);
    // 100000 / 3 = 33333.33 -> 33334, so three months cover the goal.
    expect(res.body.goal.requiredMonthlyContribution).toBe(33334);
  });
});
