import { z } from 'zod';
import { sanitizeText } from '../../utils/sanitize';

export const idParamSchema = z.object({
  id: z.coerce.bigint().positive('ID tidak valid'),
});
export type IdParam = z.infer<typeof idParamSchema>;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().max(150).optional(),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

/**
 * Password minimal 8 karakter dengan huruf besar, kecil, dan angka.
 * Dipakai Admin saat membuat user internal; peserta publik tidak lewat jalur ini.
 */
const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(200, 'Password maksimal 200 karakter')
  .regex(/[a-z]/, 'Password harus memuat huruf kecil')
  .regex(/[A-Z]/, 'Password harus memuat huruf besar')
  .regex(/[0-9]/, 'Password harus memuat angka');

export const userCreateSchema = z.object({
  nama: z.string().trim().min(3).max(150).transform(sanitizeText),
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .max(50)
    .regex(/^[a-zA-Z0-9._@-]+$/, 'Username hanya boleh huruf, angka, dan . _ - @'),
  email: z.string().trim().toLowerCase().email('Format email tidak valid').max(150),
  // role_id dari Admin yang sudah terautentikasi — berbeda jauh dari role yang
  // dikirim sendiri oleh orang yang mendaftar (yang selalu diabaikan).
  role_id: z.coerce.bigint().positive('role_id tidak valid'),
  password: passwordSchema,
  nik: z
    .string()
    .trim()
    .regex(/^[0-9]{16}$/, 'NIK harus 16 digit angka')
    .optional(),
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;

export const userUpdateSchema = z
  .object({
    nama: z.string().trim().min(3).max(150).transform(sanitizeText).optional(),
    username: z
      .string()
      .trim()
      .min(3)
      .max(50)
      .regex(/^[a-zA-Z0-9._@-]+$/, 'Username hanya boleh huruf, angka, dan . _ - @')
      .optional(),
    email: z.string().trim().toLowerCase().email('Format email tidak valid').max(150).optional(),
    role_id: z.coerce.bigint().positive().optional(),
    is_active: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Tidak ada field yang diubah',
  });
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
