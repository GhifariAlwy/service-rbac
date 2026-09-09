import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store, createFakeLogger } from './helpers/fake-repo';
import { hashToken } from '../src/utils/token';

/**
 * Rotasi refresh token (CLAUDE.md §6 aturan #1) diuji terhadap penyimpanan
 * in-memory: yang diperiksa adalah keputusannya (revoke yang lama, terbitkan yang
 * baru, cabut semua sesi saat token bekas dipakai ulang), bukan query Prisma-nya.
 */
vi.mock('../src/utils/jwt', () => ({
  signAccessToken: vi.fn(() => 'access-token-palsu'),
}));

vi.mock('../src/utils/mailer', () => ({
  sendMailAsync: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  prisma: {
    // Transaksi dijalankan langsung dengan klien tiruan yang sama.
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
  },
}));

vi.mock('../src/modules/auth/repository', () => ({
  findRefreshTokenByHash: vi.fn(async (tokenHash: string) => {
    const row = store.refreshTokens.find((t) => t.tokenHash === tokenHash);
    if (!row) return null;
    const user = store.users.find((u) => u.id === row.userId);
    return { ...row, user };
  }),
  revokeRefreshToken: vi.fn(async (id: bigint) => {
    const row = store.refreshTokens.find((t) => t.id === id);
    if (row) row.revokedAt = new Date();
    return { count: row ? 1 : 0 };
  }),
  revokeAllUserRefreshTokens: vi.fn(async (userId: bigint) => {
    let count = 0;
    for (const row of store.refreshTokens) {
      if (row.userId === userId && row.revokedAt === null) {
        row.revokedAt = new Date();
        count += 1;
      }
    }
    return { count };
  }),
  createRefreshToken: vi.fn(async (data: { userId: bigint; tokenHash: string; expiresAt: Date }) =>
    store.addRefreshToken(data),
  ),
  findUserByIdentifier: vi.fn(),
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByNik: vi.fn(),
  findUserByUsername: vi.fn(),
  findRoleByKode: vi.fn(),
  createUser: vi.fn(),
  touchLastLogin: vi.fn(),
  createEmailVerification: vi.fn(),
  findEmailVerificationByHash: vi.fn(),
  markEmailVerificationUsed: vi.fn(),
  markUserEmailVerified: vi.fn(),
  findMenuAccessByRole: vi.fn(),
}));

const { refresh } = await import('../src/modules/auth/service');
type ServiceLogger = Parameters<typeof refresh>[1];

const USER_ID = 7n;

function seedUser(isActive = true): void {
  store.addUser({
    id: USER_ID,
    nama: 'Yosep',
    username: 'yosep',
    email: 'yosep@example.com',
    passwordHash: 'x',
    roleId: 1n,
    isEmailVerified: true,
    isActive,
    nik: null,
    role: { id: 1n, kode: 'CALON_PESERTA', nama: 'Calon Peserta' },
  });
}

function issueToken(raw: string, expiresInMs = 7 * 24 * 3600 * 1000) {
  return store.addRefreshToken({
    userId: USER_ID,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + expiresInMs),
  });
}

describe('rotasi refresh token (CLAUDE.md §6 aturan #1)', () => {
  beforeEach(() => {
    store.reset();
    seedUser();
  });

  it('menerbitkan token baru dan langsung merevoke token lama', async () => {
    const original = issueToken('token-lama');
    const { logger } = createFakeLogger();

    const hasil = await refresh('token-lama', logger as unknown as ServiceLogger);

    expect(hasil.refreshToken).not.toBe('token-lama');
    expect(hasil.accessToken).toBe('access-token-palsu');
    expect(original.revokedAt).not.toBeNull();

    // Persis satu token aktif tersisa: yang baru.
    const aktif = store.activeTokensOf(USER_ID);
    expect(aktif).toHaveLength(1);
    expect(aktif[0].tokenHash).toBe(hashToken(hasil.refreshToken));
  });

  it('menolak token lama yang sudah dirotasi', async () => {
    issueToken('token-lama');
    const { logger } = createFakeLogger();

    await refresh('token-lama', logger as unknown as ServiceLogger);

    await expect(refresh('token-lama', logger as unknown as ServiceLogger)).rejects.toThrow(
      'Refresh token tidak valid',
    );
  });

  it('mencabut SELURUH sesi user saat token bekas dipakai ulang', async () => {
    // Skenario token dicuri: penyerang memakai token yang sudah dirotasi pemilik sah.
    issueToken('token-lama');
    issueToken('sesi-perangkat-lain');
    const { logger, entries } = createFakeLogger();

    const hasilPertama = await refresh('token-lama', logger as unknown as ServiceLogger);
    expect(store.activeTokensOf(USER_ID).length).toBe(2); // token baru + sesi perangkat lain

    await expect(refresh('token-lama', logger as unknown as ServiceLogger)).rejects.toThrow();

    // Semua sesi mati, termasuk milik pemilik sah — lebih baik memaksa login ulang
    // daripada membiarkan penyerang ikut memperpanjang akses.
    expect(store.activeTokensOf(USER_ID)).toHaveLength(0);
    expect(
      entries.some((e) => e.level === 'warn' && e.message.includes('pemakaian ulang')),
    ).toBe(true);

    // Token hasil rotasi pertama pun sudah tidak berlaku lagi.
    await expect(
      refresh(hasilPertama.refreshToken, logger as unknown as ServiceLogger),
    ).rejects.toThrow('Refresh token tidak valid');
  });

  it('menolak token yang tidak dikenal tanpa membocorkan alasannya', async () => {
    const { logger } = createFakeLogger();
    await expect(refresh('token-karangan', logger as unknown as ServiceLogger)).rejects.toThrow(
      'Refresh token tidak valid',
    );
  });

  it('menolak token yang sudah kedaluwarsa', async () => {
    issueToken('token-kedaluwarsa', -1000);
    const { logger } = createFakeLogger();

    await expect(refresh('token-kedaluwarsa', logger as unknown as ServiceLogger)).rejects.toThrow(
      'kedaluwarsa',
    );
  });

  it('tidak memperpanjang masa berlaku sesi saat rotasi', async () => {
    // Kalau rotasi ikut memperpanjang expires_at, sesi bisa hidup selamanya hanya
    // dengan sering me-refresh.
    const original = issueToken('token-lama');
    const { logger } = createFakeLogger();

    const hasil = await refresh('token-lama', logger as unknown as ServiceLogger);

    expect(hasil.refreshExpiresAt.getTime()).toBe(original.expiresAt.getTime());
  });

  it('mencabut sesi dan menolak refresh bila akun dinonaktifkan', async () => {
    store.users[0].isActive = false;
    issueToken('token-lama');
    const { logger } = createFakeLogger();

    await expect(refresh('token-lama', logger as unknown as ServiceLogger)).rejects.toThrow(
      'tidak aktif',
    );
    expect(store.activeTokensOf(USER_ID)).toHaveLength(0);
  });
});
