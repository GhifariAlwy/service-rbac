import { z } from 'zod';
import { sanitizeText } from '../../utils/sanitize';

export const roleUpsertSchema = z.object({
  kode: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, 'Kode role minimal 3 karakter')
    .max(30)
    .regex(/^[A-Z_]+$/, 'Kode role hanya boleh huruf kapital dan underscore'),
  nama: z.string().trim().min(3).max(100).transform(sanitizeText),
});
export type RoleUpsertInput = z.infer<typeof roleUpsertSchema>;

/**
 * Pengaturan akses menu per role (tab "CRUD Role & Akses Menu" pada mockup
 * 4_index_admin.html). Daftar bersifat menggantikan seluruh akses role tersebut,
 * bukan menambah — supaya mencabut akses cukup dengan menghilangkan barisnya.
 */
export const roleMenuAccessSchema = z.object({
  akses: z
    .array(
      z.object({
        menu_id: z.coerce.bigint().positive('menu_id tidak valid'),
        can_view: z.boolean().default(false),
        can_create: z.boolean().default(false),
        can_update: z.boolean().default(false),
        can_delete: z.boolean().default(false),
      }),
    )
    .max(200, 'Terlalu banyak baris akses dalam satu permintaan'),
});
export type RoleMenuAccessInput = z.infer<typeof roleMenuAccessSchema>;
