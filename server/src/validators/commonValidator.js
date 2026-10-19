import { z } from 'zod';

/**
 * Field schemas shared by more than one feature's request schema.
 *
 * They live here rather than being copied per feature because the money rules
 * in conventions.md are not allowed to drift: two copies of "what is a valid
 * amount" is one copy too many once budgets start validating limits against
 * the same paise bound transactions do.
 */

/**
 * Postgres INTEGER (int4) tops out at 2147483647 paise - about ₹2.1 crore,
 * far more than any personal entry. The bound is asserted in the schema rather
 * than left to the database: an out-of-range value otherwise surfaces as a
 * Prisma error and a 500, when it is plainly a client input problem and should
 * be a 400 like every other validation failure.
 */
export const PAISE_MAX = 2147483647;

export const paise = z
  .int('Amount must be an integer number of paise (e.g. 124900 for ₹1,249.00)')
  .positive('Amount must be greater than zero')
  .max(PAISE_MAX, 'Amount is too large');

/** Same money rule as `paise`, but 0 is allowed (e.g. a goal's savedAmount). */
export const nonNegativePaise = z
  .int('Amount must be an integer number of paise (e.g. 124900 for ₹1,249.00)')
  .min(0, 'Amount cannot be negative')
  .max(PAISE_MAX, 'Amount is too large');

export const uuid = z.uuid('Must be a valid UUID');

export const isoDate = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Date must be an ISO calendar date (YYYY-MM-DD)',
  )
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    'Date must be a real calendar date',
  );

/** Year-month, e.g. "2026-10". Matches Budget.period. */
export const yearMonth = z
  .string()
  .regex(
    /^\d{4}-(0[1-9]|1[0-2])$/,
    'Period must be a year-month string (YYYY-MM)',
  )
  .refine(
    (value) => !Number.isNaN(Date.parse(`${value}-01`)),
    'Period must be a real month',
  );
