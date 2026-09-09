import { vi } from 'vitest';

/**
 * Penyimpanan in-memory yang meniru perilaku repository auth, supaya logika
 * rotasi refresh token dan penolakan login lintas channel bisa diuji tanpa MySQL.
 * Yang diuji adalah keputusan keamanannya, bukan Prisma-nya.
 */
export interface FakeRefreshToken {
  id: bigint;
  userId: bigint;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface FakeUser {
  id: bigint;
  nama: string;
  username: string;
  email: string;
  passwordHash: string;
  roleId: bigint;
  isEmailVerified: boolean;
  isActive: boolean;
  nik: string | null;
  role: { id: bigint; kode: string; nama: string };
}

export class FakeStore {
  users: FakeUser[] = [];
  refreshTokens: FakeRefreshToken[] = [];
  private nextTokenId = 1n;

  reset(): void {
    this.users = [];
    this.refreshTokens = [];
    this.nextTokenId = 1n;
  }

  addUser(user: FakeUser): FakeUser {
    this.users.push(user);
    return user;
  }

  addRefreshToken(data: { userId: bigint; tokenHash: string; expiresAt: Date }): FakeRefreshToken {
    const row: FakeRefreshToken = {
      id: this.nextTokenId,
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
    };
    this.nextTokenId += 1n;
    this.refreshTokens.push(row);
    return row;
  }

  activeTokensOf(userId: bigint): FakeRefreshToken[] {
    return this.refreshTokens.filter((t) => t.userId === userId && t.revokedAt === null);
  }
}

export const store = new FakeStore();

/** Logger tiruan: menampung entri agar bisa diperiksa, tanpa menulis ke stdout. */
export function createFakeLogger() {
  const entries: { level: string; message: string }[] = [];
  const logger = {
    debug: vi.fn((m: string) => entries.push({ level: 'debug', message: m })),
    info: vi.fn((m: string) => entries.push({ level: 'info', message: m })),
    warn: vi.fn((m: string) => entries.push({ level: 'warn', message: m })),
    error: vi.fn((m: string) => entries.push({ level: 'error', message: m })),
    child: vi.fn(() => logger),
  };
  return { logger, entries };
}
