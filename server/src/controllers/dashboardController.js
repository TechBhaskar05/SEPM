import * as dashboardService from '../services/dashboardService.js';
import { dashboardQuerySchema } from '../validators/dashboardValidator.js';

/**
 * HTTP layer for the dashboard. Validation and response shaping only; the
 * aggregation belongs to dashboardService.
 */
export async function getDashboard(req, res) {
  const { period } = dashboardQuerySchema.parse(req.query);
  const dashboard = await dashboardService.getDashboard(req.user.id, {
    period,
  });

  res.json(dashboard);
}
