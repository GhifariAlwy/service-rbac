import { z } from 'zod';
import { LOGIN_CHANNELS } from '../../domain/roles';
import { sanitizeText } from '../../utils/sanitize';

/**
 * Skema registrasi publik mengikuti modal "Daftar Akun Peserta" pada mockup
 * 1_index.html: hanya NIK, Nama Lengkap, dan Email. TIDAK ADA field role di sini —
 * role dipaksa CALON_PESERTA di service (CLAUDE.md §6 aturan #3).
 *
 * Kalaupun klien nekat mengirim `role`/`role_id`, Zod strip field tak dikenal
 * sehingga nilainya tidak pernah sampai ke lapisan berikutnya.
 */
export const registerSchema = z.object({
  nik: z
    .string()
    .trim()
    .regex(/^[0-9]{16}$/, 'NIK harus 16 digit angka'),
  nama: z
    .string()
    .trim()
    .min(3, 'Nama minimal 3 karakter')
    .max(150, 'Nama maksimal 150 karakter')
    .transform(sanitizeText),
  email: z.string().trim().toLowerCase().email('Format email tidak valid').max(150),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const verifyEmailSchema = z.object({
  token: z
    .string()
    .trim()
    .min(20, 'Token verifikasi tidak valid')
    .max(200, 'Token verifikasi tidak valid'),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

const scopeEnum = z.preprocess(
  (val) => (typeof val === 'string' ? val.toUpperCase() : val),
  z.enum(LOGIN_CHANNELS, {
    errorMap: () => ({ message: 'scope harus publik atau internal' }),
  }),
);

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1, 'Username atau email wajib diisi').max(150),
    password: z.string().min(1, 'Password wajib diisi').max(200),
    // Mendukung `scope` ("publik" | "internal") dan `channel` ("PUBLIK" | "INTERNAL")
    scope: scopeEnum.optional(),
    channel: scopeEnum.optional(),
    remember_me: z.boolean().default(false),
  })
  .refine((data) => data.scope !== undefined || data.channel !== undefined, {
    message: 'scope harus publik atau internal',
    path: ['scope'],
  })
  .transform((data) => {
    const resolved = (data.scope ?? data.channel) as (typeof LOGIN_CHANNELS)[number];
    return {
      ...data,
      channel: resolved,
      scope: resolved.toLowerCase() as 'publik' | 'internal',
    };
  });
export type LoginInput = z.infer<typeof loginSchema>;
