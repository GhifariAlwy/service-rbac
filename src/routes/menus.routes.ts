import { Router } from 'express';
import { ROLES, requireAuth, requireRole, validate } from '../middlewares';
import * as controller from '../modules/menus/controller';
import { menuUpsertSchema } from '../modules/menus/schema';
import { idParamSchema, listQuerySchema } from '../modules/users/schema';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/', validate(listQuerySchema, 'query'), asyncHandler(controller.list));
router.post('/', validate(menuUpsertSchema), asyncHandler(controller.create));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(controller.detail));
router.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(menuUpsertSchema),
  asyncHandler(controller.update),
);
router.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(controller.remove));

export default router;
