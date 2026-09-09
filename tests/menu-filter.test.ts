import { describe, expect, it } from 'vitest';
import { buildMenuTree } from '../src/modules/auth/menu-tree';
import type { MenuAccessRow, MenuTreeItem } from '../src/modules/auth/menu-tree';

/**
 * Filter menu per role (CLAUDE.md §9: sidebar dirender dari my-menus, bukan array
 * hardcoded). Baris akses di sini mewakili apa yang dikembalikan query
 * findMenuAccessByRole — yang sudah memfilter canView dan isActive DI DALAM query.
 */
const MENUS = {
  dashboard: { id: 1n, parentId: null, nama: 'Dashboard Saya', path: '/dashboard', icon: 'bi-speedometer2', urutan: 1 },
  pendaftaran: { id: 2n, parentId: null, nama: 'Pendaftaran', path: '/pendaftaran', icon: 'bi-journal-plus', urutan: 2 },
  verifikasi: { id: 3n, parentId: null, nama: 'Verifikasi Seleksi Administrasi', path: '/verifikasi', icon: 'bi-file-earmark-check', urutan: 3 },
  wawancara: { id: 4n, parentId: null, nama: 'Proses Wawancara', path: '/wawancara', icon: 'bi-chat-square-text', urutan: 4 },
  adminDash: { id: 5n, parentId: null, nama: 'Dashboard', path: '/admin', icon: 'bi-speedometer2', urutan: 5 },
  master: { id: 7n, parentId: null, nama: 'Data Master', path: '/admin/master', icon: 'bi-database', urutan: 7 },
  masterBeasiswa: { id: 9n, parentId: 7n, nama: 'CRUD Beasiswa Pelatihan', path: '/admin/master/beasiswa', icon: 'bi-mortarboard', urutan: 1 },
  masterSyarat: { id: 10n, parentId: 7n, nama: 'CRUD Persyaratan', path: '/admin/master/persyaratan', icon: 'bi-list-check', urutan: 2 },
};

function row(menu: (typeof MENUS)[keyof typeof MENUS], write = false): MenuAccessRow {
  return {
    menu,
    canView: true,
    canCreate: write,
    canUpdate: write,
    canDelete: write,
  };
}

function paths(items: MenuTreeItem[]): string[] {
  return items.flatMap((item) => [item.path, ...paths(item.children)]);
}

describe('filter menu per role', () => {
  it('CALON_PESERTA hanya melihat menu peserta', () => {
    const tree = buildMenuTree([row(MENUS.dashboard), row(MENUS.pendaftaran, true)]);

    expect(paths(tree)).toEqual(['/dashboard', '/pendaftaran']);
    expect(paths(tree)).not.toContain('/verifikasi');
    expect(paths(tree)).not.toContain('/admin');
  });

  it('VERIFIKATOR hanya melihat /verifikasi', () => {
    const tree = buildMenuTree([row(MENUS.verifikasi, true)]);

    expect(paths(tree)).toEqual(['/verifikasi']);
    expect(paths(tree)).not.toContain('/wawancara');
  });

  it('LEMBAGA_SELEKSI hanya melihat /wawancara', () => {
    const tree = buildMenuTree([row(MENUS.wawancara, true)]);

    expect(paths(tree)).toEqual(['/wawancara']);
    expect(paths(tree)).not.toContain('/verifikasi');
  });

  it('ADMIN melihat menu admin lengkap beserta submenunya', () => {
    const tree = buildMenuTree([
      row(MENUS.adminDash),
      row(MENUS.master, true),
      row(MENUS.masterBeasiswa, true),
      row(MENUS.masterSyarat, true),
    ]);

    expect(paths(tree)).toEqual([
      '/admin',
      '/admin/master',
      '/admin/master/beasiswa',
      '/admin/master/persyaratan',
    ]);

    const master = tree.find((m) => m.path === '/admin/master');
    expect(master?.children).toHaveLength(2);
  });

  it('role berbeda menghasilkan pohon menu yang berbeda', () => {
    const peserta = paths(buildMenuTree([row(MENUS.dashboard), row(MENUS.pendaftaran)]));
    const verifikator = paths(buildMenuTree([row(MENUS.verifikasi)]));

    expect(peserta).not.toEqual(verifikator);
    expect(peserta.some((p) => verifikator.includes(p))).toBe(false);
  });

  it('membawa flag can_view/create/update/delete apa adanya', () => {
    const tree = buildMenuTree([row(MENUS.dashboard, false), row(MENUS.pendaftaran, true)]);

    expect(tree[0]).toMatchObject({
      path: '/dashboard',
      can_view: true,
      can_create: false,
      can_update: false,
      can_delete: false,
    });
    expect(tree[1]).toMatchObject({
      path: '/pendaftaran',
      can_view: true,
      can_create: true,
      can_update: true,
      can_delete: true,
    });
  });

  it('mengurutkan menu berdasarkan kolom urutan, bukan urutan baris masukan', () => {
    const tree = buildMenuTree([row(MENUS.wawancara), row(MENUS.dashboard), row(MENUS.verifikasi)]);

    expect(paths(tree)).toEqual(['/dashboard', '/verifikasi', '/wawancara']);
  });

  it('submenu tetap tampil sebagai akar bila induknya tidak diizinkan', () => {
    // Kalau submenu dibuang hanya karena induknya tidak diberi akses, menu yang
    // sebenarnya boleh dilihat akan hilang tanpa jejak dari sidebar.
    const tree = buildMenuTree([row(MENUS.masterBeasiswa, true)]);

    expect(paths(tree)).toEqual(['/admin/master/beasiswa']);
    expect(tree).toHaveLength(1);
  });

  it('mengembalikan array kosong bila role tidak punya akses menu sama sekali', () => {
    expect(buildMenuTree([])).toEqual([]);
  });
});
