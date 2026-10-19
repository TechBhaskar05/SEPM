import axios from 'axios';

/**
 * The app's single axios instance.
 *
 * The base URL comes from VITE_API_BASE_URL (see client/.env.example); the
 * fallback mirrors that file's example value so a fresh clone reaches the
 * default server port even before a .env exists.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api',
  headers: { 'Content-Type': 'application/json' },
  // A hung request is indistinguishable from a slow one on the UI's side of
  // the wire; capping it turns "spinner forever" into a message the user can
  // act on.
  timeout: 10000,
});

/**
 * Attaches (or removes) the bearer token on every subsequent request.
 *
 * Called by authStore on login/register/logout, and again once the persisted
 * session has been rehydrated, so a page reload keeps the user signed in.
 */
export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

/**
 * Normalised failure the UI can render without knowing anything about axios.
 *
 * `details` is the optional `{ field: message }` map the server returns with
 * a VALIDATION_ERROR (see server/src/middleware/errorHandler.js), which lets
 * a form put server-side validation on the same fields as client-side
 * validation instead of demoting it to a toast.
 */
export class ApiError extends Error {
  constructor(
    message,
    { status = null, code = 'UNKNOWN', details = null } = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Converts anything axios can throw into an ApiError.
 *
 * Three cases, in order: the server's `{ error: { code, message, details } }`
 * envelope; a response that is *not* in that envelope (a proxy or gateway
 * error page); and no response at all - a dropped connection or a timeout,
 * where the request never reached the server.
 */
export function toApiError(error) {
  const response = error?.response;
  const envelope = response?.data?.error;

  if (envelope?.message) {
    return new ApiError(envelope.message, {
      status: response.status,
      code: envelope.code ?? 'UNKNOWN',
      details: envelope.details ?? null,
    });
  }

  if (response) {
    return new ApiError('The server had a problem. Please try again.', {
      status: response.status,
      code: 'UNEXPECTED_RESPONSE',
    });
  }

  return new ApiError(
    'Unable to reach the server. Check your connection and try again.',
    { code: 'NETWORK_ERROR' },
  );
}
