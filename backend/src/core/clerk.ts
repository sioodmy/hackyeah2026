import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { env } from '../config/env.js';
import { UnauthorizedError } from './errors.js';

/**
 * Clerk signs session JWTs with RS256. We verify them locally against the
 * JWKS endpoint, so the API never needs to call Clerk on a request.
 */
const jwks = createRemoteJWKSet(new URL(env.CLERK_JWKS_URL), {
  cooldownDuration: 30_000,
  cacheMaxAge: 600_000,
});

export interface ClerkClaims extends JWTPayload {
  /** Clerk user id. */
  sub: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  picture?: string;
  phone_number?: string;
}

export async function verifyClerkToken(token: string): Promise<ClerkClaims> {
  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      ...(env.CLERK_ISSUER ? { issuer: env.CLERK_ISSUER } : {}),
    });

    if (!payload.sub) {
      throw new UnauthorizedError('Token has no subject');
    }
    return payload as ClerkClaims;
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function extractBearerToken(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing bearer token');
  }
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw new UnauthorizedError('Missing bearer token');
  return token;
}

export function displayNameFromClaims(claims: ClerkClaims): string {
  const full = [claims.first_name, claims.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (claims.name?.trim()) return claims.name.trim();
  if (claims.email) return claims.email.split('@')[0] ?? '';
  return '';
}