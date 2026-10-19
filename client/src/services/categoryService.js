import { api, toApiError } from './httpClient.js';

/**
 * Axios wrapper for the category endpoints (server/src/routes/categoryRoutes.js).
 *
 * Read-only: the server has no create or update yet, so there is nothing to
 * wrap beyond the list the pickers need.
 */

export async function listCategories() {
  try {
    const { data } = await api.get('/categories');
    return data.categories;
  } catch (error) {
    throw toApiError(error);
  }
}
