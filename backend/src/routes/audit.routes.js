import { Router } from 'express';
import { list } from '../controllers/audit.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.get('/', authenticate, authorize('ADMIN'), asyncHandler(list));
export default router;

