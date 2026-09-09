import { randomInt } from 'node:crypto';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { ROLE_CODES, isRoleAllowedForChannel } from '../../domain/roles';
import type { LoginChannel } from '../../domain/roles';
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../utils/errors';
import { signAccessToken } from '../../utils/jwt';
import type { Logger } from '../../utils/logger';
import { sendMailAsync } from '../../utils/mailer';
import { hashPassword, verifyPassword } from '../../utils/password';
import { generateOpaqueToken, hashToken } from '../../utils/token';
import { buildMenuTree } from './menu-tree';
import type { MenuTreeItem } from './menu-tree';
import * as repo from './repository';
import type { LoginInput, RegisterInput } from './schema';

const EMAIL_VERIFICATION_TTL_HOURS = 24;

/**
 * Alfabet tanpa karakter yang mudah tertukar (0/O, 1/l/I) — password sementara ini
 * dibaca manusia dari email lalu diketik ulang.
 */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const PASSWORD_SYMBOLS = '!@#$%&*';

/** Password sementara acak dari CSPRNG, bukan Math.random (yang bisa diprediksi). */
function generateTemporaryPassword(): string {
  let out = '';
  for (let i = 0; i < 11; i += 1) {
    out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  }
  return out + PASSWORD_SYMBOLS[randomInt(PASSWORD_SYMBOLS.length)];
}

/**
 * Username publik di-generate dari bagian sebelum "@" pada email (ASUMSI-03),
 * dengan suffix angka bila bentrok. Loop dibatasi supaya tidak berputar selamanya.
 */
async function generateUniqueUsername(email: string): Promise<string> {
  const base =
    (email.split('@')[0] ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 40) || 'peserta';

  if (!(await repo.findUserByUsername(base))) return base;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `${base}${randomInt(1000, 9999)}`;
    if (!(await repo.findUserByUsername(candidate))) return candidate;
  }
  throw new ConflictError('Gagal membuat username unik, coba lagi beberapa saat');
}

export interface RegisterResult {
  user_id: bigint;
  email: string;
}

/**
 * Registrasi publik. Role DIPAKSA CALON_PESERTA — parameter `input` tidak punya
 * field role sama sekali dan kode ini melakukan lookup role by kode, bukan by id
 * dari request. Akun dibuat is_active = false dan baru aktif setelah email
 * diverifikasi.
 */
export async function register(input: RegisterInput, log: Logger): Promise<RegisterResult> {
  const [byEmail, byNik] = await Promise.all([
    repo.findUserByEmail(input.email),
    repo.findUserByNik(input.nik),
  ]);
  if (byEmail) throw new ConflictError('Email sudah terdaftar');
  if (byNik) throw new ConflictError('NIK sudah terdaftar');

  const role = await repo.findRoleByKode(ROLE_CODES.CALON_PESERTA);
  if (!role) throw new NotFoundError('Role CALON_PESERTA belum tersedia, hubungi administrator');

  const username = await generateUniqueUsername(input.email);
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const rawToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 3600 * 1000);

  // User + token verifikasi dibuat dalam satu transaksi: tidak boleh ada akun
  // yang lahir tanpa jalan untuk mengaktifkannya.
  const user = await prisma.$transaction(async (tx) => {
    const created = await repo.createUser(
      {
        nik: input.nik,
        nama: input.nama,
        username,
        email: input.email,
        passwordHash,
        roleId: role.id,
        isEmailVerified: false,
        // Akun belum aktif sebelum verifikasi email.
        isActive: false,
      },
      tx,
    );
    await repo.createEmailVerification(
      { userId: created.id, tokenHash: hashToken(rawToken), expiresAt },
      tx,
    );
    return created;
  });

  const verifyUrl = `${env.APP_BASE_URL}/verifikasi-email?token=${rawToken}`;
  sendMailAsync(
    {
      to: user.email,
      subject: 'Aktivasi Akun Beasiswa Pelatihan',
      text: [
        `Halo ${user.nama},`,
        '',
        'Akun Anda sudah dibuat. Berikut kredensial sementara:',
        `  Username : ${username}`,
        `  Password : ${temporaryPassword}`,
        '',
        'Aktifkan akun Anda lewat tautan berikut (berlaku 24 jam):',
        verifyUrl,
        '',
        'Abaikan email ini bila Anda tidak merasa mendaftar.',
      ].join('\n'),
    },
    log,
  );

  // Password sementara TIDAK dikembalikan lewat API dan tidak pernah masuk log.
  log.info('registrasi calon peserta berhasil', { user_id: String(user.id) });

  return { user_id: user.id, email: user.email };
}

/**
 * Verifikasi email. Token dicari lewat hash-nya, lalu ditandai terpakai sekali saja
 * dalam satu transaksi bersama pengaktifan akun.
 */
export async function verifyEmail(rawToken: string): Promise<void> {
  const record = await repo.findEmailVerificationByHash(hashToken(rawToken));
  if (!record) throw new NotFoundError('Token verifikasi tidak ditemukan');
  if (record.usedAt) throw new ConflictError('Token verifikasi sudah pernah dipakai');
  if (record.expiresAt.getTime() < Date.now()) {
    throw new NotFoundError('Token verifikasi sudah kedaluwarsa');
  }

  await prisma.$transaction(async (tx) => {
    await repo.markEmailVerificationUsed(record.id, tx);
    await repo.markUserEmailVerified(record.userId, tx);
    // Akun baru aktif setelah email terverifikasi.
    await tx.user.update({ where: { id: record.userId }, data: { isActive: true } });
  });
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  expiresIn: number;
  user: {
    id: bigint;
    nama: string;
    username: string;
    email: string;
    role: string;
  };
}

function refreshTtlMs(rememberMe: boolean): number {
  const days = rememberMe ? env.REFRESH_TOKEN_TTL_REMEMBER_DAYS : env.REFRESH_TOKEN_TTL_DAYS;
  return days * 24 * 3600 * 1000;
}

/**
 * Login. Urutan pemeriksaan dijaga supaya pesan error tidak membocorkan
 * user mana yang ada di database:
 *   1. cari user
 *   2. verifikasi password (tetap dijalankan walau user tidak ada — lihat di bawah)
 *   3. cek email terverifikasi & akun aktif
 *   4. cek role terhadap channel
 *
 * Role diambil dari `user.role.kode` hasil query database, TIDAK PERNAH dari input
 * pengguna (CLAUDE.md §6 aturan #3).
 */
export async function login(input: LoginInput, log: Logger): Promise<LoginResult> {
  const user = await repo.findUserByIdentifier(input.identifier);

  if (!user) {
    // Hash dummy supaya waktu respons untuk user tak dikenal mirip dengan user yang
    // ada; tanpa ini, selisih waktu bisa dipakai mengenumerasi akun.
    await hashPassword(input.password);
    throw new UnauthorizedError('Username/email atau password salah');
  }

  const passwordOk = await verifyPassword(user.passwordHash, input.password);
  if (!passwordOk) {
    log.warn('login gagal: password salah', { user_id: String(user.id) });
    throw new UnauthorizedError('Username/email atau password salah');
  }

  if (!user.isEmailVerified) {
    throw new ForbiddenError('Email belum diverifikasi. Periksa kotak masuk email Anda.');
  }
  if (!user.isActive) {
    throw new ForbiddenError('Akun Anda tidak aktif. Hubungi administrator.');
  }

  const channel = ((input.channel ?? input.scope)?.toUpperCase()) as LoginChannel;
  if (!isRoleAllowedForChannel(user.role.kode, channel)) {
    log.warn('login ditolak: role tidak sesuai channel', {
      user_id: String(user.id),
      role: user.role.kode,
      channel,
    });
    throw new ForbiddenError(
      channel === 'INTERNAL'
        ? 'Akun ini bukan akun internal. Silakan login lewat halaman peserta.'
        : 'Akun internal harus login lewat halaman login internal.',
    );
  }

  const accessToken = signAccessToken(user.id, user.role.kode);
  const rawRefresh = generateOpaqueToken();
  const refreshExpiresAt = new Date(Date.now() + refreshTtlMs(input.remember_me));

  await prisma.$transaction(async (tx) => {
    await repo.createRefreshToken(
      { userId: user.id, tokenHash: hashToken(rawRefresh), expiresAt: refreshExpiresAt },
      tx,
    );
    await repo.touchLastLogin(user.id, tx);
  });

  log.info('login berhasil', { user_id: String(user.id), role: user.role.kode, channel });

  return {
    accessToken,
    refreshToken: rawRefresh,
    refreshExpiresAt,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    user: {
      id: user.id,
      nama: user.nama,
      username: user.username,
      email: user.email,
      role: user.role.kode,
    },
  };
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  expiresIn: number;
}

/**
 * Rotasi refresh token (CLAUDE.md §6 aturan #1).
 *
 * Token lama langsung direvoke dan diganti yang baru. Kalau token yang SUDAH direvoke
 * dipakai lagi, itu tanda token bocor/dicuri (pemilik sah dan penyerang memegang
 * token yang sama), sehingga SELURUH sesi user dicabut — lebih baik memaksa semua
 * perangkat login ulang daripada membiarkan penyerang ikut memperpanjang aksesnya.
 */
export async function refresh(rawToken: string, log: Logger): Promise<RefreshResult> {
  const record = await repo.findRefreshTokenByHash(hashToken(rawToken));
  if (!record) throw new UnauthorizedError('Refresh token tidak valid');

  if (record.revokedAt) {
    await repo.revokeAllUserRefreshTokens(record.userId);
    log.warn('deteksi pemakaian ulang refresh token, seluruh sesi user dicabut', {
      user_id: String(record.userId),
    });
    throw new UnauthorizedError('Refresh token tidak valid');
  }

  if (record.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError('Refresh token sudah kedaluwarsa');
  }

  if (!record.user.isActive) {
    await repo.revokeAllUserRefreshTokens(record.userId);
    throw new ForbiddenError('Akun Anda tidak aktif. Hubungi administrator.');
  }

  const rawNext = generateOpaqueToken();
  // Sisa masa berlaku dipertahankan: rotasi tidak boleh memperpanjang sesi
  // tanpa batas hanya karena token sering di-refresh.
  const refreshExpiresAt = record.expiresAt;

  await prisma.$transaction(async (tx) => {
    const revoked = await repo.revokeRefreshToken(record.id, tx);
    if (revoked.count !== 1) {
      await repo.revokeAllUserRefreshTokens(record.userId, tx);
      throw new UnauthorizedError('Refresh token tidak valid');
    }
    await repo.createRefreshToken(
      { userId: record.userId, tokenHash: hashToken(rawNext), expiresAt: refreshExpiresAt },
      tx,
    );
  });

  log.info('refresh token dirotasi', { user_id: String(record.userId) });

  return {
    accessToken: signAccessToken(record.userId, record.user.role.kode),
    refreshToken: rawNext,
    refreshExpiresAt,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  };
}

/** Logout: revoke token yang dipakai. Token tak dikenal diperlakukan diam-diam sukses. */
export async function logout(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  const record = await repo.findRefreshTokenByHash(hashToken(rawToken));
  if (record && !record.revokedAt) {
    await repo.revokeRefreshToken(record.id);
  }
}

export async function me(userId: bigint) {
  const user = await repo.findUserById(userId);
  if (!user) throw new NotFoundError('User tidak ditemukan');

  return {
    id: user.id,
    nik: user.nik,
    nama: user.nama,
    username: user.username,
    email: user.email,
    role: user.role.kode,
    is_email_verified: user.isEmailVerified,
  };
}

/** Menu bertingkat sesuai role user yang sedang login. */
export async function myMenus(userId: bigint): Promise<MenuTreeItem[]> {
  const user = await repo.findUserById(userId);
  if (!user) throw new NotFoundError('User tidak ditemukan');

  const rows = await repo.findMenuAccessByRole(user.roleId);
  return buildMenuTree(rows);
}
