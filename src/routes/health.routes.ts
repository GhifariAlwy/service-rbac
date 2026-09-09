import { Router } from 'express';
import { getHealth } from '../modules/health/controller';

const router = Router();

router.get('/', getHealth);

export default router;
