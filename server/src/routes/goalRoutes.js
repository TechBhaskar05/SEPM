import { Router } from 'express';

import * as goalController from '../controllers/goalController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = Router();

// Every goal is user-scoped, so all of them require a session.
router.use(authMiddleware);

router.post('/', goalController.create);
router.get('/', goalController.list);
router.get('/:id', goalController.getOne);
router.patch('/:id', goalController.update);
router.delete('/:id', goalController.remove);

export default router;
