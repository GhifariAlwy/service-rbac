import { Router } from 'express';
import { ROLES, requireAuth, requireRole, validate } from '../middlewares';
import * as controller from '../modules/roles/controller';
import { roleMenuAccessSchema, roleUpsertSchema } from '../modules/roles/schema';
import { idParamSchema, listQuerySchema } from '../modules/users/schema';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/', validate(listQuerySchema, 'query'), asyncHandler(controller.list));
router.post('/', validate(roleUpsertSchema), asyncHandler(controller.create));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(controller.detail));
router.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(roleUpsertSchema),
  asyncHandler(controller.update),
);
router.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(controller.remove));

// Pengaturan akses menu per role — tab "CRUD Role & Akses Menu" di 4_index_admin.html.
router.put(
  '/:id/menu-access',
  validate(idParamSchema, 'params'),
  validate(roleMenuAccessSchema),
  asyncHandler(controller.setMenuAccess),
);

export default router;
