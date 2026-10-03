/**
 * Stands in for Clerk.
 *
 * A real RSA keypair is generated per test run and served from a local JWKS
 * endpoint, so tokens go through the genuine `jose` verification path instead
 * of the verifier being stubbed out.
 */
import { createServer, type Server } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT, type JWK, type KeyLike } from 'jose';

export interface TestIdentity {
  /** Bearer token for this identity. */
  token: string;
  /** Clerk user id embedded as `sub`. */
  clerkId: string;
  email: string;
}

interface IdentityClaims {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
}

export class ClerkStub {
  private server: Server | null = null;
  private privateKey!: KeyLike;
  private keyId = 'test-key-1';

  /** Must run before the app is built: the JWKS URL is read at import time. */
  async start(): Promise<void> {
    const pair = await generateKeyPair('RS256');
    this.privateKey = pair.privateKey;

    const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: this.keyId, alg: 'RS256', use: 'sig' };

    this.server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ keys: [jwk] }));
    });

    await new Promise<void>((resolve) => {
      this.server!.listen(0, '127.0.0.1', resolve);
    });

    const address = this.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    process.env.CLERK_JWKS_URL = `http://127.0.0.1:${port}/.well-known/jwks.json`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.server?.close(() => resolve());
    });
    this.server = null;
  }

  /** Mints a signed session token for a given Clerk identity. */
  async issueToken(clerkId: string, claims: IdentityClaims = {}): Promise<string> {
    return new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: this.keyId })
      .setSubject(clerkId)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(this.privateKey);
  }
}