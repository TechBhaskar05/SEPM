import { Router } from 'express';

import * as subscriptionController from '../controllers/subscriptionController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

router.use(authMiddleware);

router.post('/', subscriptionController.create);
router.get('/', subscriptionController.list);
router.get('/:id', subscriptionController.getOne);
router.patch('/:id', subscriptionController.update);
router.delete('/:id', subscriptionController.remove);

export default router;
