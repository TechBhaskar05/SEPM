import { Router } from 'express';

import * as categoryController from '../controllers/categoryController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

// Categories are read in the context of "the ones I may pick", which is always
// the signed-in user's, so this one is behind the session like everything else.
router.use(authMiddleware);

router.get('/', categoryController.list);

export default router;
