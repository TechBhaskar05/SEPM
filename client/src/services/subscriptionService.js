import { api, toApiError } from './httpClient.js';

async function request(config) {
  try {
    const { data } = await api.request(config);
    return data;
  } catch (error) {
    throw toApiError(error);
  }
}

export function listSubscriptions() {
  return request({ method: 'get', url: '/subscriptions' });
}

export function getSubscription(id) {
  return request({ method: 'get', url: `/subscriptions/${id}` }).then(
    (data) => data.subscription,
  );
}

export function createSubscription(payload) {
  return request({ method: 'post', url: '/subscriptions', data: payload }).then(
    (data) => data.subscription,
  );
}

export function updateSubscription(id, payload) {
  return request({
    method: 'patch',
    url: `/subscriptions/${id}`,
    data: payload,
  }).then((data) => data.subscription);
}

export function deleteSubscription(id) {
  return request({ method: 'delete', url: `/subscriptions/${id}` });
}
