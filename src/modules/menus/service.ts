import { prisma } from '../../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { buildPagination } from '../../utils/response';
import type { ListQuery } from '../users/schema';
import type { MenuUpsertInput } from './schema';

export async function list(query: ListQuery) {
  const skip = (query.page - 1) * query.limit;
  const [total, items] = await Promise.all([
    prisma.menu.count(),
    prisma.menu.findMany({
      orderBy: [{ urutan: 'asc' }, { id: 'asc' }],
      skip,
      take: query.limit,
    }),
  ]);
  return { items, pagination: buildPagination(query.page, query.limit, total) };
}

export async function detail(id: bigint) {
  const menu = await prisma.menu.findUnique({ where: { id } });
  if (!menu) throw new NotFoundError('Menu tidak ditemukan');
  return menu;
}

async function assertParentValid(parentId: bigint | null | undefined, selfId?: bigint): Promise<void> {
  if (parentId === null || parentId === undefined) return;

  if (selfId !== undefined && parentId === selfId) {
    throw new ValidationError('Validasi gagal', [
      { field: 'parent_id', message: 'Menu tidak boleh menjadi induk dirinya sendiri' },
    ]);
  }

  const parent = await prisma.menu.findUnique({ where: { id: parentId } });
  if (!parent) {
    throw new ValidationError('Validasi gagal', [
      { field: 'parent_id', message: 'Menu induk tidak ditemukan' },
    ]);
  }

  // Cegah siklus: menu tidak boleh dijadikan anak dari keturunannya sendiri,
  // karena pohon menu jadi tak berujung saat dirender.
  if (selfId !== undefined) {
    let cursor: bigint | null = parent.parentId;
    let guard = 0;
    while (cursor !== null && guard < 50) {
      if (cursor === selfId) {
        throw new ValidationError('Validasi gagal', [
          { field: 'parent_id', message: 'Perubahan ini membentuk siklus pada struktur menu' },
        ]);
      }
      const next: { parentId: bigint | null } | null = await prisma.menu.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = next?.parentId ?? null;
      guard += 1;
    }
  }
}

function toData(input: MenuUpsertInput) {
  return {
    parentId: input.parent_id ?? null,
    nama: input.nama,
    path: input.path,
    icon: input.icon ?? null,
    urutan: input.urutan,
    isActive: input.is_active,
  };
}

export async function create(input: MenuUpsertInput) {
  await assertParentValid(input.parent_id);
  return prisma.menu.create({ data: toData(input) });
}

export async function update(id: bigint, input: MenuUpsertInput) {
  const existing = await prisma.menu.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Menu tidak ditemukan');

  await assertParentValid(input.parent_id, id);
  return prisma.menu.update({ where: { id }, data: toData(input) });
}

export async function remove(id: bigint) {
  const existing = await prisma.menu.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Menu tidak ditemukan');

  const children = await prisma.menu.count({ where: { parentId: id } });
  if (children > 0) {
    throw new ConflictError(`Menu masih punya ${children} submenu, hapus submenu terlebih dahulu`);
  }

  // role_menu_access ikut terhapus lewat FK ON DELETE CASCADE.
  await prisma.menu.delete({ where: { id } });
}
