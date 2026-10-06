import { Router } from 'express';
import * as controller from '../controllers/quotation.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { quotationSchema, quotationStatusSchema } from '../validators/quotation.validator.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));
router.post('/', authorize('SALES_USER'), validate(quotationSchema), asyncHandler(controller.create));
router.patch('/:id/status', authorize('SALES_USER'), validate(quotationStatusSchema), asyncHandler(controller.updateStatus));
router.post('/:id/convert', authorize('SALES_USER'), asyncHandler(controller.convert));
export default router;

