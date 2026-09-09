import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Refresh token & token verifikasi email adalah string acak buram (opaque), bukan JWT.
 * Yang disimpan di database HANYA hash SHA-256-nya (CLAUDE.md §6 aturan #1) — kalau
 * dump database bocor, isinya tidak bisa dipakai untuk login.
 *
 * SHA-256 (bukan argon2) sudah memadai di sini karena token punya entropi 256 bit
 * dari CSPRNG; tidak ada ruang tebakan yang bisa di-brute force seperti password manusia.
 */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/** Perbandingan waktu-konstan untuk menutup timing attack pada pencocokan token. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
