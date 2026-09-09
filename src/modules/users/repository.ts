import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';

/** Field yang boleh keluar ke klien. password_hash TIDAK PERNAH ikut di-select. */
export const USER_SELECT = {
  id: true,
  nik: true,
  nama: true,
  username: true,
  email: true,
  isEmailVerified: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: { select: { id: true, kode: true, nama: true, createdAt: true, updatedAt: true } },
} satisfies Prisma.UserSelect;

export function buildSearchWhere(search?: string): Prisma.UserWhereInput {
  if (!search) return {};
  return {
    OR: [
      { nama: { contains: search } },
      { username: { contains: search } },
      { email: { contains: search } },
    ],
  };
}

export function countUsers(where: Prisma.UserWhereInput) {
  return prisma.user.count({ where });
}

export function listUsers(where: Prisma.UserWhereInput, skip: number, take: number) {
  return prisma.user.findMany({
    where,
    select: USER_SELECT,
    orderBy: { id: 'desc' },
    skip,
    take,
  });
}

export function findUserById(id: bigint) {
  return prisma.user.findUnique({ where: { id }, select: USER_SELECT });
}

export function createUser(data: Prisma.UserUncheckedCreateInput) {
  return prisma.user.create({ data, select: USER_SELECT });
}

export function updateUser(id: bigint, data: Prisma.UserUncheckedUpdateInput) {
  return prisma.user.update({ where: { id }, data, select: USER_SELECT });
}

export function deleteUser(id: bigint) {
  return prisma.user.delete({ where: { id } });
}

export function findRoleById(id: bigint) {
  return prisma.role.findUnique({ where: { id } });
}

/** Cek bentrok username/email, mengecualikan user yang sedang diubah. */
export function findConflict(username: string | undefined, email: string | undefined, exceptId?: bigint) {
  const or: Prisma.UserWhereInput[] = [];
  if (username) or.push({ username });
  if (email) or.push({ email });
  if (or.length === 0) return null;

  return prisma.user.findFirst({
    where: { OR: or, ...(exceptId === undefined ? {} : { NOT: { id: exceptId } }) },
  });
}
