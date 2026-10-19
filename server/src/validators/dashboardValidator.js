import { z } from 'zod';

import { yearMonth } from './commonValidator.js';

/**
 * Query schema for `GET /api/dashboard`.
 *
 * `period` follows the same "YYYY-MM" rule as budgets, so an unknown or
 * malformed month is a 400 instead of silently aggregating the wrong range.
 */
export const dashboardQuerySchema = z.object({
  period: yearMonth.optional(),
});
