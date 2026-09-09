import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

export const USER_ID_HEADER = 'x-user-id';
export const USER_ROLE_HEADER = 'x-user-role';

export const ROLES = {
  CALON_PESERTA: 'CALON_PESERTA',
  VERIFIKATOR: 'VERIFIKATOR',
  LEMBAGA_SELEKSI: 'LEMBAGA_SELEKSI',
  ADMIN: 'ADMIN',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

/**
 * Service backend TIDAK memverifikasi JWT sendiri. API Gateway yang memverifikasi
 * tanda tangan RS256, lalu meneruskan identitas terverifikasi lewat header internal
 * X-User-Id / X-User-Role (CLAUDE.md §7).
 *
 * Ini hanya aman selama service backend TIDAK bisa dihubungi langsung dari luar —
 * karena itu larangan `ports:` pada service backend di docker-compose (§6 aturan #9)
 * adalah bagian tak terpisahkan dari model keamanan ini, bukan sekadar preferensi.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const rawId = req.header(USER_ID_HEADER);
  const role = req.header(USER_ROLE_HEADER);

  if (!rawId || !role) {
    next(new UnauthorizedError());
    return;
  }

  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    next(new UnauthorizedError());
    return;
  }

  req.user = { id, role };
  next();
}

/** Batasi endpoint ke role tertentu. Role SELALU berasal dari Gateway, bukan body/query. */
export function requireRole(...allowed: RoleCode[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!allowed.includes(req.user.role as RoleCode)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
