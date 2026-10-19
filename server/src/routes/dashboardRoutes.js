import { Router } from 'express';

import * as dashboardController from '../controllers/dashboardController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

// The dashboard is always the signed-in user's own data.
router.use(authMiddleware);

router.get('/', dashboardController.getDashboard);

export default router;
