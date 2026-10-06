import { Router } from 'express';
import { create, list } from '../controllers/product.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { productSchema } from '../validators/product.validator.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.get('/', authenticate, asyncHandler(list));
router.post('/', authenticate, authorize('ADMIN'), validate(productSchema), asyncHandler(create));
export default router;

