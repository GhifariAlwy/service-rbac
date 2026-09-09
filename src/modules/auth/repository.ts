import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/database';

/**
 * Lapisan akses data auth. Semuanya lewat Prisma (ADR-007 / §6 aturan #5):
 * prepared statement otomatis, tidak ada string concatenation, tidak ada
 * $queryRawUnsafe di mana pun.
 */
export type Db = PrismaClient | Prisma.TransactionClient;

export function findRoleByKode(kode: string, db: Db = prisma) {
  return db.role.findUnique({ where: { kode } });
}

/**
 * Pencarian user untuk login: identifier boleh berupa username ATAU email
 * (mockup login internal menyebut "Username / NIP / Email Internal").
 */
export function findUserByIdentifier(identifier: string, db: Db = prisma) {
  return db.user.findFirst({
    where: { OR: [{ username: identifier }, { email: identifier }] },
    include: { role: true },
  });
}

export function findUserById(id: bigint, db: Db = prisma) {
  return db.user.findUnique({ where: { id }, include: { role: true } });
}

export function findUserByEmail(email: string, db: Db = prisma) {
  return db.user.findUnique({ where: { email } });
}

export function findUserByNik(nik: string, db: Db = prisma) {
  return db.user.findUnique({ where: { nik } });
}

export function findUserByUsername(username: string, db: Db = prisma) {
  return db.user.findUnique({ where: { username } });
}

export function createUser(data: Prisma.UserUncheckedCreateInput, db: Db = prisma) {
  return db.user.create({ data, include: { role: true } });
}

export function touchLastLogin(id: bigint, db: Db = prisma) {
  return db.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
}

export function createRefreshToken(
  data: { userId: bigint; tokenHash: string; expiresAt: Date },
  db: Db = prisma,
) {
  return db.refreshToken.create({ data });
}

/** Lookup by hash — token mentah tidak pernah disimpan (§6 aturan #1). */
export function findRefreshTokenByHash(tokenHash: string, db: Db = prisma) {
  return db.refreshToken.findFirst({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });
}

export function revokeRefreshToken(id: bigint, db: Db = prisma) {
  return db.refreshToken.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Cabut SELURUH sesi aktif milik satu user. Dipakai saat terdeteksi pemakaian ulang
 * refresh token yang sudah direvoke — indikasi token dicuri, jadi semua sesi
 * (termasuk milik penyerang) langsung dimatikan.
 */
export function revokeAllUserRefreshTokens(userId: bigint, db: Db = prisma) {
  return db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function createEmailVerification(
  data: { userId: bigint; tokenHash: string; expiresAt: Date },
  db: Db = prisma,
) {
  return db.emailVerification.create({ data });
}

export function findEmailVerificationByHash(tokenHash: string, db: Db = prisma) {
  return db.emailVerification.findFirst({ where: { tokenHash } });
}

export function markEmailVerificationUsed(id: bigint, db: Db = prisma) {
  return db.emailVerification.update({ where: { id }, data: { usedAt: new Date() } });
}

export function markUserEmailVerified(userId: bigint, db: Db = prisma) {
  return db.user.update({
    where: { id: userId },
    data: { isEmailVerified: true },
  });
}

/**
 * Menu yang boleh dilihat satu role, beserta flag CRUD-nya.
 * Filter dilakukan DI DALAM query (bukan ambil semua lalu saring di aplikasi),
 * jadi menu role lain tidak pernah ikut terbaca ke memori proses.
 */
export function findMenuAccessByRole(roleId: bigint, db: Db = prisma) {
  return db.roleMenuAccess.findMany({
    where: { roleId, canView: true, menu: { isActive: true } },
    include: { menu: true },
    orderBy: [{ menu: { urutan: 'asc' } }, { menu: { id: 'asc' } }],
  });
}
