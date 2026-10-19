import { z } from 'zod';

import { isoDate, paise, uuid } from './commonValidator.js';

const renewalDate = isoDate.refine((value) => {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}, 'Renewal date must be a real calendar date');

const subscriptionFields = {
  name: z.string().trim().min(1, 'Name is required').max(100),
  amount: paise,
  frequency: z.enum(['monthly', 'yearly']),
  nextRenewalDate: renewalDate,
};

export const createSubscriptionSchema = z.object(subscriptionFields);

export const updateSubscriptionSchema = z
  .object({
    name: subscriptionFields.name.optional(),
    amount: subscriptionFields.amount.optional(),
    frequency: subscriptionFields.frequency.optional(),
    nextRenewalDate: subscriptionFields.nextRenewalDate.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const idParamSchema = z.object({ id: uuid });
