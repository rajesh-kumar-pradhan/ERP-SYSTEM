import { Router } from 'express';
import { list } from '../controllers/product.controller.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.get('/', authenticate, asyncHandler(list));
export default router;

