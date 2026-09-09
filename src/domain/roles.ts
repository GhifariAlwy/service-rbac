/**
 * Daftar role dan pemetaan channel login (CLAUDE.md §6 aturan #3 & #4).
 *
 * Role SELALU dibaca dari kolom `users.role_id` di database. Dropdown "Masuk Sebagai"
 * pada mockup 1_index_login.html murni kosmetik dan TIDAK PERNAH dikirim/dipercaya
 * server (ASUMSI-24). Kalau role diambil dari input pengguna, siapa pun bisa memilih
 * "Administrator System" di dropdown dan langsung menjadi admin.
 */
export const ROLE_CODES = {
  CALON_PESERTA: 'CALON_PESERTA',
  VERIFIKATOR: 'VERIFIKATOR',
  LEMBAGA_SELEKSI: 'LEMBAGA_SELEKSI',
  ADMIN: 'ADMIN',
} as const;

export type RoleKode = (typeof ROLE_CODES)[keyof typeof ROLE_CODES];

export const LOGIN_CHANNELS = ['PUBLIK', 'INTERNAL'] as const;
export type LoginChannel = (typeof LOGIN_CHANNELS)[number];

/** Role internal: semua role selain calon peserta. */
export const INTERNAL_ROLES: readonly string[] = [
  ROLE_CODES.VERIFIKATOR,
  ROLE_CODES.LEMBAGA_SELEKSI,
  ROLE_CODES.ADMIN,
];

export const PUBLIC_ROLES: readonly string[] = [ROLE_CODES.CALON_PESERTA];

/**
 * Login internal menolak CALON_PESERTA, login publik menolak role internal.
 * `channel` hanya menentukan daftar role yang boleh lewat pintu itu (ASUMSI-25),
 * bukan role yang diklaim pengguna.
 */
export function isRoleAllowedForChannel(roleKode: string, channel: LoginChannel): boolean {
  return channel === 'INTERNAL'
    ? INTERNAL_ROLES.includes(roleKode)
    : PUBLIC_ROLES.includes(roleKode);
}
