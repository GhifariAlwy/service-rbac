/**
 * Seed db_rbac — IDEMPOTEN: aman dijalankan berulang kali, tidak menggandakan data
 * dan tidak menimpa password akun yang sudah ada.
 *
 * Isi:
 *   1. Empat role sesuai CLAUDE.md §4
 *   2. Struktur menu bertingkat sesuai sidebar mockup 4_index_admin.html,
 *      2_index_verifikator.html, dan 3_index_wawancara.html
 *   3. Matriks akses menu per role
 *   4. Satu akun demo untuk tiap role
 *
 * Password demo diambil dari SEED_DEMO_PASSWORD. Kalau tidak diisi, seed memakai
 * "Password123!" — ini SENGAJA hanya untuk lingkungan demo/pengujian lokal dan
 * TIDAK BOLEH dipakai di produksi (CLAUDE.md §6 aturan #15: kredensial asli hanya
 * lewat environment variable).
 */
import { PrismaClient } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

/** Sama persis dengan src/utils/password.ts — rekomendasi OWASP. */
const ARGON2_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Password123!';

const ROLES = [
  { kode: 'CALON_PESERTA', nama: 'Calon Peserta' },
  { kode: 'VERIFIKATOR', nama: 'Verifikator' },
  { kode: 'LEMBAGA_SELEKSI', nama: 'Lembaga Seleksi' },
  { kode: 'ADMIN', nama: 'Administrator System' },
] as const;

interface MenuSeed {
  nama: string;
  path: string;
  icon: string;
  urutan: number;
  children?: MenuSeed[];
}

/**
 * Struktur menu. Submenu Admin diambil dari tab-tab di dalam mockup
 * 4_index_admin.html: "Data Master" punya sub-tab CRUD Beasiswa & CRUD Persyaratan,
 * "Setting System" punya sub-tab CRUD Users / Role & Akses Menu / Menu System.
 */
const MENUS: MenuSeed[] = [
  { nama: 'Dashboard Saya', path: '/dashboard', icon: 'bi-speedometer2', urutan: 1 },
  { nama: 'Pendaftaran', path: '/pendaftaran', icon: 'bi-journal-plus', urutan: 2 },
  {
    nama: 'Verifikasi Seleksi Administrasi',
    path: '/verifikasi',
    icon: 'bi-file-earmark-check',
    urutan: 3,
  },
  { nama: 'Proses Wawancara', path: '/wawancara', icon: 'bi-chat-square-text', urutan: 4 },
  { nama: 'Dashboard', path: '/admin', icon: 'bi-speedometer2', urutan: 5 },
  {
    nama: 'Hasil Seleksi',
    path: '/admin/hasil-seleksi',
    icon: 'bi-file-earmark-spreadsheet',
    urutan: 6,
  },
  {
    nama: 'Data Master',
    path: '/admin/master',
    icon: 'bi-database',
    urutan: 7,
    children: [
      { nama: 'CRUD Beasiswa Pelatihan', path: '/admin/master/beasiswa', icon: 'bi-mortarboard', urutan: 1 },
      { nama: 'CRUD Persyaratan', path: '/admin/master/persyaratan', icon: 'bi-list-check', urutan: 2 },
    ],
  },
  {
    nama: 'Setting System',
    path: '/admin/setting',
    icon: 'bi-sliders',
    urutan: 8,
    children: [
      { nama: 'CRUD Users Internal', path: '/admin/setting/users', icon: 'bi-people', urutan: 1 },
      { nama: 'CRUD Role & Akses Menu', path: '/admin/setting/roles', icon: 'bi-shield-lock', urutan: 2 },
      { nama: 'CRUD Menu System', path: '/admin/setting/menus', icon: 'bi-list-nested', urutan: 3 },
    ],
  },
];

/**
 * Matriks akses: peserta hanya menu peserta, verifikator hanya /verifikasi,
 * lembaga seleksi hanya /wawancara, admin semua.
 *
 * `write` menandai role boleh create/update/delete pada menu tersebut. Peserta
 * memang boleh membuat & mengubah pendaftarannya sendiri, tapi batas sesungguhnya
 * ditegakkan di Service Transaksi (status DRAFT/REVISI + kepemilikan), bukan di sini.
 */
const ACCESS: Record<string, { path: string; write: boolean }[]> = {
  CALON_PESERTA: [
    { path: '/dashboard', write: false },
    { path: '/pendaftaran', write: true },
  ],
  VERIFIKATOR: [{ path: '/verifikasi', write: true }],
  LEMBAGA_SELEKSI: [{ path: '/wawancara', write: true }],
  ADMIN: [
    { path: '/admin', write: false },
    { path: '/admin/hasil-seleksi', write: false },
    { path: '/admin/master', write: true },
    { path: '/admin/master/beasiswa', write: true },
    { path: '/admin/master/persyaratan', write: true },
    { path: '/admin/setting', write: true },
    { path: '/admin/setting/users', write: true },
    { path: '/admin/setting/roles', write: true },
    { path: '/admin/setting/menus', write: true },
  ],
};

const DEMO_USERS = [
  { roleKode: 'CALON_PESERTA', nama: 'Yosep Rohayadi', username: 'peserta', email: 'peserta@beasiswa.local', nik: '3201123456780001' },
  { roleKode: 'VERIFIKATOR', nama: 'Ahmad Fauzi', username: 'verifikator', email: 'verifikator@beasiswa.local', nik: null },
  { roleKode: 'LEMBAGA_SELEKSI', nama: 'Dewi Lestari', username: 'lembaga', email: 'lembaga@beasiswa.local', nik: null },
  { roleKode: 'ADMIN', nama: 'Administrator', username: 'admin', email: 'admin@beasiswa.local', nik: null },
] as const;

async function seedRoles(): Promise<Map<string, bigint>> {
  const map = new Map<string, bigint>();
  for (const role of ROLES) {
    const saved = await prisma.role.upsert({
      where: { kode: role.kode },
      update: { nama: role.nama },
      create: { kode: role.kode, nama: role.nama },
    });
    map.set(role.kode, saved.id);
  }
  return map;
}

/** Menu di-upsert berdasarkan `path` (unik secara logis walau tidak unique di DB). */
async function seedMenus(items: MenuSeed[], parentId: bigint | null): Promise<Map<string, bigint>> {
  const map = new Map<string, bigint>();

  for (const item of items) {
    const data = {
      parentId,
      nama: item.nama,
      path: item.path,
      icon: item.icon,
      urutan: item.urutan,
      isActive: true,
    };

    const existing = await prisma.menu.findFirst({ where: { path: item.path } });
    const saved = existing
      ? await prisma.menu.update({ where: { id: existing.id }, data })
      : await prisma.menu.create({ data });

    map.set(item.path, saved.id);

    if (item.children) {
      for (const [path, id] of await seedMenus(item.children, saved.id)) {
        map.set(path, id);
      }
    }
  }

  return map;
}

async function seedAccess(roleIds: Map<string, bigint>, menuIds: Map<string, bigint>): Promise<void> {
  for (const [roleKode, entries] of Object.entries(ACCESS)) {
    const roleId = roleIds.get(roleKode);
    if (roleId === undefined) continue;

    for (const entry of entries) {
      const menuId = menuIds.get(entry.path);
      if (menuId === undefined) continue;

      const flags = {
        canView: true,
        canCreate: entry.write,
        canUpdate: entry.write,
        canDelete: entry.write,
      };

      await prisma.roleMenuAccess.upsert({
        where: { roleId_menuId: { roleId, menuId } },
        update: flags,
        create: { roleId, menuId, ...flags },
      });
    }
  }
}

async function seedUsers(roleIds: Map<string, bigint>): Promise<void> {
  const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS);

  for (const demo of DEMO_USERS) {
    const roleId = roleIds.get(demo.roleKode);
    if (roleId === undefined) continue;

    const existing = await prisma.user.findUnique({ where: { email: demo.email } });
    if (existing) {
      // Password akun yang sudah ada TIDAK ditimpa — kalau operator sudah menggantinya,
      // seed ulang tidak boleh diam-diam mengembalikannya ke password demo.
      await prisma.user.update({
        where: { id: existing.id },
        data: { nama: demo.nama, roleId, isEmailVerified: true, isActive: true },
      });
      continue;
    }

    await prisma.user.create({
      data: {
        nik: demo.nik,
        nama: demo.nama,
        username: demo.username,
        email: demo.email,
        passwordHash,
        roleId,
        isEmailVerified: true,
        isActive: true,
      },
    });
  }
}

async function main(): Promise<void> {
  const roleIds = await seedRoles();
  const menuIds = await seedMenus(MENUS, null);
  await seedAccess(roleIds, menuIds);
  await seedUsers(roleIds);

  process.stdout.write(
    [
      'Seed db_rbac selesai.',
      `  Role  : ${roleIds.size}`,
      `  Menu  : ${menuIds.size}`,
      `  User  : ${DEMO_USERS.length} akun demo (password: ${
        process.env.SEED_DEMO_PASSWORD ? 'dari SEED_DEMO_PASSWORD' : DEMO_PASSWORD
      })`,
      '  PERINGATAN: akun demo ini untuk pengujian lokal. Jangan dipakai di produksi.',
      '',
    ].join('\n'),
  );
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`Seed gagal: ${String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
