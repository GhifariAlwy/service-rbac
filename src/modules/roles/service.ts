import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { buildPagination } from '../../utils/response';
import type { ListQuery } from '../users/schema';
import type { RoleMenuAccessInput, RoleUpsertInput } from './schema';

export async function list(query: ListQuery) {
  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.role.count(),
    prisma.role.findMany({ orderBy: { id: 'asc' }, skip, take: query.limit }),
  ]);
  return { items, pagination: buildPagination(query.page, query.limit, total) };
}

export async function detail(id: bigint) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      roleMenuAccesses: {
        include: { menu: { select: { id: true, nama: true, path: true } } },
        orderBy: { menuId: 'asc' },
      },
    },
  });
  if (!role) throw new NotFoundError('Role tidak ditemukan');
  return role;
}

export async function create(input: RoleUpsertInput) {
  const existing = await prisma.role.findUnique({ where: { kode: input.kode } });
  if (existing) throw new ConflictError('Kode role sudah dipakai');
  return prisma.role.create({ data: input });
}

export async function update(id: bigint, input: RoleUpsertInput) {
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Role tidak ditemukan');

  const conflict = await prisma.role.findFirst({
    where: { kode: input.kode, NOT: { id } },
  });
  if (conflict) throw new ConflictError('Kode role sudah dipakai role lain');

  return prisma.role.update({ where: { id }, data: input });
}

export async function remove(id: bigint) {
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Role tidak ditemukan');

  // Role yang masih dipakai tidak boleh dihapus: menghapusnya akan membuat user
  // menggantung tanpa role, dan otorisasi mereka jadi tidak terdefinisi.
  const used = await prisma.user.count({ where: { roleId: id } });
  if (used > 0) {
    throw new ConflictError(`Role masih dipakai oleh ${used} user, tidak dapat dihapus`);
  }

  await prisma.role.delete({ where: { id } });
}

/** Ganti seluruh matriks akses menu untuk satu role, dalam satu transaksi. */
export async function setMenuAccess(roleId: bigint, input: RoleMenuAccessInput) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new NotFoundError('Role tidak ditemukan');

  const menuIds = input.akses.map((a) => a.menu_id);
  if (menuIds.length > 0) {
    const found = await prisma.menu.count({ where: { id: { in: menuIds } } });
    if (found !== new Set(menuIds.map(String)).size) {
      throw new ValidationError('Validasi gagal', [
        { field: 'akses', message: 'Ada menu_id yang tidak ditemukan' },
      ]);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.roleMenuAccess.deleteMany({ where: { roleId } });
    if (input.akses.length > 0) {
      await tx.roleMenuAccess.createMany({
        data: input.akses.map((a) => ({
          roleId,
          menuId: a.menu_id,
          canView: a.can_view,
          canCreate: a.can_create,
          canUpdate: a.can_update,
          canDelete: a.can_delete,
        })),
      });
    }
  });

  return detail(roleId);
}
