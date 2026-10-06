import { Router } from 'express';
import * as controller from '../controllers/enquiry.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { enquirySchema, enquiryStatusSchema } from '../validators/enquiry.validator.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.get));
router.post('/', authorize('SALES_USER'), validate(enquirySchema), asyncHandler(controller.create));
router.patch('/:id/status', authorize('SALES_USER'), validate(enquiryStatusSchema), asyncHandler(controller.updateStatus));
export default router;

