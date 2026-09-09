import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store, createFakeLogger } from './helpers/fake-repo';
import {
  INTERNAL_ROLES,
  PUBLIC_ROLES,
  ROLE_CODES,
  isRoleAllowedForChannel,
} from '../src/domain/roles';
import { hashPassword } from '../src/utils/password';

/**
 * Penolakan login lintas channel (CLAUDE.md §6 aturan #4):
 * login internal menolak CALON_PESERTA, login publik menolak role internal.
 */
vi.mock('../src/utils/jwt', () => ({ signAccessToken: vi.fn(() => 'access-token-palsu') }));
vi.mock('../src/utils/mailer', () => ({ sendMailAsync: vi.fn() }));
vi.mock('../src/config/database', () => ({
  prisma: { $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}) },
}));

vi.mock('../src/modules/auth/repository', () => ({
  findUserByIdentifier: vi.fn(async (identifier: string) =>
    store.users.find((u) => u.username === identifier || u.email === identifier) ?? null,
  ),
  createRefreshToken: vi.fn(async (data: { userId: bigint; tokenHash: string; expiresAt: Date }) =>
    store.addRefreshToken(data),
  ),
  touchLastLogin: vi.fn(async () => undefined),
  findRefreshTokenByHash: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllUserRefreshTokens: vi.fn(),
  findUserById: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserByNik: vi.fn(),
  findUserByUsername: vi.fn(),
  findRoleByKode: vi.fn(),
  createUser: vi.fn(),
  createEmailVerification: vi.fn(),
  findEmailVerificationByHash: vi.fn(),
  markEmailVerificationUsed: vi.fn(),
  markUserEmailVerified: vi.fn(),
  findMenuAccessByRole: vi.fn(),
}));

const { login } = await import('../src/modules/auth/service');
type ServiceLogger = Parameters<typeof login>[1];
type LoginInput = Parameters<typeof login>[0];

const PASSWORD = 'Password123!';
let passwordHash = '';

async function addUser(kode: string, username: string, overrides: Partial<{ isActive: boolean; isEmailVerified: boolean }> = {}) {
  store.addUser({
    id: BigInt(store.users.length + 1),
    nama: username,
    username,
    email: `${username}@beasiswa.local`,
    passwordHash,
    roleId: 1n,
    isEmailVerified: overrides.isEmailVerified ?? true,
    isActive: overrides.isActive ?? true,
    nik: null,
    role: { id: 1n, kode, nama: kode },
  });
}

function input(identifier: string, channel: 'PUBLIK' | 'INTERNAL', password = PASSWORD): LoginInput {
  return { identifier, password, channel, remember_me: false } as LoginInput;
}

describe('pemetaan role terhadap channel', () => {
  it('CALON_PESERTA hanya boleh lewat channel PUBLIK', () => {
    expect(isRoleAllowedForChannel(ROLE_CODES.CALON_PESERTA, 'PUBLIK')).toBe(true);
    expect(isRoleAllowedForChannel(ROLE_CODES.CALON_PESERTA, 'INTERNAL')).toBe(false);
  });

  it('role internal hanya boleh lewat channel INTERNAL', () => {
    for (const kode of INTERNAL_ROLES) {
      expect(isRoleAllowedForChannel(kode, 'INTERNAL')).toBe(true);
      expect(isRoleAllowedForChannel(kode, 'PUBLIK')).toBe(false);
    }
  });

  it('tidak ada role yang boleh lewat kedua channel sekaligus', () => {
    const beririsan = INTERNAL_ROLES.filter((r) => PUBLIC_ROLES.includes(r));
    expect(beririsan).toEqual([]);
  });

  it('role yang tidak dikenal ditolak di kedua channel (default deny)', () => {
    expect(isRoleAllowedForChannel('SUPERUSER', 'INTERNAL')).toBe(false);
    expect(isRoleAllowedForChannel('SUPERUSER', 'PUBLIK')).toBe(false);
  });
});

describe('login lintas channel ditolak (CLAUDE.md §6 aturan #4)', () => {
  beforeEach(async () => {
    store.reset();
    if (!passwordHash) passwordHash = await hashPassword(PASSWORD);
    await addUser(ROLE_CODES.CALON_PESERTA, 'peserta');
    await addUser(ROLE_CODES.VERIFIKATOR, 'verifikator');
    await addUser(ROLE_CODES.LEMBAGA_SELEKSI, 'lembaga');
    await addUser(ROLE_CODES.ADMIN, 'admin');
  });

  it('menolak CALON_PESERTA lewat login internal', async () => {
    const { logger } = createFakeLogger();
    await expect(login(input('peserta', 'INTERNAL'), logger as unknown as ServiceLogger)).rejects.toThrow(
      'bukan akun internal',
    );
  });

  it('menolak VERIFIKATOR, LEMBAGA_SELEKSI, dan ADMIN lewat login publik', async () => {
    const { logger } = createFakeLogger();
    for (const username of ['verifikator', 'lembaga', 'admin']) {
      await expect(login(input(username, 'PUBLIK'), logger as unknown as ServiceLogger)).rejects.toThrow(
        'halaman login internal',
      );
    }
  });

  it('mengizinkan tiap role lewat channel yang benar', async () => {
    const { logger } = createFakeLogger();

    const peserta = await login(input('peserta', 'PUBLIK'), logger as unknown as ServiceLogger);
    expect(peserta.user.role).toBe(ROLE_CODES.CALON_PESERTA);

    for (const username of ['verifikator', 'lembaga', 'admin']) {
      const hasil = await login(input(username, 'INTERNAL'), logger as unknown as ServiceLogger);
      expect(INTERNAL_ROLES).toContain(hasil.user.role);
    }
  });

  it('role SELALU dari database, tidak dari input pengguna (§6 aturan #3)', async () => {
    const { logger } = createFakeLogger();

    // Dropdown "Masuk Sebagai" pada mockup bersifat kosmetik. Sekalipun klien nekat
    // menyisipkan field role/role_id ke body, hasilnya tetap role dari database.
    const nekat = {
      ...input('verifikator', 'INTERNAL'),
      role: 'ADMIN',
      role_id: 4,
    } as unknown as LoginInput;

    const hasil = await login(nekat, logger as unknown as ServiceLogger);
    expect(hasil.user.role).toBe(ROLE_CODES.VERIFIKATOR);
    expect(hasil.user.role).not.toBe(ROLE_CODES.ADMIN);
  });

  it('menolak password salah dengan pesan yang tidak membedakan user ada/tidak', async () => {
    const { logger } = createFakeLogger();

    const salahPassword = login(
      input('peserta', 'PUBLIK', 'PasswordSalah1!'),
      logger as unknown as ServiceLogger,
    );
    const userTakAda = login(
      input('tidak-ada', 'PUBLIK', 'PasswordSalah1!'),
      logger as unknown as ServiceLogger,
    );

    await expect(salahPassword).rejects.toThrow('Username/email atau password salah');
    await expect(userTakAda).rejects.toThrow('Username/email atau password salah');
  });

  it('menolak login sebelum email diverifikasi', async () => {
    store.reset();
    await addUser(ROLE_CODES.CALON_PESERTA, 'belumverif', { isEmailVerified: false, isActive: false });
    const { logger } = createFakeLogger();

    await expect(login(input('belumverif', 'PUBLIK'), logger as unknown as ServiceLogger)).rejects.toThrow(
      'Email belum diverifikasi',
    );
  });

  it('menolak login untuk akun yang dinonaktifkan', async () => {
    store.reset();
    await addUser(ROLE_CODES.ADMIN, 'nonaktif', { isActive: false });
    const { logger } = createFakeLogger();

    await expect(login(input('nonaktif', 'INTERNAL'), logger as unknown as ServiceLogger)).rejects.toThrow(
      'tidak aktif',
    );
  });

  describe('parameter scope ("publik" | "internal")', () => {
    it('mengizinkan login menggunakan parameter scope: "internal" untuk akun internal', async () => {
      const { logger } = createFakeLogger();
      const hasil = await login(
        { identifier: 'admin', password: PASSWORD, scope: 'internal', remember_me: false } as unknown as LoginInput,
        logger as unknown as ServiceLogger,
      );
      expect(hasil.user.role).toBe(ROLE_CODES.ADMIN);
    });

    it('mengizinkan login menggunakan parameter scope: "publik" untuk calon peserta', async () => {
      const { logger } = createFakeLogger();
      const hasil = await login(
        { identifier: 'peserta', password: PASSWORD, scope: 'publik', remember_me: false } as unknown as LoginInput,
        logger as unknown as ServiceLogger,
      );
      expect(hasil.user.role).toBe(ROLE_CODES.CALON_PESERTA);
    });

    it('menolak calon peserta yang mencoba login dengan scope: "internal"', async () => {
      const { logger } = createFakeLogger();
      await expect(
        login(
          { identifier: 'peserta', password: PASSWORD, scope: 'internal', remember_me: false } as unknown as LoginInput,
          logger as unknown as ServiceLogger,
        ),
      ).rejects.toThrow('bukan akun internal');
    });

    it('menolak akun internal yang mencoba login dengan scope: "publik"', async () => {
      const { logger } = createFakeLogger();
      await expect(
        login(
          { identifier: 'admin', password: PASSWORD, scope: 'publik', remember_me: false } as unknown as LoginInput,
          logger as unknown as ServiceLogger,
        ),
      ).rejects.toThrow('halaman login internal');
    });
  });
});
