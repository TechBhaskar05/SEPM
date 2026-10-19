import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

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

const TEST_EMAIL_PREFIX = 'it.subscription.test.';
const UNIQUE = `${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
const EMAIL = `${TEST_EMAIL_PREFIX}${UNIQUE}@example.com`;
const OTHER_EMAIL = `${TEST_EMAIL_PREFIX}other.${UNIQUE}@example.com`;
const PASSWORD = 'integration-test-password';

let token;
let otherToken;
let userId;

function renewalInDays(days) {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function cleanup() {
  return prisma.subscription
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
    .send({ name: 'Subscription Tester', email: EMAIL, password: PASSWORD });
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

describe('subscriptions — CRUD and rollup over HTTP', () => {
  let monthlyId;
  let yearlyId;

  it('creates a monthly subscription with a renewal countdown', async () => {
    const res = await request(app)
      .post('/api/subscriptions')
      .set(auth())
      .send({
        userId: '99999999-9999-9999-9999-999999999999',
        name: `Netflix ${UNIQUE}`,
        amount: 64900,
        frequency: 'monthly',
        nextRenewalDate: renewalInDays(5),
      });

    expect(res.status).toBe(201);
    expect(res.body.subscription).toMatchObject({
      userId,
      name: `Netflix ${UNIQUE}`,
      amount: 64900,
      frequency: 'monthly',
      daysUntilRenewal: 5,
      isRenewalSoon: true,
      isRenewalOverdue: false,
    });
    monthlyId = res.body.subscription.id;
  });

  it('creates a yearly subscription', async () => {
    const res = await request(app)
      .post('/api/subscriptions')
      .set(auth())
      .send({
        name: `Cloud storage ${UNIQUE}`,
        amount: 1200000,
        frequency: 'yearly',
        nextRenewalDate: renewalInDays(40),
      });

    expect(res.status).toBe(201);
    expect(res.body.subscription).toMatchObject({
      frequency: 'yearly',
      isRenewalSoon: false,
    });
    yearlyId = res.body.subscription.id;
  });

  it('lists subscriptions soonest renewal first with both totals', async () => {
    const res = await request(app).get('/api/subscriptions').set(auth());

    expect(res.status).toBe(200);
    expect(res.body.subscriptions).toHaveLength(2);
    expect(res.body.subscriptions[0].id).toBe(monthlyId);
    expect(res.body.subscriptions[1].id).toBe(yearlyId);
    expect(res.body.rollup).toEqual({
      monthlyTotal: 164900,
      annualTotal: 1978800,
    });
  });

  it('reads a single subscription', async () => {
    const res = await request(app)
      .get(`/api/subscriptions/${monthlyId}`)
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.subscription.id).toBe(monthlyId);
  });

  it('updates only the supplied fields', async () => {
    const res = await request(app)
      .patch(`/api/subscriptions/${monthlyId}`)
      .set(auth())
      .send({ amount: 79900 });

    expect(res.status).toBe(200);
    expect(res.body.subscription).toMatchObject({
      id: monthlyId,
      name: `Netflix ${UNIQUE}`,
      amount: 79900,
      frequency: 'monthly',
    });
  });

  it('recalculates the rollup after an update', async () => {
    const res = await request(app).get('/api/subscriptions').set(auth());

    expect(res.body.rollup).toEqual({
      monthlyTotal: 179900,
      annualTotal: 2158800,
    });
  });

  it('rejects invalid input', async () => {
    const res = await request(app)
      .post('/api/subscriptions')
      .set(auth())
      .send({
        name: 'Weekly thing',
        amount: 100,
        frequency: 'weekly',
        nextRenewalDate: renewalInDays(3),
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.frequency).toBeTruthy();
  });

  it("hides another user's subscription behind a 404", async () => {
    const get = await request(app)
      .get(`/api/subscriptions/${monthlyId}`)
      .set(auth(otherToken));
    expect(get.status).toBe(404);

    const patch = await request(app)
      .patch(`/api/subscriptions/${monthlyId}`)
      .set(auth(otherToken))
      .send({ amount: 1 });
    expect(patch.status).toBe(404);

    const remove = await request(app)
      .delete(`/api/subscriptions/${monthlyId}`)
      .set(auth(otherToken));
    expect(remove.status).toBe(404);
  });

  it('deletes an owned subscription', async () => {
    const res = await request(app)
      .delete(`/api/subscriptions/${monthlyId}`)
      .set(auth());

    expect(res.status).toBe(204);

    const list = await request(app).get('/api/subscriptions').set(auth());
    expect(list.body.subscriptions).toHaveLength(1);
    expect(list.body.rollup).toEqual({
      monthlyTotal: 100000,
      annualTotal: 1200000,
    });
  });
});
