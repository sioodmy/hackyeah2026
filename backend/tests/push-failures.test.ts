/**
 * Failure modes of the two push providers: dead tokens, transient outages and
 * malformed responses. None of these may break the caller's request.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ClerkStub } from './helpers/auth.js';
import { installPushCredentials } from './helpers/push-credentials.js';
import { recordPushes, type PushRecorder } from './helpers/sent-pushes.js';
import { createTestDatabase, type TestDatabaseHandle } from './helpers/test-db.js';

let clerk: ClerkStub;
let testDb: TestDatabaseHandle;
let pushes: PushRecorder;

// Loaded dynamically: `env.ts` snapshots process.env on import, so anything
// touching configuration has to be imported after the keys are installed.
let registerDevice: typeof import('../src/services/device.service.js').registerDevice;
let listDevices: typeof import('../src/services/device.service.js').listDevices;
let pushToUser: typeof import('../src/services/notification.service.js').pushToUser;
let deactivateTokens: typeof import('../src/services/notification.service.js').deactivateTokens;

const alertPayload = {
  type: 'ALERT' as const,
  alert_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  level: 4,
  level_name: 'omega',
  sender_name: 'Jane',
  sender_phone: '+48111222333',
  location: { lat: 52.2297, lng: 21.0122, address: null },
  message: null,
  created_at: '2026-10-03T12:00:00.000Z',
  priority: 'critical' as const,
};

beforeAll(async () => {
  clerk = new ClerkStub();
  await clerk.start();
  await installPushCredentials();

  const { setDatabase } = await import('../src/db/client.js');
  ({ registerDevice } = await import('../src/services/device.service.js'));
  ({ listDevices } = await import('../src/services/device.service.js'));
  ({ pushToUser } = await import('../src/services/notification.service.js'));
  ({ deactivateTokens } = await import('../src/services/notification.service.js'));

  testDb = await createTestDatabase();
  setDatabase(testDb.db);
  pushes = recordPushes();
});

afterAll(async () => {
  pushes?.restore();
  await testDb?.close();
  await clerk.stop();
});

beforeEach(async () => {
  await testDb.truncate();
  pushes.sent.length = 0;
});

/** Creates a user row and gives them one device token. */
async function seedDevice(token: string, platform: 'ios' | 'android' = 'ios') {
  const userId = crypto.randomUUID();
  await testDb.client.exec(
    `INSERT INTO users (id, clerk_id, name) VALUES ('${userId}', 'user_${token}', 'Test')`,
  );
  await registerDevice(userId, { token, platform });
  return userId;
}

/** Replaces global fetch with one that fails the APNs call. */
function failApns(status: number, reason?: string) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: Parameters<typeof fetch>[0]) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url.includes('push.apple.com')) {
      return new Response(JSON.stringify(reason ? { reason } : {}), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    }
    return realFetch(input);
  }) as typeof fetch;
  return () => {
    globalThis.fetch = realFetch;
  };
}

describe('dead device tokens', () => {
  it('deactivates a token APNs reports as BadDeviceToken', async () => {
    const userId = await seedDevice('dead-ios-token');
    const restore = failApns(400, 'BadDeviceToken');

    await pushToUser(userId, alertPayload);
    restore();

    const devices = await listDevices(userId);
    expect(devices[0]?.isActive).toBe(false);
  });

  it('deactivates a token APNs reports as unregistered', async () => {
    const userId = await seedDevice('gone-ios-token');
    const restore = failApns(410, 'Unregistered');

    await pushToUser(userId, alertPayload);
    restore();

    expect((await listDevices(userId))[0]?.isActive).toBe(false);
  });

  it('keeps a token alive when APNs returns a server error', async () => {
    const userId = await seedDevice('flaky-ios-token');
    const restore = failApns(503);

    await pushToUser(userId, alertPayload);
    restore();

    // 5xx is our problem, not the device's: stay registered and retry later.
    expect((await listDevices(userId))[0]?.isActive).toBe(true);
  });

  it('never throws when the provider rejects outright', async () => {
    const userId = await seedDevice('exploding-token');
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;

    await expect(pushToUser(userId, alertPayload)).resolves.toBeUndefined();
    globalThis.fetch = realFetch;

    expect((await listDevices(userId))[0]?.isActive).toBe(true);
  });

  it('stops pushing to an inactive token', async () => {
    const userId = await seedDevice('paused-token');
    await deactivateTokens(['paused-token']);
    pushes.sent.length = 0;

    await pushToUser(userId, alertPayload);

    expect(pushes.sent).toHaveLength(0);
  });

  it('does nothing when the user has no devices', async () => {
    const userId = crypto.randomUUID();
    await testDb.client.exec(
      `INSERT INTO users (id, clerk_id, name) VALUES ('${userId}', 'user_bare', 'Bare')`,
    );

    await expect(pushToUser(userId, alertPayload)).resolves.toBeUndefined();
    expect(pushes.sent).toHaveLength(0);
  });
});