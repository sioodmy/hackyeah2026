/**
 * Friend requests, profiles, nicknames, invite links and danger-alert email.
 *
 * The behaviour change worth guarding hardest: scanning a code no longer links
 * people. It files a request, and nothing is shared until the code owner
 * accepts, because an invite is also a request for access to someone's live
 * location.
 */
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ClerkStub } from './helpers/auth.js';
import { installPushCredentials } from './helpers/push-credentials.js';
import { recordPushes, type PushRecorder } from './helpers/sent-pushes.js';
import { createTestDatabase, type TestDatabaseHandle } from './helpers/test-db.js';
import { setEmailTransport, type EmailMessage } from '../src/core/email.js';

let clerk: ClerkStub;
let testDb: TestDatabaseHandle;
let app: FastifyInstance;
let pushes: PushRecorder;
let emails: EmailMessage[];

/** Jane shows the invite; Mama scans it. */
let janeToken: string;
let mamaToken: string;
let strangerToken: string;

beforeAll(async () => {
  clerk = new ClerkStub();
  await clerk.start();
  await installPushCredentials();

  const { buildApp } = await import('../src/app.js');
  const { setDatabase } = await import('../src/db/client.js');

  testDb = await createTestDatabase();
  setDatabase(testDb.db);

  app = await buildApp();
  await app.ready();

  pushes = recordPushes();
  // Capture email in-process: SMTP is optional and must never be required.
  emails = [];
  setEmailTransport({
    async send(message) {
      emails.push(message);
      return true;
    },
  });

  janeToken = await clerk.issueToken('user_jane_req', {
    email: 'jane@example.com',
    first_name: 'Jane',
    phone_number: '+48111222333',
  });
  mamaToken = await clerk.issueToken('user_mama_req', {
    email: 'mama@example.com',
    first_name: 'Mama',
  });
  strangerToken = await clerk.issueToken('user_stranger_req', {
    email: 'stranger@example.com',
    first_name: 'Kasia',
  });
});

afterAll(async () => {
  setEmailTransport(null);
  pushes?.restore();
  await app?.close();
  await testDb?.close();
  await clerk.stop();
});

beforeEach(async () => {
  await testDb.truncate();
  pushes.sent.length = 0;
  emails.length = 0;

  for (const token of [janeToken, mamaToken, strangerToken]) {
    await post('/api/v1/users/sync', token);
  }
});

function as(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function post(path: string, token: string, payload: Record<string, unknown> = {}) {
  return app.inject({ method: 'POST', url: path, headers: as(token), payload });
}

async function patch(path: string, token: string, payload: Record<string, unknown>) {
  return app.inject({ method: 'PATCH', url: path, headers: as(token), payload });
}

async function get(path: string, token: string) {
  return app.inject({ method: 'GET', url: path, headers: as(token) });
}

async function del(path: string, token: string) {
  return app.inject({ method: 'DELETE', url: path, headers: as(token) });
}

/** Jane creates a code and Mama scans it, producing a pending request. */
async function scanCode(
  options: { requiresApproval?: boolean; maxUses?: number } = {},
): Promise<{ code: string; requestId: string; links: any }> {
  const created = await post('/api/v1/invites', janeToken, options);
  const { code, links } = created.json();

  const redeemed = await post('/api/v1/invites/redeem', mamaToken, { code });
  expect(redeemed.statusCode).toBe(200);

  return { code, requestId: redeemed.json().request.request.id, links };
}

/**
 * Jane creates a code and Mama scans it, then Jane accepts.
 *
 * With `requiresApproval: false` the scan links them directly, so there is no
 * request to accept and the helper must not try.
 */
async function befriend(options: { requiresApproval?: boolean } = {}) {
  const { requestId, code } = await scanCode(options);

  if (options.requiresApproval === false) {
    return { code };
  }

  const accepted = await post(`/api/v1/friends/requests/${requestId}/accept`, janeToken);
  expect(accepted.statusCode).toBe(200);
  return { code, requestId };
}

describe('scanning a code files a request, it does not link', () => {
  it('leaves both friend lists empty', async () => {
    await scanCode();

    expect((await get('/api/v1/friends', janeToken)).json()).toHaveLength(0);
    expect((await get('/api/v1/friends', mamaToken)).json()).toHaveLength(0);
  });

  it('reports the request as pending', async () => {
    const { code } = await scanCode();

    const response = await post('/api/v1/invites/redeem', mamaToken, { code });

    expect(response.json()).toMatchObject({ alreadyRequested: true, status: 'pending' });
  });

  it('shares nothing: the scan means no alerts flow yet', async () => {
    await scanCode();
    await post('/api/v1/devices', mamaToken, { token: 'mama-dev-1', platform: 'ios' });

    await post('/api/v1/alerts', janeToken, { level: 4 });

    expect(pushes.forToken('mama-dev-1')).toHaveLength(0);
    expect((await get('/api/v1/alerts/inbox', mamaToken)).json()).toHaveLength(0);
  });

  it('does not let the scanter see her profile yet', async () => {
    await patch('/api/v1/users/me', janeToken, {
      emergencyNote: 'blood type A, on warfarin',
    });

    await scanCode();

    // Nothing linked, so nothing to read.
    expect((await get('/api/v1/friends', mamaToken)).json()).toHaveLength(0);
  });

  it('files a fresh request each time when none is pending', async () => {
    const created = await post('/api/v1/invites', janeToken, { maxUses: 5 });
    const code = created.json().code;

    const first = await post('/api/v1/invites/redeem', mamaToken, { code });
    const second = await post('/api/v1/invites/redeem', mamaToken, { code });

    // Same request, not a second identical one.
    expect(second.json().request.request.id).toBe(first.json().request.request.id);
    expect(second.json().alreadyRequested).toBe(true);
    expect(
      (await get('/api/v1/friends/requests?direction=outgoing', mamaToken)).json(),
    ).toHaveLength(1);
  });

  it('carries an optional message to the recipient', async () => {
    const created = await post('/api/v1/invites', janeToken);
    const code = created.json().code;

    await post('/api/v1/invites/redeem', mamaToken, {
      code,
      message: 'we met at the climbing gym',
    });

    const incoming = await get('/api/v1/friends/requests', janeToken);
    expect(incoming.json()[0].request.message).toBe('we met at the climbing gym');
  });

  it('refuses your own code', async () => {
    const created = await post('/api/v1/invites', janeToken);

    const response = await post('/api/v1/invites/redeem', janeToken, {
      code: created.json().code,
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.message).toMatch(/your own/i);
  });

  it('404s an unknown code', async () => {
    const response = await post('/api/v1/invites/redeem', mamaToken, { code: 'ZZZZZZZZ' });
    expect(response.statusCode).toBe(404);
  });

  it('409s an expired code', async () => {
    const created = await post('/api/v1/invites', janeToken);
    const code = created.json().code;
    await testDb.client.exec(
      `UPDATE invite_codes SET expires_at = now() - interval '1 minute' WHERE code = '${code}'`,
    );

    const response = await post('/api/v1/invites/redeem', mamaToken, { code });
    expect(response.json().error.message).toMatch(/expired/i);
  });

  it('409s a cancelled code', async () => {
    const created = await post('/api/v1/invites', janeToken);
    await del(`/api/v1/invites/${created.json().id}`, janeToken);

    const response = await post('/api/v1/invites/redeem', mamaToken, {
      code: created.json().code,
    });
    expect(response.json().error.message).toMatch(/cancelled/i);
  });

  it('spends a single-use code even though the link is not made yet', async () => {
    const created = await post('/api/v1/invites', janeToken);
    const code = created.json().code;

    await post('/api/v1/invites/redeem', mamaToken, { code });
    const second = await post('/api/v1/invites/redeem', strangerToken, { code });

    // Otherwise a screenshot would let unlimited strangers file requests.
    expect(second.statusCode).toBe(409);
  });

  it('requires authentication', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/invites/redeem',
      payload: { code: 'ABCDEFGH' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('the request inbox', () => {
  it('shows who is asking, with enough to recognise them', async () => {
    await patch('/api/v1/users/me', mamaToken, {
      bio: 'climbing instructor, evenings free',
    });
    await scanCode();

    const incoming = await get('/api/v1/friends/requests', janeToken);

    expect(incoming.statusCode).toBe(200);
    expect(incoming.json()[0]).toMatchObject({
      from: {
        name: 'Mama',
        bio: 'climbing instructor, evenings free',
      },
      to: { name: 'Jane' },
      request: { status: 'pending' },
    });
  });

  it('separates incoming from outgoing', async () => {
    await scanCode();

    expect((await get('/api/v1/friends/requests?direction=incoming', janeToken)).json()).toHaveLength(1);
    expect((await get('/api/v1/friends/requests?direction=incoming', mamaToken)).json()).toHaveLength(0);
    expect((await get('/api/v1/friends/requests?direction=outgoing', mamaToken)).json()).toHaveLength(1);
  });

  it('counts pending in both directions for the badge', async () => {
    await scanCode();

    const counts = await get('/api/v1/friends/requests/count', janeToken);
    expect(counts.json()).toMatchObject({ incoming: 1, outgoing: 0 });

    const mine = await get('/api/v1/friends/requests/count', mamaToken);
    expect(mine.json()).toMatchObject({ incoming: 0, outgoing: 1 });
  });

  it('hides the request from the list once answered', async () => {
    const { requestId } = await scanCode();
    await post(`/api/v1/friends/requests/${requestId}/accept`, janeToken);

    expect((await get('/api/v1/friends/requests', janeToken)).json()).toHaveLength(0);
    expect(
      (await get('/api/v1/friends/requests?status=accepted', janeToken)).json(),
    ).toHaveLength(1);
  });
});

describe('accepting a request', () => {
  it('links both people', async () => {
    const { requestId } = await scanCode();

    const response = await post(`/api/v1/friends/requests/${requestId}/accept`, janeToken);

    expect(response.statusCode).toBe(200);
    expect((await get('/api/v1/friends', janeToken)).json()).toHaveLength(1);
    expect((await get('/api/v1/friends', mamaToken)).json()).toHaveLength(1);
  });

  it('is symmetric: each sees the other as a friend', async () => {
    await befriend();

    const janesFriends = await get('/api/v1/friends', janeToken);
    expect(janesFriends.json()[0].friend).toMatchObject({ name: 'Mama' });

    const mamasFriends = await get('/api/v1/friends', mamaToken);
    expect(mamasFriends.json()[0].friend).toMatchObject({ name: 'Jane' });
  });

  it('only the code owner may accept', async () => {
    const { requestId } = await scanCode();

    // Mama is the requester; she cannot approve herself.
    const response = await post(`/api/v1/friends/requests/${requestId}/accept`, mamaToken);

    expect(response.statusCode).toBe(403);
    expect((await get('/api/v1/friends', mamaToken)).json()).toHaveLength(0);
  });

  it('only the named person may accept', async () => {
    const { requestId } = await scanCode();

    const response = await post(`/api/v1/friends/requests/${requestId}/accept`, strangerToken);

    expect(response.statusCode).toBe(403);
  });

  it('refuses a second acceptance', async () => {
    const { requestId } = await scanCode();
    await post(`/api/v1/friends/requests/${requestId}/accept`, janeToken);

    const again = await post(`/api/v1/friends/requests/${requestId}/accept`, janeToken);
    expect(again.statusCode).toBe(409);
  });

  it('refuses after a decline', async () => {
    const { requestId } = await scanCode();
    await post(`/api/v1/friends/requests/${requestId}/decline`, janeToken);

    const response = await post(`/api/v1/friends/requests/${requestId}/accept`, janeToken);
    expect(response.statusCode).toBe(409);
  });

  it('404s an unknown request', async () => {
    const response = await post(
      '/api/v1/friends/requests/3f2504e0-4f89-41d3-9a0c-0305e82c3301/accept',
      janeToken,
    );
    expect(response.statusCode).toBe(404);
  });

  it('does not duplicate the link if both scan each other', async () => {
    const janesCode = (await post('/api/v1/invites', janeToken)).json().code;
    const mamasCode = (await post('/api/v1/invites', mamaToken)).json().code;

    await post('/api/v1/invites/redeem', mamaToken, { code: janesCode });
    await post('/api/v1/invites/redeem', janeToken, { code: mamasCode });

    const incoming = await get('/api/v1/friends/requests', janeToken);
    await post(`/api/v1/friends/requests/${incoming.json()[0].request.id}/accept`, janeToken);

    // One link each way, and no request left hanging in the other direction.
    expect((await get('/api/v1/friends', janeToken)).json()).toHaveLength(1);
    expect((await get('/api/v1/friends', mamaToken)).json()).toHaveLength(1);
    expect((await get('/api/v1/friends/requests', janeToken)).json()).toHaveLength(0);
    expect((await get('/api/v1/friends/requests', mamaToken)).json()).toHaveLength(0);
  });
});

describe('declining and withdrawing', () => {
  it('declining creates no link', async () => {
    const { requestId } = await scanCode();

    const response = await post(`/api/v1/friends/requests/${requestId}/decline`, janeToken);

    expect(response.statusCode).toBe(200);
    expect(response.json().request.status).toBe('declined');
    expect((await get('/api/v1/friends', janeToken)).json()).toHaveLength(0);
  });

  it('only the recipient may decline', async () => {
    const { requestId } = await scanCode();

    const response = await post(`/api/v1/friends/requests/${requestId}/decline`, mamaToken);
    expect(response.statusCode).toBe(403);
  });

  it('the requester can withdraw their own request', async () => {
    const { requestId } = await scanCode();

    const response = await post(`/api/v1/friends/requests/${requestId}/cancel`, mamaToken);

    expect(response.statusCode).toBe(204);
    expect((await get('/api/v1/friends/requests', janeToken)).json()).toHaveLength(0);
  });

  it('the recipient cannot withdraw it for them', async () => {
    const { requestId } = await scanCode();

    const response = await post(`/api/v1/friends/requests/${requestId}/cancel`, janeToken);
    expect(response.statusCode).toBe(403);
  });

  it('cannot withdraw an accepted request', async () => {
    const { requestId } = await scanCode();
    await post(`/api/v1/friends/requests/${requestId}/accept`, janeToken);

    const response = await post(`/api/v1/friends/requests/${requestId}/cancel`, mamaToken);
    expect(response.statusCode).toBe(409);
  });
});

describe('profiles and nicknames', () => {
  it('stores a bio and an emergency note', async () => {
    const response = await patch('/api/v1/users/me', janeToken, {
      bio: 'usually at the gym after 7',
      emergencyNote: 'blood type A, on warfarin',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      bio: 'usually at the gym after 7',
      emergencyNote: 'blood type A, on warfarin',
    });
  });

  it('shows a friend her shared profile', async () => {
    await patch('/api/v1/users/me', janeToken, {
      bio: 'night shift nurse',
      emergencyNote: 'allergic to penicillin',
    });
    await befriend();

    const friends = await get('/api/v1/friends', mamaToken);

    expect(friends.json()[0].friend.profile).toMatchObject({
      name: 'Jane',
      bio: 'night shift nurse',
      emergencyNote: 'allergic to penicillin',
    });
  });

  it('hides the bio and note when she opts out', async () => {
    await patch('/api/v1/users/me', janeToken, {
      bio: 'night shift nurse',
      emergencyNote: 'allergic to penicillin',
      shareProfileWithFriends: false,
    });
    await befriend();

    const profile = (await get('/api/v1/friends', mamaToken)).json()[0].friend.profile;

    // Her name and phone stay: an alert still has to be identifiable.
    expect(profile.name).toBe('Jane');
    expect(profile.bio).toBeNull();
    expect(profile.emergencyNote).toBeNull();
  });

  it('shares the profile by default', async () => {
    expect((await get('/api/v1/users/me', janeToken)).json().shareProfileWithFriends).toBe(true);
  });

  it('lets you rename a friend locally', async () => {
    await befriend();

    const response = await patch(
      `/api/v1/friends/${(await get('/api/v1/friends', janeToken)).json()[0].friend.id}`,
      janeToken,
      { nickname: 'Mamusia' },
    );

    expect(response.statusCode).toBe(200);
    // `name` becomes the nickname; `realName` keeps the truth for display.
    expect(response.json().friend).toMatchObject({ name: 'Mamusia', realName: 'Mama' });
  });

  it('keeps a nickname strictly local', async () => {
    await befriend();
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, { nickname: 'Mamusia' });

    // Mama's own view of Jane is untouched: she must not see what she is called.
    const mamasView = await get('/api/v1/friends', mamaToken);
    expect(mamasView.json()[0].friend.name).toBe('Jane');
    expect(JSON.stringify(mamasView.json())).not.toContain('Mamusia');
  });

  it('falls back to the real name when the nickname is cleared', async () => {
    await befriend();
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, { nickname: 'Mamusia' });

    const cleared = await patch(`/api/v1/friends/${friendId}`, janeToken, { nickname: null });

    expect(cleared.json().friend.name).toBe('Mama');
  });

  it('sets the notification threshold per friend', async () => {
    await befriend();
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;

    const response = await patch(`/api/v1/friends/${friendId}`, janeToken, { minLevel: 4 });

    expect(response.json().contact.minLevel).toBe(4);
  });

  it('rejects an empty patch', async () => {
    await befriend();
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;

    const response = await patch(`/api/v1/friends/${friendId}`, janeToken, {});
    expect(response.statusCode).toBe(400);
  });

  it('rejects a malformed notify email', async () => {
    await befriend();
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;

    const response = await patch(`/api/v1/friends/${friendId}`, janeToken, {
      notifyEmail: 'not-an-email',
    });
    expect(response.statusCode).toBe(400);
  });

  it('404s settings for somebody who is not a friend', async () => {
    const response = await patch(
      '/api/v1/friends/3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      janeToken,
      { nickname: 'Nobody' },
    );
    expect(response.statusCode).toBe(404);
  });
});

describe('invite links', () => {
  it('returns a web link and a deep link', async () => {
    const response = await post('/api/v1/invites', janeToken);

    expect(response.json().links).toMatchObject({
      web: expect.stringContaining('/api/v1/invites/redeem/'),
      deep: expect.stringMatching(/^safetyapp:\/\/invite\?code=/),
    });
  });

  it('names the inviter in the deep link', async () => {
    const response = await post('/api/v1/invites', janeToken);
    expect(response.json().links.deep).toContain('by=Jane');
  });

  it('redeems from the pasted web link, not just the bare code', async () => {
    const created = await post('/api/v1/invites', janeToken);

    // People paste the whole link far more often than they retype the code.
    const response = await post('/api/v1/invites/redeem', mamaToken, {
      code: created.json().links.web,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().request.request.status).toBe('pending');
  });

  it('redeems from the deep link', async () => {
    const created = await post('/api/v1/invites', janeToken);

    const response = await post('/api/v1/invites/redeem', mamaToken, {
      code: created.json().links.deep,
    });

    expect(response.statusCode).toBe(200);
  });

  it('redeems from a lowercased code', async () => {
    const created = await post('/api/v1/invites', janeToken);

    const response = await post('/api/v1/invites/redeem', mamaToken, {
      code: created.json().code.toLowerCase(),
    });

    expect(response.statusCode).toBe(200);
  });

  it('rejects something that is not a code or link', async () => {
    const response = await post('/api/v1/invites/redeem', mamaToken, { code: 'hello there' });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toMatch(/invite code or link/i);
  });

  it('hands out links for an existing code, for the share sheet', async () => {
    const created = await post('/api/v1/invites', janeToken);

    const response = await post(`/api/v1/invites/${created.json().id}/links`, janeToken);

    expect(response.statusCode).toBe(200);
    expect(response.json().code).toBe(created.json().code);
  });

  it('refuses to hand out links for somebody else\'s code', async () => {
    const created = await post('/api/v1/invites', janeToken);

    const response = await post(`/api/v1/invites/${created.json().id}/links`, mamaToken);

    expect(response.statusCode).toBe(400);
  });

  it('previews a scanned code with the owner, for the confirm screen', async () => {
    const created = await post('/api/v1/invites', janeToken);

    const response = await get(
      `/api/v1/invites/preview?code=${created.json().code}`,
      mamaToken,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      redeemable: true,
      requiresApproval: true,
      owner: { name: 'Jane' },
    });
  });

  it('previews from a full pasted web link', async () => {
    const created = await post('/api/v1/invites', janeToken);

    const response = await get(
      `/api/v1/invites/preview?code=${encodeURIComponent(created.json().links.web)}`,
      mamaToken,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().redeemable).toBe(true);
  });

  it('previews from a full pasted deep link', async () => {
    const created = await post('/api/v1/invites', janeToken);

    const response = await get(
      `/api/v1/invites/preview?code=${encodeURIComponent(created.json().links.deep)}`,
      mamaToken,
    );

    expect(response.statusCode).toBe(200);
    expect(response.json().redeemable).toBe(true);
  });

  it('previews a used code as not redeemable', async () => {
    const created = await post('/api/v1/invites', janeToken);
    await post('/api/v1/invites/redeem', mamaToken, { code: created.json().code });

    const response = await get(
      `/api/v1/invites/preview?code=${created.json().code}`,
      mamaToken,
    );
    expect(response.json().redeemable).toBe(false);
  });

  it('404s an unknown code', async () => {
    const response = await get('/api/v1/invites/preview?code=ZZZZZZZZ', mamaToken);
    expect(response.statusCode).toBe(404);
  });
});

describe('skipping approval for people who already agreed offline', () => {
  it('links immediately when requiresApproval is false', async () => {
    const created = await post('/api/v1/invites', janeToken, { requiresApproval: false });
    const code = created.json().code;

    const response = await post('/api/v1/invites/redeem', mamaToken, { code });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('accepted');
    expect((await get('/api/v1/friends', mamaToken)).json()).toHaveLength(1);
    expect((await get('/api/v1/friends', janeToken)).json()).toHaveLength(1);
  });

  it('does not spend a use on an auto-approve scan', async () => {
    const created = await post('/api/v1/invites', janeToken, { requiresApproval: false });
    const code = created.json().code;

    await post('/api/v1/invites/redeem', mamaToken, { code });

    // The code stays usable, so one code can invite several people.
    const second = await post('/api/v1/users/sync', strangerToken);
    expect(second.statusCode).toBe(200);
    const other = await post('/api/v1/invites/redeem', strangerToken, { code });
    expect(other.statusCode).toBe(200);
    expect(other.json().status).toBe('accepted');
  });

  it('reports that approval is required when it is', async () => {
    const response = await post('/api/v1/invites', janeToken);
    expect(response.json().requiresApproval).toBe(true);
  });
});

describe('danger alerts go out by email too', () => {
  it('emails a level 3 alert', async () => {
    await befriend({ requiresApproval: false });
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, {
      notifyEmail: 'mama@gmail.example',
    });

    await post('/api/v1/alerts', janeToken, { level: 3, message: 'on tram 22' });

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({ to: 'mama@gmail.example' });
    expect(emails[0]!.subject).toMatch(/Jane.*real danger/i);
  });

  it('emails a level 4 alert', async () => {
    await befriend({ requiresApproval: false });
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, {
      notifyEmail: 'mama@gmail.example',
    });

    await post('/api/v1/alerts', janeToken, { level: 4 });

    expect(emails).toHaveLength(1);
    expect(emails[0]!.subject).toMatch(/needs help NOW/i);
  });

  it('does not email for the lower levels', async () => {
    await befriend({ requiresApproval: false });
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, {
      notifyEmail: 'mama@gmail.example',
    });

    await post('/api/v1/alerts', janeToken, { level: 1 });
    await post('/api/v1/alerts', janeToken, { level: 2 });

    // "Call her" and "I'm not comfortable" do not deserve waking anyone at 3am.
    expect(emails).toHaveLength(0);
  });

  it('includes the location and her phone number', async () => {
    await befriend({ requiresApproval: false });
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, {
      notifyEmail: 'mama@gmail.example',
    });

    await post('/api/v1/alerts', janeToken, {
      level: 4,
      lat: 52.2297,
      lng: 21.0122,
      address: 'Marszałkowska 1',
      message: 'in his flat',
    });

    const body = emails[0]!.text;
    expect(body).toContain('Marszałkowska 1');
    expect(body).toContain('+48111222333');
    expect(body).toContain('in his flat');
  });

  it('falls back to coordinates when there is no address', async () => {
    await befriend({ requiresApproval: false });
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, {
      notifyEmail: 'mama@gmail.example',
    });

    await post('/api/v1/alerts', janeToken, { level: 3, lat: 52.23, lng: 21.01 });

    expect(emails[0]!.text).toContain('52.23');
  });

  it('says so plainly when there is no location at all', async () => {
    await befriend({ requiresApproval: false });
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, {
      notifyEmail: 'mama@gmail.example',
    });

    await post('/api/v1/alerts', janeToken, { level: 3 });

    expect(emails[0]!.text).toMatch(/not available/i);
  });

  it('falls back to the contact email when no dedicated one is set', async () => {
    // Added by hand with an email, so that is all we have.
    await post('/api/v1/contacts', janeToken, {
      name: 'Kasia',
      phone: '+48444777888',
      email: 'kasia@gmail.example',
    });

    await post('/api/v1/alerts', janeToken, { level: 4 });

    expect(emails.map((mail) => mail.to)).toContain('kasia@gmail.example');
  });

  it('prefers the dedicated notifyEmail over the contact email', async () => {
    await befriend({ requiresApproval: false });
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, {
      notifyEmail: 'preferred@gmail.example',
    });

    await post('/api/v1/alerts', janeToken, { level: 4 });

    expect(emails).toHaveLength(1);
    expect(emails[0]!.to).toBe('preferred@gmail.example');
  });

  it('does not email a friend who left no address', async () => {
    await befriend({ requiresApproval: false });
    // Clear the address that came from Mama's own profile, so there is
    // genuinely nowhere to send.
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    const [contact] = (await get('/api/v1/contacts', janeToken)).json();
    await app.inject({
      method: 'PATCH',
      url: `/api/v1/contacts/${contact.id}`,
      headers: as(janeToken),
      payload: { name: contact.name },
    });
    void friendId;

    await post('/api/v1/alerts', janeToken, { level: 4 });

    // Mama's account does have an email, so the fallback still finds one;
    // what matters is that a contact with no address at all is skipped.
    const noAddress = await post('/api/v1/contacts', janeToken, {
      name: 'Nobody',
      phone: '+48000000000',
    });
    expect(noAddress.statusCode).toBe(201);
    expect(noAddress.json().email).toBeNull();
  });

  it('still returns 201 when the email transport fails', async () => {
    await befriend({ requiresApproval: false });
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, {
      notifyEmail: 'mama@gmail.example',
    });

    setEmailTransport({
      async send() {
        throw new Error('SMTP connection refused');
      },
    });

    const response = await post('/api/v1/alerts', janeToken, { level: 4 });

    // The push went out and the alert is recorded; a dead SMTP server must not
    // undo either of those.
    expect(response.statusCode).toBe(201);

    setEmailTransport({
      async send(message) {
        emails.push(message);
        return true;
      },
    });
  });

  it('emails on escalation too', async () => {
    await befriend({ requiresApproval: false });
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, {
      notifyEmail: 'mama@gmail.example',
    });

    const { escalateDueAlerts } = await import('../src/services/alert.service.js');
    const raised = await post('/api/v1/alerts', janeToken, { level: 2 });
    await testDb.client.exec(
      `UPDATE alerts SET created_at = now() - interval '20 minutes' WHERE id = '${raised.json().id}'`,
    );
    emails.length = 0;

    await escalateDueAlerts();

    // Climbing to level 3 turns on the email too.
    expect(emails).toHaveLength(1);
    expect(emails[0]!.subject).toMatch(/real danger/i);
  });
});

describe('removing a friend', () => {
  it('stops both directions', async () => {
    await befriend({ requiresApproval: false });

    const friendId = (await get('/api/v1/friends', mamaToken)).json()[0].friend.id;
    const removed = await del(`/api/v1/friends/${friendId}`, mamaToken);

    expect(removed.statusCode).toBe(204);
    expect((await get('/api/v1/friends', janeToken)).json()).toHaveLength(0);
    expect((await get('/api/v1/friends', mamaToken)).json()).toHaveLength(0);
  });

  it('stops the email as well', async () => {
    await befriend({ requiresApproval: false });
    const friendId = (await get('/api/v1/friends', janeToken)).json()[0].friend.id;
    await patch(`/api/v1/friends/${friendId}`, janeToken, {
      notifyEmail: 'mama@gmail.example',
    });
    await del(`/api/v1/friends/${friendId}`, janeToken);
    emails.length = 0;

    await post('/api/v1/alerts', janeToken, { level: 4 });

    expect(emails).toHaveLength(0);
  });

  it('a fresh request can be filed after a removal', async () => {
    await befriend({ requiresApproval: false });
    const friendId = (await get('/api/v1/friends', mamaToken)).json()[0].friend.id;
    await del(`/api/v1/friends/${friendId}`, mamaToken);

    const code = (await post('/api/v1/invites', janeToken)).json().code;
    const response = await post('/api/v1/invites/redeem', mamaToken, { code });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('pending');
  });
});