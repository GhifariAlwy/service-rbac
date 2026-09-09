import { hash, verify } from '@node-rs/argon2';

/**
 * Parameter argon2id mengikuti rekomendasi OWASP Password Storage Cheat Sheet
 * (m=19 MiB, t=2, p=1). Dipusatkan di satu tempat supaya seed, modul auth, dan
 * CRUD user tidak pernah memakai parameter yang berbeda-beda.
 *
 * CLAUDE.md §6 aturan #2: password TIDAK PERNAH plaintext, TIDAK PERNAH MD5/SHA1.
 */
export const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

/**
 * Mengembalikan false (bukan melempar) untuk hash yang rusak/tidak dikenal, supaya
 * satu baris data korup tidak berubah menjadi HTTP 500 yang membocorkan keberadaan user.
 */
export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
