import * as subscriptionService from '../services/subscriptionService.js';
import {
  createSubscriptionSchema,
  idParamSchema,
  updateSubscriptionSchema,
} from '../validators/subscriptionValidator.js';

export async function create(req, res) {
  const data = createSubscriptionSchema.parse(req.body);
  const subscription = await subscriptionService.createSubscription(
    req.user.id,
    data,
  );
  res.status(201).json({ subscription });
}

export async function list(req, res) {
  const result = await subscriptionService.getSubscriptionsForUser(req.user.id);
  res.json(result);
}

export async function getOne(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const subscription = await subscriptionService.getSubscription(
    req.user.id,
    id,
  );
  res.json({ subscription });
}

export async function update(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const data = updateSubscriptionSchema.parse(req.body);
  const subscription = await subscriptionService.updateSubscription(
    req.user.id,
    id,
    data,
  );
  res.json({ subscription });
}

export async function remove(req, res) {
  const { id } = idParamSchema.parse(req.params);
  await subscriptionService.deleteSubscription(req.user.id, id);
  res.status(204).end();
}
