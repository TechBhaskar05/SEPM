import { api, toApiError } from './httpClient.js';

/**
 * Axios wrapper for the budget endpoints (server/src/routes/budgetRoutes.js).
 *
 * Rejects with a normalized ApiError rather than axios' shape, so a caller can
 * read `error.message` and `error.details` without knowing axios exists.
 *
 * Amounts cross this boundary as integer paise (conventions.md "Money
 * handling"). The API returns `spent`, `limitAmount`, `remainingAmount` and
 * `utilization`, and the form is the only place that converts what the user
 * typed, via utils/formatters.js.
 */

async function request(config) {
  try {
    const { data } = await api.request(config);
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

/**
 * @param {object} [filters] `{ period }` - omit for every period the user has.
 * @returns {Promise<Array>} Budgets, each with utilization and threshold state.
 */
export function listBudgets({ period } = {}) {
  return request({
    method: 'get',
    url: '/budgets',
    params: period ? { period } : undefined,
  }).then((data) => data.budgets);
}

export function getBudget(id) {
  return request({ method: 'get', url: `/budgets/${id}` }).then(
    (data) => data.budget,
  );
}

/** @throws {ApiError} 409 if the category already has a budget for that period. */
export function createBudget(payload) {
  return request({ method: 'post', url: '/budgets', data: payload }).then(
    (data) => data.budget,
  );
}

/** Only `limitAmount` is editable; `spent` is owned by the server. */
export function updateBudget(id, { limitAmount }) {
  return request({
    method: 'patch',
    url: `/budgets/${id}`,
    data: { limitAmount },
  }).then((data) => data.budget);
}

export function deleteBudget(id) {
  return request({ method: 'delete', url: `/budgets/${id}` });
}
