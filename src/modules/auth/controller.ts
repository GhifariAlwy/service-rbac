import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { UnauthorizedError } from '../../utils/errors';
import { sendSuccess } from '../../utils/response';
import * as service from './service';
import type { LoginInput, RegisterInput, VerifyEmailInput } from './schema';

/**
 * Refresh token dikirim sebagai cookie HttpOnly + Secure + SameSite=Strict
 * (CLAUDE.md §6 aturan #1 & #7):
 *  - HttpOnly  : JavaScript (termasuk payload XSS) tidak bisa membacanya.
 *  - Secure    : tidak pernah dikirim lewat HTTP polos.
 *  - SameSite=Strict : cookie tidak ikut terkirim pada request lintas situs,
 *                      sehingga CSRF pada endpoint refresh tertutup.
 *  - path      : dibatasi ke /api/auth supaya tidak ikut di setiap request API.
 */
function refreshCookieOptions(expires: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: env.REFRESH_COOKIE_SECURE,
    sameSite: 'strict',
    path: env.REFRESH_COOKIE_PATH,
    expires,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const input = req.body as RegisterInput;
  const result = await service.register(input, req.log);

  sendSuccess(
    res,
    { user_id: result.user_id, email: result.email },
    'Registrasi berhasil. Username dan password sementara telah dikirim ke email Anda.',
    201,
  );
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  const { token } = req.query as unknown as VerifyEmailInput;
  await service.verifyEmail(token);
  sendSuccess(res, null, 'Email berhasil diverifikasi. Akun Anda sudah aktif.');
}

export async function login(req: Request, res: Response): Promise<void> {
  const input = req.body as LoginInput;
  const result = await service.login(input, req.log);

  res.cookie(env.REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshExpiresAt));

  // Refresh token TIDAK ikut di body: kalau ada di JSON, ia bisa dibaca JavaScript
  // dan sifat HttpOnly cookie jadi percuma.
  sendSuccess(
    res,
    {
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: result.expiresIn,
      user: result.user,
    },
    'Login berhasil',
  );
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies as Record<string, string> | undefined)?.[env.REFRESH_COOKIE_NAME];
  if (!raw) throw new UnauthorizedError('Refresh token tidak ditemukan');

  const result = await service.refresh(raw, req.log);

  res.cookie(env.REFRESH_COOKIE_NAME, result.refreshToken, refreshCookieOptions(result.refreshExpiresAt));

  sendSuccess(
    res,
    {
      access_token: result.accessToken,
      token_type: 'Bearer',
      expires_in: result.expiresIn,
    },
    'Access token diperbarui',
  );
}

export async function logout(req: Request, res: Response): Promise<void> {
  const raw = (req.cookies as Record<string, string> | undefined)?.[env.REFRESH_COOKIE_NAME];
  await service.logout(raw);

  res.clearCookie(env.REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.REFRESH_COOKIE_SECURE,
    sameSite: 'strict',
    path: env.REFRESH_COOKIE_PATH,
  });

  sendSuccess(res, null, 'Logout berhasil');
}

export async function me(req: Request, res: Response): Promise<void> {
  // req.user diisi dari header X-User-Id yang ditulis Gateway setelah verifikasi JWT.
  const data = await service.me(BigInt(req.user!.id));
  sendSuccess(res, data);
}

export async function myMenus(req: Request, res: Response): Promise<void> {
  const data = await service.myMenus(BigInt(req.user!.id));
  sendSuccess(res, data);
}
