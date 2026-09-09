import { readFileSync } from 'node:fs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

/**
 * Penerbitan access token RS256 (ADR-005).
 *
 * Private key HANYA ada di service ini — API Gateway cuma memegang public key, jadi
 * Gateway bisa memverifikasi tapi tidak bisa MENERBITKAN token. Dengan HS256 kunci
 * yang sama dipakai untuk kedua hal, sehingga Gateway (dan siapa pun yang membobolnya)
 * ikut mampu memalsukan token admin.
 */
let privateKey: string | null = null;

function loadPrivateKey(): string {
  if (privateKey === null) {
    privateKey = readFileSync(env.JWT_PRIVATE_KEY_PATH, 'utf8');
  }
  return privateKey;
}

export interface AccessTokenClaims {
  sub: string;
  role: string;
}

export function signAccessToken(userId: bigint | number, roleKode: string): string {
  return jwt.sign({ role: roleKode }, loadPrivateKey(), {
    algorithm: 'RS256',
    subject: String(userId),
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}
