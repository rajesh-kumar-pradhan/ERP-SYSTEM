import { Router } from 'express';
import * as controller from '../controllers/customer.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { customerSchema } from '../validators/customer.validator.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.use(authenticate);
router.get('/', asyncHandler(controller.list));
router.post('/', authorize('SALES_USER', 'ADMIN'), validate(customerSchema), asyncHandler(controller.create));
export default router;

