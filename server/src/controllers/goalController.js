import * as goalService from '../services/goalService.js';
import {
  createGoalSchema,
  idParamSchema,
  updateGoalSchema,
} from '../validators/goalValidator.js';

/**
 * HTTP layer for savings goals. Parsing and validation happen here; all
 * ownership checks and database access belong to goalService.
 */

export async function create(req, res) {
  const data = createGoalSchema.parse(req.body);
  const goal = await goalService.createGoal(req.user.id, data);
  res.status(201).json({ goal });
}

export async function list(req, res) {
  const goals = await goalService.getGoalsForUser(req.user.id);
  res.json({ goals });
}

export async function getOne(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const goal = await goalService.getGoal(req.user.id, id);
  res.json({ goal });
}

export async function update(req, res) {
  const { id } = idParamSchema.parse(req.params);
  const data = updateGoalSchema.parse(req.body);
  const goal = await goalService.updateGoal(req.user.id, id, data);
  res.json({ goal });
}

export async function remove(req, res) {
  const { id } = idParamSchema.parse(req.params);
  await goalService.deleteGoal(req.user.id, id);
  res.status(204).end();
}
