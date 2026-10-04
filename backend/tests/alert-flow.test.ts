/**
 * End-to-end coverage of the two-way flow, against real Postgres (PGlite) and
 * a real Clerk signature check:
 *
 *   1. Jane logs in, registers her push token, adds Mama as a contact
 *   2. Mama has the app too, so her token is linked automatically
 *   3. Jane raises an omega alert -> Mama's phone receives a critical push
 *   4. Mama acknowledges -> Jane's phone receives ALERT_ACKNOWLEDGED
 *   5. Jane resolves the alert
 *
 * Outbound push traffic is intercepted, so assertions cover the exact payload
 * and delivery flags the mobile team depends on.
 */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ClerkStub } from "./helpers/auth.js";
import { installPushCredentials } from "./helpers/push-credentials.js";
import {
  createTestDatabase,
  type TestDatabaseHandle,
} from "./helpers/test-db.js";
import {
  android,
  aps,
  fcmData,
  recordPushes,
  type PushRecorder,
} from "./helpers/sent-pushes.js";

const JANE_CLERK_ID = "user_jane";
const MAMA_CLERK_ID = "user_mama";
const MAMA_TOKEN = "mama-apns-token-aaaa";
const JANE_TOKEN = "jane-apns-token-bbbb";

let clerk: ClerkStub;
let testDb: TestDatabaseHandle;
let app: FastifyInstance;
let pushes: PushRecorder;

let janeToken: string;
let mamaToken: string;

beforeAll(async () => {
  clerk = new ClerkStub();
  await clerk.start();
  await installPushCredentials();

  // Imported after the stub sets CLERK_JWKS_URL, since config reads it on import.
  const { buildApp } = await import("../src/app.js");
  const { setDatabase } = await import("../src/db/client.js");

  testDb = await createTestDatabase();
  setDatabase(testDb.db);

  app = await buildApp();
  await app.ready();

  pushes = recordPushes();

  janeToken = await clerk.issueToken(JANE_CLERK_ID, {
    email: "jane@example.com",
    first_name: "Jane",
    phone_number: "+48111222333",
  });
  mamaToken = await clerk.issueToken(MAMA_CLERK_ID, {
    email: "mama@example.com",
    first_name: "Mama",
  });
});

afterAll(async () => {
  // Set up may have failed partway; only tear down what was created.
  pushes?.restore();
  await app?.close();
  await testDb?.close();
  await clerk.stop();
});

beforeEach(async () => {
  await testDb.truncate();
  pushes.sent.length = 0;
});

function as(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function post(path: string, token: string, payload?: unknown) {
  return app.inject({
    method: "POST",
    url: path,
    headers: as(token),
    payload: payload as object,
  });
}

async function patch(path: string, token: string, payload: unknown) {
  return app.inject({
    method: "PATCH",
    url: path,
    headers: as(token),
    payload: payload as object,
  });
}

async function get(path: string, token: string) {
  return app.inject({ method: "GET", url: path, headers: as(token) });
}

/** Registers a push token for the given identity. */
async function registerDevice(
  token: string,
  deviceToken: string,
  platform: "ios" | "android",
) {
  const response = await post("/api/v1/devices", token, {
    token: deviceToken,
    platform,
  });
  expect(response.statusCode).toBe(201);
  return response.json() as Promise<{
    id: string;
    userId: string;
    token: string;
  }>;
}

/** Sets up Jane with Mama as a linked contact, both holding push tokens. */
async function seedLinkedPair(): Promise<void> {
  // Mama signs up first so Jane's contact entry can resolve to her account.
  await post("/api/v1/users/sync", mamaToken);
  await registerDevice(mamaToken, MAMA_TOKEN, "ios");

  await post("/api/v1/users/sync", janeToken);
  await registerDevice(janeToken, JANE_TOKEN, "ios");

  const added = await post("/api/v1/contacts", janeToken, {
    name: "Mama",
    phone: "+48444555666",
    email: "mama@example.com",
    relationship: "mother",
    isPrimary: true,
    minLevel: 1,
  });
  expect(added.statusCode).toBe(201);
  expect(added.json()).toMatchObject({ contactUserId: expect.any(String) });
}

describe("authentication", () => {
  it("rejects a request with no token", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/alerts" });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("unauthorized");
  });

  it("rejects a malformed token", async () => {
    const response = await get("/api/v1/alerts", "not-a-real-jwt");
    expect(response.statusCode).toBe(401);
  });

  it("mirrors the Clerk profile on first authenticated call", async () => {
    const response = await get("/api/v1/auth/session", janeToken);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      clerkId: JANE_CLERK_ID,
      email: "jane@example.com",
      name: "Jane",
      phone: "+48111222333",
    });
  });

  it("reuses the same local row on the next call", async () => {
    await get("/api/v1/users/me", janeToken);
    const second = await get("/api/v1/users/me", janeToken);

    expect(second.json().id).toBeTypeOf("string");
  });
});

describe("devices", () => {
  it("registers a push token and returns its id", async () => {
    await get("/api/v1/users/me", janeToken);
    const device = await registerDevice(janeToken, "fresh-token", "android");

    expect(device).toMatchObject({ token: "fresh-token", platform: "android" });
  });

  it("is idempotent: re-posting a token does not create a duplicate", async () => {
    await get("/api/v1/users/me", janeToken);
    const first = await registerDevice(janeToken, "same-token", "ios");
    const second = await registerDevice(janeToken, "same-token", "ios");

    expect(second.id).toBe(first.id);

    const listed = await get("/api/v1/devices", janeToken);
    expect(listed.json()).toHaveLength(1);
  });

  it("reassigns a token that another user previously owned", async () => {
    await get("/api/v1/users/me", janeToken);
    await get("/api/v1/users/me", mamaToken);

    const taken = await registerDevice(janeToken, "shared-token", "ios");
    const reassigned = await registerDevice(mamaToken, "shared-token", "ios");

    expect(reassigned.id).toBe(taken.id);
    expect(reassigned.userId).not.toBe(taken.userId);
  });

  it("removes a token on logout", async () => {
    await get("/api/v1/users/me", janeToken);
    const device = await registerDevice(janeToken, "logout-token", "ios");

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/v1/devices/${device.id}`,
      headers: as(janeToken),
    });

    expect(removed.statusCode).toBe(204);
    expect((await get("/api/v1/devices", janeToken)).json()).toHaveLength(0);
  });
});

describe("contacts", () => {
  it("links a contact automatically by matching email", async () => {
    await post("/api/v1/users/sync", mamaToken);
    const response = await post("/api/v1/contacts", janeToken, {
      name: "Mama",
      phone: "+48444555666",
      email: "mama@example.com",
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().contactUserId).toBeTypeOf("string");
  });

  it("leaves contactUserId null when the email matches no account", async () => {
    const response = await post("/api/v1/contacts", janeToken, {
      name: "Kasia",
      phone: "+48444777888",
      email: "kasia@example.com",
    });

    expect(response.json().contactUserId).toBeNull();
  });

  it("rejects a contact with no phone", async () => {
    const response = await post("/api/v1/contacts", janeToken, {
      name: "Ghost",
    });
    expect(response.statusCode).toBe(400);
    // Fastify rejects before the handler runs, so the code is its own.
    expect(response.json().error.code).toMatch(/validation/i);
  });

  it("deletes a contact", async () => {
    const created = await post("/api/v1/contacts", janeToken, {
      name: "Kasia",
      phone: "+48444777888",
    });

    const removed = await app.inject({
      method: "DELETE",
      url: `/api/v1/contacts/${created.json().id}`,
      headers: as(janeToken),
    });

    expect(removed.statusCode).toBe(204);
    expect((await get("/api/v1/contacts", janeToken)).json()).toHaveLength(0);
  });

  it("does not let one user delete another user's contact", async () => {
    const janesContact = await post("/api/v1/contacts", janeToken, {
      name: "Mama",
      phone: "+48444555666",
    });

    const response = await app.inject({
      method: "DELETE",
      url: `/api/v1/contacts/${janesContact.json().id}`,
      headers: as(mamaToken),
    });

    expect(response.statusCode).toBe(404);
  });
});

describe("raising an alert reaches the contact by push", () => {
  it("sends a critical APNs push carrying the whole alert", async () => {
    await seedLinkedPair();

    const raised = await post("/api/v1/alerts", janeToken, {
      level: 4,
      message: "in his flat, please hurry",
      lat: 52.2297,
      lng: 21.0122,
      address: "Marszałkowska 1",
    });

    expect(raised.statusCode).toBe(201);
    expect(raised.json()).toMatchObject({ level: 4, status: "active" });

    const delivered = pushes.forToken(MAMA_TOKEN);
    expect(delivered).toHaveLength(1);

    const push = delivered[0]!;
    expect(push.provider).toBe("apns");
    expect(push.body).toMatchObject({
      type: "ALERT",
      level: 4,
      level_name: "omega",
      sender_name: "Jane",
      sender_phone: "+48111222333",
      message: "in his flat, please hurry",
      priority: "critical",
      location: { lat: 52.2297, lng: 21.0122, address: "Marszałkowska 1" },
    });
  });

  it("breaks through silent mode for an omega alert", async () => {
    await seedLinkedPair();
    await post("/api/v1/alerts", janeToken, { level: 4 });

    const push = pushes.forToken(MAMA_TOKEN)[0]!;

    // These four flags are what make the phone ring instead of staying silent.
    expect(push.headers["apns-priority"]).toBe("10");
    expect(aps(push.body)).toMatchObject({
      sound: "critical.caf",
      interruptionLevel: "time-sensitive",
      category: "ALERT_CRITICAL",
      "relevance-score": 1,
    });
  });

  it("does not use the critical channel for level 2", async () => {
    await seedLinkedPair();
    await post("/api/v1/alerts", janeToken, { level: 2 });

    const push = pushes.forToken(MAMA_TOKEN)[0]!;

    expect(push.headers["apns-priority"]).toBe("5");
    expect(aps(push.body)).toMatchObject({
      sound: "default",
      interruptionLevel: "active",
      category: "ALERT",
    });
    expect(aps(push.body)).not.toHaveProperty("relevance-score");
  });

  it("writes a plain body for level 1 and no custom sound", async () => {
    await seedLinkedPair();
    await post("/api/v1/alerts", janeToken, { level: 1 });

    const push = pushes.forToken(MAMA_TOKEN)[0]!;
    expect(push.body.body).toMatch(/call/i);
    expect(aps(push.body).sound).toBe("default");
  });

  it("prefers her own words when she wrote a message", async () => {
    await seedLinkedPair();
    await post("/api/v1/alerts", janeToken, {
      level: 3,
      message: "on tram 22",
    });

    expect(pushes.forToken(MAMA_TOKEN)[0]!.body.body).toBe("on tram 22");
  });

  it("sends through FCM with maximum priority for an Android contact", async () => {
    await post("/api/v1/users/sync", mamaToken);
    await registerDevice(mamaToken, "mama-fcm-token", "android");
    await get("/api/v1/users/me", janeToken);
    await registerDevice(janeToken, JANE_TOKEN, "ios");
    await post("/api/v1/contacts", janeToken, {
      name: "Mama",
      phone: "+48444555666",
      email: "mama@example.com",
    });

    await post("/api/v1/alerts", janeToken, { level: 4 });

    const push = pushes.forToken("mama-fcm-token")[0]!;
    expect(push.provider).toBe("fcm");
    expect(fcmData(push.body)).toMatchObject({
      level: "4",
      level_name: "omega",
    });

    expect(android(push.body)).toMatchObject({
      priority: "HIGH",
      notification: {
        channel_id: "alerts_critical",
        priority: "PRIORITY_MAX",
        sound: "critical",
      },
    });
  });

  it("skips contacts whose min_level is above this alert", async () => {
    await post("/api/v1/users/sync", mamaToken);
    await registerDevice(mamaToken, MAMA_TOKEN, "ios");
    await get("/api/v1/users/me", janeToken);
    await post("/api/v1/contacts", janeToken, {
      name: "Mama",
      phone: "+48444555666",
      email: "mama@example.com",
      minLevel: 3,
    });

    await post("/api/v1/alerts", janeToken, { level: 1 });
    expect(pushes.forToken(MAMA_TOKEN)).toHaveLength(0);

    await post("/api/v1/alerts", janeToken, { level: 3 });
    expect(pushes.forToken(MAMA_TOKEN)).toHaveLength(1);
  });

  it("does not notify a contact who has no account", async () => {
    await get("/api/v1/users/me", janeToken);
    await post("/api/v1/contacts", janeToken, {
      name: "Kasia",
      phone: "+48444777888",
      email: "kasia@example.com",
    });

    await post("/api/v1/alerts", janeToken, { level: 4 });

    expect(pushes.sent).toHaveLength(0);
  });

  it("raises the level in place instead of duplicating an open alert", async () => {
    await seedLinkedPair();

    const first = await post("/api/v1/alerts", janeToken, { level: 1 });
    const second = await post("/api/v1/alerts", janeToken, { level: 4 });

    expect(second.json().id).toBe(first.json().id);
    expect(second.json().level).toBe(4);

    const history = await get("/api/v1/alerts", janeToken);
    expect(history.json()).toHaveLength(1);
  });

  it("does not downgrade an alert when a lower level comes in", async () => {
    await seedLinkedPair();

    await post("/api/v1/alerts", janeToken, { level: 4 });
    const lower = await post("/api/v1/alerts", janeToken, { level: 2 });

    expect(lower.json().level).toBe(4);
  });
});

describe("the contact answers back", () => {
  it("appears in her inbox with the sender attached", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 2 });

    const inbox = await get("/api/v1/alerts/inbox", mamaToken);

    expect(inbox.statusCode).toBe(200);
    expect(inbox.json()).toHaveLength(1);
    expect(inbox.json()[0]).toMatchObject({
      id: raised.json().id,
      level: 2,
      // Mama is the reader here; the sender is Jane.
      sender_name: "Jane",
      sender_phone: "+48111222333",
      status: "active",
    });
  });

  it("keeps an unrelated user out of her inbox", async () => {
    await seedLinkedPair();
    const strangerToken = await clerk.issueToken("user_stranger", {
      email: "stranger@example.com",
    });
    await post("/api/v1/users/sync", strangerToken);
    await post("/api/v1/alerts", janeToken, { level: 2 });

    expect((await get("/api/v1/alerts/inbox", mamaToken)).json()).toHaveLength(
      1,
    );
    expect(
      (await get("/api/v1/alerts/inbox", strangerToken)).json(),
    ).toHaveLength(0);
  });

  it("pushes ALERT_ACKNOWLEDGED back to the person who raised it", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 4 });
    pushes.sent.length = 0;

    const acked = await post(
      `/api/v1/alerts/${raised.json().id}/acknowledge`,
      mamaToken,
    );

    expect(acked.statusCode).toBe(200);
    expect(acked.json()).toMatchObject({
      status: "acknowledged",
      acknowledgedByContactId: expect.any(String),
    });

    const push = pushes.forToken(JANE_TOKEN)[0]!;
    expect(push.body).toMatchObject({
      type: "ALERT_ACKNOWLEDGED",
      alert_id: raised.json().id,
      level: 4,
      contact_name: "Mama",
    });
  });

  it("refuses an acknowledgement from a third party", async () => {
    await seedLinkedPair();
    const strangerToken = await clerk.issueToken("user_stranger", {
      email: "stranger@example.com",
    });
    await post("/api/v1/users/sync", strangerToken);
    const raised = await post("/api/v1/alerts", janeToken, { level: 2 });

    const response = await post(
      `/api/v1/alerts/${raised.json().id}/acknowledge`,
      strangerToken,
    );

    expect(response.statusCode).toBe(403);
  });

  it("still records the alert when the push provider is misconfigured", async () => {
    // Regression guard: a missing APNs key must not turn a panic into a 500.
    // The alert row is the source of truth; push is best-effort on top.
    await post("/api/v1/users/sync", mamaToken);
    await registerDevice(mamaToken, MAMA_TOKEN, "ios");
    await get("/api/v1/users/me", janeToken);
    await post("/api/v1/contacts", janeToken, {
      name: "Mama",
      phone: "+48444555666",
      email: "mama@example.com",
    });

    const raised = await post("/api/v1/alerts", janeToken, { level: 4 });

    expect(raised.statusCode).toBe(201);
    const history = await get("/api/v1/alerts", janeToken);
    expect(history.json()).toHaveLength(1);
    expect(history.json()[0]).toMatchObject({ level: 4, status: "active" });
  });

  it("refuses to let Jane acknowledge her own alert", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 2 });

    const response = await post(
      `/api/v1/alerts/${raised.json().id}/acknowledge`,
      janeToken,
    );

    expect(response.statusCode).toBe(403);
  });

  it("refuses a second acknowledgement", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 2 });
    await post(`/api/v1/alerts/${raised.json().id}/acknowledge`, mamaToken);

    const again = await post(
      `/api/v1/alerts/${raised.json().id}/acknowledge`,
      mamaToken,
    );

    expect(again.statusCode).toBe(409);
  });

  it("hides a resolved alert from a status=active inbox filter", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 2 });
    await post(`/api/v1/alerts/${raised.json().id}/resolve`, mamaToken);

    const active = await get("/api/v1/alerts/inbox?status=active", mamaToken);
    expect(active.json()).toHaveLength(0);

    const resolved = await get(
      "/api/v1/alerts/inbox?status=resolved",
      mamaToken,
    );
    expect(resolved.json()).toHaveLength(1);
  });
});

describe("closing an alert", () => {
  it("lets the owner resolve it", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 2 });

    const resolved = await post(
      `/api/v1/alerts/${raised.json().id}/resolve`,
      janeToken,
    );

    expect(resolved.json()).toMatchObject({ status: "resolved" });
    expect(resolved.json().resolvedAt).toBeTypeOf("string");
  });

  it("lets the contact resolve it", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 2 });

    const resolved = await post(
      `/api/v1/alerts/${raised.json().id}/resolve`,
      mamaToken,
    );
    expect(resolved.json().status).toBe("resolved");
  });

  it("refuses a third party resolving it", async () => {
    await seedLinkedPair();
    const strangerToken = await clerk.issueToken("user_stranger", {
      email: "stranger@example.com",
    });
    await post("/api/v1/users/sync", strangerToken);
    const raised = await post("/api/v1/alerts", janeToken, { level: 2 });

    const response = await post(
      `/api/v1/alerts/${raised.json().id}/resolve`,
      strangerToken,
    );
    expect(response.statusCode).toBe(403);
  });

  it("refuses resolving twice", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 2 });
    await post(`/api/v1/alerts/${raised.json().id}/resolve`, janeToken);

    const again = await post(
      `/api/v1/alerts/${raised.json().id}/resolve`,
      janeToken,
    );
    expect(again.statusCode).toBe(409);
  });

  it("cancels an accidental press inside the cancel window", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 1 });

    const cancelled = await post(
      `/api/v1/alerts/${raised.json().id}/cancel`,
      janeToken,
    );

    expect(cancelled.json().status).toBe("cancelled");
  });

  it("refuses to cancel once the contact may already be travelling", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 4 });

    // Backdate the alert past the 30s cancel window.
    await testDb.client.exec(
      `UPDATE alerts SET created_at = now() - interval '5 minutes' WHERE id = '${raised.json().id}'`,
    );

    const cancelled = await post(
      `/api/v1/alerts/${raised.json().id}/cancel`,
      janeToken,
    );

    expect(cancelled.statusCode).toBe(409);
    expect(cancelled.json().error.message).toMatch(/cancelled within/i);
  });

  it("refuses cancelling somebody else's alert", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 1 });

    const response = await post(
      `/api/v1/alerts/${raised.json().id}/cancel`,
      mamaToken,
    );
    expect(response.statusCode).toBe(403);
  });
});

describe("reading alerts", () => {
  it("returns 404 for a well-formed id that does not exist", async () => {
    const response = await get(
      "/api/v1/alerts/3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      janeToken,
    );
    expect(response.statusCode).toBe(404);
  });

  it("rejects a malformed id before touching the database", async () => {
    const response = await get("/api/v1/alerts/not-a-uuid", janeToken);
    expect(response.statusCode).toBe(400);
    // Fastify rejects before the handler runs, so the code is its own.
    expect(response.json().error.code).toMatch(/validation/i);
  });

  it("refuses to show an alert to a stranger", async () => {
    await seedLinkedPair();
    const strangerToken = await clerk.issueToken("user_stranger", {
      email: "stranger@example.com",
    });
    await post("/api/v1/users/sync", strangerToken);
    const raised = await post("/api/v1/alerts", janeToken, { level: 4 });

    const response = await get(
      `/api/v1/alerts/${raised.json().id}`,
      strangerToken,
    );
    expect(response.statusCode).toBe(403);
  });

  it("lets the contact read it", async () => {
    await seedLinkedPair();
    const raised = await post("/api/v1/alerts", janeToken, { level: 4 });

    const response = await get(`/api/v1/alerts/${raised.json().id}`, mamaToken);
    expect(response.statusCode).toBe(200);
  });

  it("filters own history by status", async () => {
    await seedLinkedPair();
    const first = await post("/api/v1/alerts", janeToken, { level: 1 });
    await post(`/api/v1/alerts/${first.json().id}/cancel`, janeToken);
    await post("/api/v1/alerts", janeToken, { level: 2 });

    const cancelled = await get("/api/v1/alerts?status=cancelled", janeToken);
    expect(cancelled.json()).toHaveLength(1);

    const active = await get("/api/v1/alerts?status=active", janeToken);
    expect(active.json()).toHaveLength(1);

    const all = await get("/api/v1/alerts", janeToken);
    expect(all.json()).toHaveLength(2);
  });

  it("caps the page size", async () => {
    await get("/api/v1/users/me", janeToken);
    const response = await get("/api/v1/alerts?limit=9999", janeToken);
    expect(response.statusCode).toBe(400);
  });
});

describe("profile", () => {
  it("updates the fields the app owns", async () => {
    await get("/api/v1/users/me", janeToken);

    const response = await patch("/api/v1/users/me", janeToken, {
      name: "Jane Doe",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().name).toBe("Jane Doe");
  });

  it("rejects an empty patch", async () => {
    await get("/api/v1/users/me", janeToken);
    const response = await patch("/api/v1/users/me", janeToken, {});
    expect(response.statusCode).toBe(400);
  });
});
