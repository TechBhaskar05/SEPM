import { api, toApiError } from './httpClient.js';

/**
 * Axios wrapper for the savings-goal endpoints
 * (server/src/routes/goalRoutes.js).
 *
 * Rejects with a normalized ApiError rather than axios' shape, so a caller can
 * read `error.message` and `error.details` without knowing axios exists.
 *
 * Amounts cross this boundary as integer paise (conventions.md "Money
 * handling"). The server also derives `remainingAmount`, `monthsRemaining`,
 * `requiredMonthlyContribution`, `progressPercent`, `isAchieved` and
 * `isOverdue` on every read; the card renders those rather than recomputing
 * them, so the maths has one definition.
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
 * Goals, soonest deadline first (the server's order).
 *
 * @returns {Promise<Array>} Goals with their derived display fields.
 */
export function listGoals() {
  return request({ method: 'get', url: '/savings-goals' }).then(
    (data) => data.goals,
  );
}

export function getGoal(id) {
  return request({ method: 'get', url: `/savings-goals/${id}` }).then(
    (data) => data.goal,
  );
}

/**
 * @param {{ name: string, targetAmount: number, savedAmount?: number,
 *   deadline: string }} payload  Amounts in paise; deadline as YYYY-MM-DD.
 */
export function createGoal(payload) {
  return request({ method: 'post', url: '/savings-goals', data: payload }).then(
    (data) => data.goal,
  );
}

/** Any subset of the editable fields; `userId` is never client-owned. */
export function updateGoal(id, payload) {
  return request({
    method: 'patch',
    url: `/savings-goals/${id}`,
    data: payload,
  }).then((data) => data.goal);
}

export function deleteGoal(id) {
  return request({ method: 'delete', url: `/savings-goals/${id}` });
}
