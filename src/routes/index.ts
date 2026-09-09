import { Router } from 'express';
import authRoutes from './auth.routes';
import healthRoutes from './health.routes';
import menusRoutes from './menus.routes';
import rolesRoutes from './roles.routes';
import usersRoutes from './users.routes';

const router = Router();

router.use('/health', healthRoutes);

/**
 * Prefix /api dipertahankan apa adanya karena API Gateway meneruskan path asli
 * (req.originalUrl), bukan path yang sudah dipotong.
 */
router.use('/api/auth', authRoutes);
router.use('/api/users', usersRoutes);
router.use('/api/roles', rolesRoutes);
router.use('/api/menus', menusRoutes);

export default router;
