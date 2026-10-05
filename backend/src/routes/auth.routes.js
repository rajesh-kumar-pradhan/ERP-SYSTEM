import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { loginSchema } from '../validators/auth.validator.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
router.post('/login', validate(loginSchema), asyncHandler(controller.login));
router.get('/me', authenticate, controller.me);
export default router;

