import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv();

/**
 * Loader environment ter-validasi Zod (CLAUDE.md §3).
 * Proses sengaja gagal cepat saat boot kalau ada env yang hilang/salah bentuk,
 * supaya container tidak pernah berjalan dengan konfigurasi setengah benar.
 *
 * Semua secret HANYA datang dari environment variable, tidak ada nilai asli
 * yang di-hardcode di repo (CLAUDE.md §6 aturan #15).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVICE_NAME: z.string().min(1).default('service-rbac'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL wajib diisi'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  REFRESH_TOKEN_TTL_REMEMBER_DAYS: z.coerce.number().int().positive().default(30),
  JWT_PRIVATE_KEY_PATH: z.string().min(1).default('/run/secrets/private.pem'),
  JWT_PUBLIC_KEY_PATH: z.string().min(1).default('/run/secrets/public.pem'),
  JWT_ISSUER: z.string().min(1).default('beasiswa-rbac'),
  JWT_AUDIENCE: z.string().min(1).default('beasiswa-app'),
  REFRESH_COOKIE_NAME: z.string().min(1).default('refresh_token'),
  // Cookie refresh WAJIB Secure (CLAUDE.md §6 aturan #1). Browser memperlakukan
  // http://localhost sebagai origin tepercaya, jadi ini tetap berfungsi saat dev.
  REFRESH_COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  REFRESH_COOKIE_PATH: z.string().min(1).default('/api/auth'),
  SMTP_HOST: z.string().min(1).default('mailhog'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().min(1).default('no-reply@beasiswa.local'),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  process.stderr.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'service-rbac',
      message: 'konfigurasi environment tidak valid',
      detail,
    })}\n`,
  );
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
