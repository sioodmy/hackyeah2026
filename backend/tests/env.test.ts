/**
 * `env.ts` snapshots process.env on import and throws on bad configuration, so
 * each case runs in a child process with a controlled environment.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);

const VALID = {
  DATABASE_URL: 'postgresql://a:b@localhost:5432/c',
  CLERK_JWKS_URL: 'https://test.clerk.accounts.dev/.well-known/jwks.json',
};

/** Boots the app with the given environment and reports how it went. */
async function bootWith(env: Record<string, string>) {
  const cleared = [
    'DATABASE_URL',
    'CLERK_JWKS_URL',
    'CLERK_ISSUER',
    'FCM_PROJECT_ID',
    'FCM_CLIENT_EMAIL',
    'FCM_PRIVATE_KEY',
    'APNS_KEY_ID',
    'APNS_TEAM_ID',
    'APNS_PRIVATE_KEY',
    'EMERGENCY_WEBHOOK_URL',
    'NODE_ENV',
    'LOG_LEVEL',
    'APNS_USE_SANDBOX',
  ];

  try {
    await run('npx', ['tsx', 'src/config/boot-check.ts'], {
      env: {
        PATH: process.env.PATH ?? '',
        DOTENV_CONFIG_PATH: '/dev/null',
        ...Object.fromEntries(cleared.map((key) => [key, ''])),
        ...env,
      },
      timeout: 30_000,
    });
    return { ok: true, stderr: '' };
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    return { ok: false, stderr: err.stderr ?? err.message };
  }
}

describe('environment validation', () => {
  it('accepts a minimal configuration', async () => {
    const result = await bootWith(VALID);
    expect(result.stderr).toBe('');
    expect(result.ok).toBe(true);
  });

  it('accepts the blank push credentials .env.example ships', async () => {
    // This is the state a fresh `cp .env.example .env` leaves behind, and it
    // must boot: alerts are recorded even with no push provider available.
    const result = await bootWith({ ...VALID, APNS_KEY_ID: '', APNS_PRIVATE_KEY: '' });
    expect(result.ok).toBe(true);
  });

  it('rejects a missing DATABASE_URL', async () => {
    const result = await bootWith({ CLERK_JWKS_URL: VALID.CLERK_JWKS_URL });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/DATABASE_URL/);
  });

  it('rejects a missing CLERK_JWKS_URL', async () => {
    const result = await bootWith({ DATABASE_URL: VALID.DATABASE_URL });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/CLERK_JWKS_URL/);
  });

  it('rejects a CLERK_JWKS_URL that is not a URL', async () => {
    const result = await bootWith({ ...VALID, CLERK_JWKS_URL: 'not-a-url' });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/CLERK_JWKS_URL/);
  });

  it('rejects half-configured APNs credentials', async () => {
    // Better to fail at boot than at the first omega push.
    const result = await bootWith({ ...VALID, APNS_KEY_ID: 'ABC123' });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/APNS_KEY_ID, APNS_TEAM_ID and APNS_PRIVATE_KEY/);
  });

  it('rejects half-configured FCM credentials', async () => {
    const result = await bootWith({ ...VALID, FCM_PROJECT_ID: 'my-project' });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/FCM_PROJECT_ID, FCM_CLIENT_EMAIL and FCM_PRIVATE_KEY/);
  });

  it('rejects a malformed FCM client email rather than ignoring it', async () => {
    const result = await bootWith({
      ...VALID,
      FCM_PROJECT_ID: 'p',
      FCM_CLIENT_EMAIL: 'not-an-email',
      FCM_PRIVATE_KEY: 'pem',
    });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/FCM_CLIENT_EMAIL/);
  });

  it('rejects a malformed emergency webhook URL', async () => {
    const result = await bootWith({ ...VALID, EMERGENCY_WEBHOOK_URL: 'nope' });
    expect(result.ok).toBe(false);
    expect(result.stderr).toMatch(/EMERGENCY_WEBHOOK_URL/);
  });

  it('reports every problem at once, not just the first', async () => {
    const result = await bootWith({ APNS_KEY_ID: 'x' });
    expect(result.stderr).toMatch(/DATABASE_URL/);
    expect(result.stderr).toMatch(/CLERK_JWKS_URL/);
    expect(result.stderr).toMatch(/APNS_/);
  });
});