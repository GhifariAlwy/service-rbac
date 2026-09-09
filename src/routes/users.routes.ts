import { Router } from 'express';
import { ROLES, requireAuth, requireRole, validate } from '../middlewares';
import * as controller from '../modules/users/controller';
import {
  idParamSchema,
  listQuerySchema,
  userCreateSchema,
  userUpdateSchema,
} from '../modules/users/schema';
import { asyncHandler } from '../utils/async-handler';

const router = Router();

// Seluruh CRUD user khusus ADMIN. Role dibaca dari header X-User-Role yang ditulis
// Gateway setelah verifikasi tanda tangan JWT, bukan dari body/query klien.
router.use(requireAuth, requireRole(ROLES.ADMIN));

router.get('/', validate(listQuerySchema, 'query'), asyncHandler(controller.list));
router.post('/', validate(userCreateSchema), asyncHandler(controller.create));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(controller.detail));
router.put(
  '/:id',
  validate(idParamSchema, 'params'),
  validate(userUpdateSchema),
  asyncHandler(controller.update),
);
router.delete('/:id', validate(idParamSchema, 'params'), asyncHandler(controller.remove));

export default router;
