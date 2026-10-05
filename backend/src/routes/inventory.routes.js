import { Router } from 'express';
import * as controller from '../controllers/inventory.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { receiptSchema } from '../validators/inventory.validator.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);
router.get('/', asyncHandler(controller.list));
router.get('/movements', authorize('ADMIN'), asyncHandler(controller.movements));
router.post('/receipts', authorize('ADMIN'), validate(receiptSchema), asyncHandler(controller.receive));
export default router;

