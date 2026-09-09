import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * Prisma dipakai untuk SEMUA akses database (ADR-007 / CLAUDE.md §6 aturan #5).
 * Prisma menghasilkan prepared statement otomatis; dilarang keras memakai
 * string concatenation atau $queryRawUnsafe di seluruh codebase.
 */
export const prisma = new PrismaClient({
  log:
    env.NODE_ENV === 'development'
      ? [{ emit: 'stdout', level: 'warn' }, { emit: 'stdout', level: 'error' }]
      : [{ emit: 'stdout', level: 'error' }],
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
