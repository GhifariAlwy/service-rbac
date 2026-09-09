/**
 * Pembentukan struktur menu bertingkat untuk GET /api/auth/my-menus.
 *
 * Dipisah dari service supaya bisa diuji tanpa database (lihat tests/menu-filter.test.ts).
 * Sidebar frontend dirender dari hasil endpoint ini, bukan dari array hardcoded
 * (CLAUDE.md §9) — kalau di-hardcode, seluruh modul RBAC jadi hiasan.
 */
export interface MenuAccessRow {
  menu: {
    id: bigint;
    parentId: bigint | null;
    nama: string;
    path: string;
    icon: string | null;
    urutan: number;
  };
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface MenuTreeItem {
  id: bigint;
  nama: string;
  path: string;
  icon: string | null;
  urutan: number;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  children: MenuTreeItem[];
}

/**
 * Menyusun daftar datar menjadi pohon. Menu yang parent-nya TIDAK ikut diizinkan
 * untuk role ini diangkat menjadi akar, supaya menu yang boleh dilihat tidak hilang
 * hanya karena induknya tidak diberi akses.
 */
export function buildMenuTree(rows: MenuAccessRow[]): MenuTreeItem[] {
  const byId = new Map<string, MenuTreeItem>();

  for (const row of rows) {
    byId.set(String(row.menu.id), {
      id: row.menu.id,
      nama: row.menu.nama,
      path: row.menu.path,
      icon: row.menu.icon,
      urutan: row.menu.urutan,
      can_view: row.canView,
      can_create: row.canCreate,
      can_update: row.canUpdate,
      can_delete: row.canDelete,
      children: [],
    });
  }

  const roots: MenuTreeItem[] = [];

  for (const row of rows) {
    const node = byId.get(String(row.menu.id));
    if (!node) continue;

    const parentKey = row.menu.parentId === null ? null : String(row.menu.parentId);
    const parent = parentKey === null ? undefined : byId.get(parentKey);

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortByUrutan = (items: MenuTreeItem[]): void => {
    items.sort((a, b) => (a.urutan === b.urutan ? Number(a.id - b.id) : a.urutan - b.urutan));
    for (const item of items) sortByUrutan(item.children);
  };
  sortByUrutan(roots);

  return roots;
}
