import { describe, expect, it } from 'vitest';
import { ARGON2_OPTIONS, hashPassword, verifyPassword } from '../src/utils/password';

describe('hashing password (CLAUDE.md §6 aturan #2)', () => {
  it('tidak pernah menyimpan password dalam bentuk plaintext', async () => {
    const plain = 'Password123!';
    const hashed = await hashPassword(plain);

    expect(hashed).not.toContain(plain);
    expect(hashed.startsWith('$argon2id$')).toBe(true);
  });

  it('bukan MD5 maupun SHA1 — panjang & prefiks hash argon2id', async () => {
    const hashed = await hashPassword('Password123!');

    // MD5 = 32 hex, SHA1 = 40 hex. Keduanya tidak punya prefiks $argon2id$.
    expect(hashed).not.toMatch(/^[a-f0-9]{32}$/);
    expect(hashed).not.toMatch(/^[a-f0-9]{40}$/);
    expect(hashed).toMatch(/^\$argon2id\$v=19\$/);
  });

  it('memakai parameter OWASP m=19456, t=2, p=1', async () => {
    const hashed = await hashPassword('Password123!');

    expect(ARGON2_OPTIONS).toEqual({ memoryCost: 19456, timeCost: 2, parallelism: 1 });
    expect(hashed).toContain('m=19456,t=2,p=1');
  });

  it('memberi hash berbeda untuk password sama (salt acak per hash)', async () => {
    const a = await hashPassword('Password123!');
    const b = await hashPassword('Password123!');

    expect(a).not.toBe(b);
    // Keduanya tetap terverifikasi — hash berbeda bukan berarti password berbeda.
    expect(await verifyPassword(a, 'Password123!')).toBe(true);
    expect(await verifyPassword(b, 'Password123!')).toBe(true);
  });

  it('menolak password yang salah', async () => {
    const hashed = await hashPassword('Password123!');

    expect(await verifyPassword(hashed, 'Password123')).toBe(false);
    expect(await verifyPassword(hashed, 'password123!')).toBe(false);
    expect(await verifyPassword(hashed, '')).toBe(false);
  });

  it('mengembalikan false (bukan melempar) untuk hash yang rusak', async () => {
    // Satu baris data korup tidak boleh berubah jadi HTTP 500 yang membocorkan
    // keberadaan user.
    await expect(verifyPassword('bukan-hash-argon2', 'Password123!')).resolves.toBe(false);
    await expect(verifyPassword('', 'Password123!')).resolves.toBe(false);
  });
});
