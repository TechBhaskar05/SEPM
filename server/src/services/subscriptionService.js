import prisma from '../lib/prismaClient.js';
import { NotFoundError } from '../lib/errors.js';
import {
  daysUntilRenewal,
  rollupSubscriptions,
  toSubscriptionView,
} from './subscriptionMath.js';

export { daysUntilRenewal, rollupSubscriptions, toSubscriptionView };

export async function createSubscription(userId, data) {
  const subscription = await prisma.subscription.create({
    data: {
      userId,
      name: data.name,
      amount: data.amount,
      frequency: data.frequency,
      nextRenewalDate: new Date(data.nextRenewalDate),
    },
  });

  return toSubscriptionView(subscription);
}

export async function getSubscriptionsForUser(userId) {
  const rows = await prisma.subscription.findMany({
    where: { userId },
    orderBy: [{ nextRenewalDate: 'asc' }, { name: 'asc' }],
  });

  return {
    subscriptions: rows.map((subscription) => toSubscriptionView(subscription)),
    rollup: rollupSubscriptions(rows),
  };
}

export async function getSubscription(userId, id) {
  const subscription = await prisma.subscription.findFirst({
    where: { id, userId },
  });

  if (!subscription) throw new NotFoundError('Subscription not found');

  return toSubscriptionView(subscription);
}

export async function updateSubscription(userId, id, data) {
  const existing = await prisma.subscription.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Subscription not found');

  const subscription = await prisma.subscription.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.amount !== undefined ? { amount: data.amount } : {}),
      ...(data.frequency !== undefined ? { frequency: data.frequency } : {}),
      ...(data.nextRenewalDate !== undefined
        ? { nextRenewalDate: new Date(data.nextRenewalDate) }
        : {}),
    },
  });

  return toSubscriptionView(subscription);
}

export async function deleteSubscription(userId, id) {
  const existing = await prisma.subscription.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) throw new NotFoundError('Subscription not found');

  await prisma.subscription.delete({ where: { id } });
}
