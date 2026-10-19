import { api, toApiError } from './httpClient.js';

/**
 * Client wrapper for `GET /api/dashboard`.
 *
 * The response is the server's aggregate payload: `{ period, summary,
 * categoryBreakdown, recentTransactions, aiSummary }`.
 */
export async function getDashboard({ period } = {}) {
  try {
    const { data } = await api.get('/dashboard', {
      params: period ? { period } : undefined,
    });
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}
