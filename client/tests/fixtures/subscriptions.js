import {
  rollupSubscriptions,
  toSubscriptionView,
} from '../../../server/src/services/subscriptionMath.js';

const NOW = '2026-10-19T12:00:00.000Z';

export function subscriptionFixture({
  id = 'subscription-1',
  userId = 'user-1',
  name = 'Netflix',
  amount = 64900,
  frequency = 'monthly',
  nextRenewalDate = '2026-10-24',
  ...rest
} = {}) {
  return toSubscriptionView(
    {
      id,
      userId,
      name,
      amount,
      frequency,
      nextRenewalDate,
      ...rest,
    },
    NOW,
  );
}

export function subscriptionsResponse(subscriptions) {
  return {
    subscriptions,
    rollup: rollupSubscriptions(subscriptions),
  };
}
