import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';

/**
 * Dashboard aggregation over HTTP, against a real database.
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

const TEST_EMAIL_PREFIX = 'it.dashboard.test.';
const UNIQUE = `${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
const EMAIL = `${TEST_EMAIL_PREFIX}${UNIQUE}@example.com`;
const OTHER_EMAIL = `${TEST_EMAIL_PREFIX}other.${UNIQUE}@example.com`;
const PASSWORD = 'integration-test-password';

let token;
let otherToken;
let userId;
let categoryId;

/** UTC today, which is the day the server buckets the current period by. */
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** The 15th of the month `offset` months from the current UTC month. */
function monthOffsetIso(offset) {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 15),
  )
    .toISOString()
    .slice(0, 10);
}

function previousPeriod() {
  return monthOffsetIso(-1).slice(0, 7);
}

function cleanup() {
  return prisma.idempotencyKey
    .deleteMany({
      where: { user: { email: { startsWith: TEST_EMAIL_PREFIX } } },
    })
    .then(() =>
      prisma.transaction.deleteMany({
        where: { user: { email: { startsWith: TEST_EMAIL_PREFIX } } },
      }),
    )
    .then(() =>
      prisma.category.deleteMany({
        where: { user: { email: { startsWith: TEST_EMAIL_PREFIX } } },
      }),
    )
    .then(() =>
      prisma.user.deleteMany({
        where: { email: { startsWith: TEST_EMAIL_PREFIX } },
      }),
    );
}

function auth(accessToken = token) {
  return { Authorization: `Bearer ${accessToken}` };
}

async function createTransaction(accessToken, transaction) {
  return request(app)
    .post('/api/transactions')
    .set('Idempotency-Key', randomUUID())
    .set(auth(accessToken))
    .send(transaction);
}

beforeAll(async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set to run integration tests');
  }
  await cleanup();

  const registration = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Dashboard Tester', email: EMAIL, password: PASSWORD });
  expect(registration.status).toBe(201);
  token = registration.body.token;
  userId = registration.body.user.id;

  const category = await prisma.category.create({
    data: { name: `Food ${UNIQUE}`, userId },
  });
  categoryId = category.id;

  // Current period: ₹9,000 income, ₹3,500 expense (₹5,500 saved).
  expect(
    (
      await createTransaction(token, {
        type: 'income',
        amount: 900000,
        description: 'Salary',
        date: todayIso(),
      })
    ).status,
  ).toBe(201);

  expect(
    (
      await createTransaction(token, {
        type: 'expense',
        amount: 350000,
        description: 'Groceries',
        date: todayIso(),
        categoryId,
      })
    ).status,
  ).toBe(201);

  // Previous period: ₹1,000 expense. It must not leak into this month's
  // figures, but it does count toward the all-time balance.
  expect(
    (
      await createTransaction(token, {
        type: 'expense',
        amount: 100000,
        description: 'Last month',
        date: monthOffsetIso(-1),
        categoryId,
      })
    ).status,
  ).toBe(201);

  const other = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Other Tester', email: OTHER_EMAIL, password: PASSWORD });
  expect(other.status).toBe(201);
  otherToken = other.body.token;

  expect(
    (
      await createTransaction(otherToken, {
        type: 'income',
        amount: 777777,
        description: 'Not the first user',
        date: todayIso(),
      })
    ).status,
  ).toBe(201);
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe('GET /api/dashboard', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/dashboard');

    expect(res.status).toBe(401);
  });

  it('rejects a malformed period with 400', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .query({ period: '2026-13' })
      .set(auth());

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('aggregates the current period and all-time balance', async () => {
    const res = await request(app).get('/api/dashboard').set(auth());

    expect(res.status).toBe(200);
    expect(res.body.summary.totalIncome).toBe(900000);
    expect(res.body.summary.totalExpenses).toBe(350000);
    expect(res.body.summary.savings).toBe(550000);
    expect(res.body.summary.totalBalance).toBe(450000);
  });

  it('returns the category breakdown for the period', async () => {
    const res = await request(app).get('/api/dashboard').set(auth());

    expect(res.body.categoryBreakdown).toEqual([
      expect.objectContaining({
        categoryId,
        amount: 350000,
        percentage: 100,
      }),
    ]);
  });

  it('returns the five most recent transactions', async () => {
    const res = await request(app).get('/api/dashboard').set(auth());

    expect(res.body.recentTransactions).toHaveLength(3);
    expect(res.body.recentTransactions.map((row) => row.description)).toEqual(
      expect.arrayContaining(['Salary', 'Groceries', 'Last month']),
    );
  });

  it('scopes every figure to the authenticated user', async () => {
    const res = await request(app).get('/api/dashboard').set(auth());

    expect(res.body.summary.totalIncome).toBe(900000);
    expect(res.body.recentTransactions).toHaveLength(3);
  });

  it('aggregates a requested period without changing the all-time balance', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .query({ period: previousPeriod() })
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.summary.totalIncome).toBe(0);
    expect(res.body.summary.totalExpenses).toBe(100000);
    expect(res.body.summary.savings).toBe(-100000);
    expect(res.body.summary.totalBalance).toBe(450000);
  });

  it('returns an empty dashboard shape when the period has no rows', async () => {
    const res = await request(app)
      .get('/api/dashboard')
      .query({ period: '2020-01' })
      .set(auth());

    expect(res.status).toBe(200);
    expect(res.body.categoryBreakdown).toEqual([]);
    expect(res.body.summary.totalIncome).toBe(0);
    expect(res.body.summary.totalExpenses).toBe(0);
    expect(res.body.summary.savings).toBe(0);
    // The balance is all-time, so an empty month does not zero it.
    expect(res.body.summary.totalBalance).toBe(450000);
  });
});
