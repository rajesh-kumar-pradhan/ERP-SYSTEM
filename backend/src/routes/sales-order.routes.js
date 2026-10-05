import { Router } from 'express';
import * as controller from '../controllers/sales-order.controller.js';
import { create as dispatch } from '../controllers/dispatch.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { dispatchSchema } from '../validators/dispatch.validator.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));
router.post('/:id/confirm', authorize('ADMIN'), asyncHandler(controller.confirm));
router.post('/:id/dispatch', authorize('ADMIN'), validate(dispatchSchema), asyncHandler(dispatch));
export default router;

