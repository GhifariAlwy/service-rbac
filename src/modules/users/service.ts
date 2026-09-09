import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors';
import { hashPassword } from '../../utils/password';
import { buildPagination } from '../../utils/response';
import * as repo from './repository';
import type { ListQuery, UserCreateInput, UserUpdateInput } from './schema';

export async function list(query: ListQuery) {
  const where = repo.buildSearchWhere(query.search);
  const skip = (query.page - 1) * query.limit;

  const [total, items] = await Promise.all([
    repo.countUsers(where),
    repo.listUsers(where, skip, query.limit),
  ]);

  return { items, pagination: buildPagination(query.page, query.limit, total) };
}

export async function detail(id: bigint) {
  const user = await repo.findUserById(id);
  if (!user) throw new NotFoundError('User tidak ditemukan');
  return user;
}

export async function create(input: UserCreateInput) {
  const role = await repo.findRoleById(input.role_id);
  if (!role) throw new ValidationError('Validasi gagal', [{ field: 'role_id', message: 'Role tidak ditemukan' }]);

  const conflict = await repo.findConflict(input.username, input.email);
  if (conflict) throw new ConflictError('Username atau email sudah dipakai');

  return repo.createUser({
    nama: input.nama,
    username: input.username,
    email: input.email,
    nik: input.nik ?? null,
    passwordHash: await hashPassword(input.password),
    roleId: role.id,
    // Akun internal dibuat Admin, jadi langsung aktif dan dianggap terverifikasi.
    isEmailVerified: true,
    isActive: true,
  });
}

export async function update(id: bigint, input: UserUpdateInput) {
  const existing = await repo.findUserById(id);
  if (!existing) throw new NotFoundError('User tidak ditemukan');

  if (input.role_id !== undefined) {
    const role = await repo.findRoleById(input.role_id);
    if (!role) throw new ValidationError('Validasi gagal', [{ field: 'role_id', message: 'Role tidak ditemukan' }]);
  }

  if (input.username !== undefined || input.email !== undefined) {
    const conflict = await repo.findConflict(input.username, input.email, id);
    if (conflict) throw new ConflictError('Username atau email sudah dipakai user lain');
  }

  return repo.updateUser(id, {
    ...(input.nama === undefined ? {} : { nama: input.nama }),
    ...(input.username === undefined ? {} : { username: input.username }),
    ...(input.email === undefined ? {} : { email: input.email }),
    ...(input.role_id === undefined ? {} : { roleId: input.role_id }),
    ...(input.is_active === undefined ? {} : { isActive: input.is_active }),
    // Password baru selalu di-hash argon2id; nilai plaintext tidak pernah disimpan.
    ...(input.password === undefined ? {} : { passwordHash: await hashPassword(input.password) }),
  });
}

export async function remove(id: bigint, actorId: bigint) {
  // Admin tidak boleh menghapus dirinya sendiri: kalau admin terakhir menghapus
  // akunnya, sistem kehilangan seluruh jalan masuk administratif.
  if (id === actorId) throw new ConflictError('Anda tidak dapat menghapus akun Anda sendiri');

  const existing = await repo.findUserById(id);
  if (!existing) throw new NotFoundError('User tidak ditemukan');

  await repo.deleteUser(id);
}
