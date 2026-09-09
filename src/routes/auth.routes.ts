import { Router } from 'express';
import * as controller from '../modules/auth/controller';
import { loginSchema, registerSchema, verifyEmailSchema } from '../modules/auth/schema';
import { requireAuth, validate } from '../middlewares';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

// --- Publik (rate limit ketat dipasang di API Gateway) ---
router.post('/register', validate(registerSchema), asyncHandler(controller.register));
router.get('/verify-email', validate(verifyEmailSchema, 'query'), asyncHandler(controller.verifyEmail));
router.post('/login', validate(loginSchema), asyncHandler(controller.login));
router.post('/refresh', asyncHandler(controller.refresh));

// --- Butuh identitas dari Gateway ---
router.post('/logout', asyncHandler(controller.logout));
router.get('/me', requireAuth, asyncHandler(controller.me));
router.get('/my-menus', requireAuth, asyncHandler(controller.myMenus));

export default router;
