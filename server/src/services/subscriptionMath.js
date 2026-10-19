import { ValidationError } from '../lib/errors.js';

const MS_PER_DAY = 86_400_000;
export const RENEWAL_SOON_DAYS = 7;

function assertFrequency(frequency) {
  if (frequency !== 'monthly' && frequency !== 'yearly') {
    throw new ValidationError('Frequency must be monthly or yearly');
  }
}

function assertAmount(amount) {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new ValidationError(
      'Amount must be a non-negative integer number of paise',
    );
  }
}

function utcCalendarDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Renewal date is invalid');
  }

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Monthly equivalents use one rounding step per yearly subscription: a yearly
 * bill is divided by 12 and rounded to the nearest paisa. The annual total uses
 * the actual yearly amount, so annual is authoritative and monthly × 12 can
 * differ from it by a few paise.
 */
export function rollupSubscriptions(subscriptions = []) {
  let monthlyTotal = 0;
  let annualTotal = 0;

  for (const subscription of subscriptions) {
    const { amount, frequency } = subscription;
    assertFrequency(frequency);
    assertAmount(amount);

    if (frequency === 'monthly') {
      monthlyTotal += amount;
      annualTotal += amount * 12;
    } else {
      monthlyTotal += Math.round(amount / 12);
      annualTotal += amount;
    }
  }

  return { monthlyTotal, annualTotal };
}

export function daysUntilRenewal(nextRenewalDate, now = new Date()) {
  const remainingMs = utcCalendarDay(nextRenewalDate) - utcCalendarDay(now);
  return Math.round(remainingMs / MS_PER_DAY);
}

export function toSubscriptionView(subscription, now = new Date()) {
  const daysUntil = daysUntilRenewal(subscription.nextRenewalDate, now);

  return {
    ...subscription,
    daysUntilRenewal: daysUntil,
    isRenewalSoon: daysUntil >= 0 && daysUntil <= RENEWAL_SOON_DAYS,
    isRenewalOverdue: daysUntil < 0,
  };
}
