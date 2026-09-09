import { z } from 'zod';
import { sanitizeText } from '../../utils/sanitize';

export const menuUpsertSchema = z.object({
  parent_id: z.coerce.bigint().positive().nullable().optional(),
  nama: z.string().trim().min(2).max(100).transform(sanitizeText),
  // Path route frontend, bukan URL bebas — dibatasi supaya tidak bisa dipakai
  // menyuntikkan `javascript:` atau tautan eksternal ke dalam sidebar.
  path: z
    .string()
    .trim()
    .min(1)
    .max(150)
    .regex(/^\/[A-Za-z0-9\-_/]*$/, 'Path harus diawali "/" dan hanya huruf, angka, - _ /'),
  icon: z
    .string()
    .trim()
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Icon hanya boleh huruf kecil, angka, dan tanda hubung')
    .optional(),
  urutan: z.coerce.number().int().min(0).max(9999).default(0),
  is_active: z.boolean().default(true),
});
export type MenuUpsertInput = z.infer<typeof menuUpsertSchema>;
