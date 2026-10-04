/**
 * The escalation sweep is what protects someone whose phone is asleep: level 2
 * unanswered for 15 minutes becomes 3, level 3 unanswered for 5 becomes 4, and
 * contacts are notified again each time.
 *
 * Timers are simulated by ageing rows rather than waiting for the clock.
 */
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ClerkStub } from "./helpers/auth.js";
import { backdateAlert, readAlert } from "./helpers/escalation.js";
import { installPushCredentials } from "./helpers/push-credentials.js";
import { recordPushes, type PushRecorder } from "./helpers/sent-pushes.js";
import {
  createTestDatabase,
  type TestDatabaseHandle,
} from "./helpers/test-db.js";

const JANE_CLERK_ID = "user_jane";
const MAMA_CLERK_ID = "user_mama";
const MAMA_TOKEN = "mama-apns-token";

let clerk: ClerkStub;
let testDb: TestDatabaseHandle;
let app: FastifyInstance;
let pushes: PushRecorder;
let escalate: typeof import("../src/services/alert.service.js").escalateDueAlerts;

let janeToken: string;
let mamaToken: string;

beforeAll(async () => {
  clerk = new ClerkStub();
  await clerk.start();
  await installPushCredentials();

  const { buildApp } = await import("../src/app.js");
  const { setDatabase } = await import("../src/db/client.js");
  ({ escalateDueAlerts: escalate } =
    await import("../src/services/alert.service.js"));

  testDb = await createTestDatabase();
  setDatabase(testDb.db);

  app = await buildApp();
  await app.ready();

  pushes = recordPushes();

  janeToken = await clerk.issueToken(JANE_CLERK_ID, {
    email: "jane@example.com",
    first_name: "Jane",
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

/** Jane with Mama as a linked, push-enabled contact. */
async function seedPair(): Promise<void> {
  await post("/api/v1/users/sync", mamaToken);
  await post("/api/v1/devices", mamaToken, {
    token: MAMA_TOKEN,
    platform: "ios",
  });
  await post("/api/v1/users/sync", janeToken);
  await post("/api/v1/contacts", janeToken, {
    name: "Mama",
    phone: "+48444555666",
    email: "mama@example.com",
    minLevel: 1,
  });
}

async function raiseAlert(level: number): Promise<string> {
  const response = await post("/api/v1/alerts", janeToken, {
    level,
    lat: 52.2297,
    lng: 21.0122,
    address: "Marszałkowska 1",
  });
  expect(response.statusCode).toBe(201);
  return response.json().id as string;
}

describe("escalating unanswered alerts", () => {
  it("leaves a fresh alert alone", async () => {
    await seedPair();
    const id = await raiseAlert(2);

    const escalated = await escalate();

    expect(escalated).toHaveLength(0);
    expect((await readAlert(testDb, id))?.status).toBe("active");
  });

  it("raises level 2 to 3 after 15 minutes", async () => {
    await seedPair();
    const id = await raiseAlert(2);
    await backdateAlert(testDb, id, 16);
    pushes.sent.length = 0;

    const escalated = await escalate();

    expect(escalated).toHaveLength(1);
    expect(escalated[0]).toMatchObject({ level: 3, escalatedFromId: id });

    // The original is marked escalated rather than mutated, so the timeline reads true.
    expect((await readAlert(testDb, id))?.status).toBe("escalated");
  });

  it("carries the location forward to the escalated alert", async () => {
    await seedPair();
    const id = await raiseAlert(2);
    await backdateAlert(testDb, id, 16);

    const [raised] = await escalate();

    expect(raised).toMatchObject({
      lat: 52.2297,
      lng: 21.0122,
      address: "Marszałkowska 1",
    });
  });

  it("notifies contacts again on escalation", async () => {
    await seedPair();
    const id = await raiseAlert(2);
    await backdateAlert(testDb, id, 16);
    pushes.sent.length = 0;

    await escalate();

    const push = pushes.forToken(MAMA_TOKEN)[0]!;
    expect(push.body).toMatchObject({
      type: "ALERT",
      level: 3,
      level_name: "danger",
    });
  });

  it("reaches omega when level 3 goes unanswered for 5 minutes", async () => {
    await seedPair();
    const id = await raiseAlert(3);
    await backdateAlert(testDb, id, 6);
    pushes.sent.length = 0;

    const escalated = await escalate();

    expect(escalated[0]?.level).toBe(4);
    expect(pushes.forToken(MAMA_TOKEN)[0]?.body).toMatchObject({
      level: 4,
      level_name: "omega",
      priority: "critical",
    });
  });

  it("uses the critical delivery flags once it reaches omega", async () => {
    await seedPair();
    const id = await raiseAlert(3);
    await backdateAlert(testDb, id, 6);
    // Clear the level-3 push so we assert on the escalation only.
    pushes.sent.length = 0;
    await escalate();

    const push = pushes.forToken(MAMA_TOKEN)[0]!;

    expect(push.headers["apns-priority"]).toBe("10");
    expect(push.body.aps).toMatchObject({
      sound: "critical.caf",
      interruptionLevel: "time-sensitive",
      category: "ALERT_CRITICAL",
    });
  });

  it("never escalates past omega", async () => {
    await seedPair();
    const id = await raiseAlert(4);
    // Long past any threshold.
    await backdateAlert(testDb, id, 600);

    const escalated = await escalate();

    expect(escalated).toHaveLength(0);
    expect((await readAlert(testDb, id))?.status).toBe("active");
  });

  it("ignores an alert the contact already acknowledged", async () => {
    await seedPair();
    const id = await raiseAlert(2);
    await backdateAlert(testDb, id, 16);
    await post(`/api/v1/alerts/${id}/acknowledge`, mamaToken);

    const escalated = await escalate();

    expect(escalated).toHaveLength(0);
  });

  it("ignores an alert she already cancelled", async () => {
    await seedPair();
    const id = await raiseAlert(2);
    await post(`/api/v1/alerts/${id}/cancel`, janeToken);
    await backdateAlert(testDb, id, 16);

    const escalated = await escalate();

    expect(escalated).toHaveLength(0);
  });

  it("walks 2 to 3 to 4 across two sweeps", async () => {
    await seedPair();
    const id = await raiseAlert(2);

    await backdateAlert(testDb, id, 16);
    const [toThree] = await escalate();
    expect(toThree?.level).toBe(3);

    // The fresh alert then ages past the danger threshold.
    await backdateAlert(testDb, toThree!.id, 6);
    const [toFour] = await escalate();
    expect(toFour?.level).toBe(4);

    // And stops there.
    await backdateAlert(testDb, toFour!.id, 600);
    expect(await escalate()).toHaveLength(0);
  });

  it("escalates several people at once", async () => {
    await seedPair();

    // A second woman with her own contact, since one person can only ever
    // have a single open alert.
    const kasiaToken = await clerk.issueToken("user_kasia", {
      email: "kasia@example.com",
      first_name: "Kasia",
    });
    await post("/api/v1/users/sync", kasiaToken);
    const buddy = await post("/api/v1/users/sync", mamaToken);
    expect(buddy.statusCode).toBe(200);
    await post("/api/v1/contacts", kasiaToken, {
      name: "Mama",
      phone: "+48444555666",
      email: "mama@example.com",
    });

    const first = await raiseAlert(2);
    const second = await post("/api/v1/alerts", kasiaToken, { level: 2 });
    expect(second.statusCode).toBe(201);

    await backdateAlert(testDb, first, 16);
    await backdateAlert(testDb, second.json().id as string, 16);

    const escalated = await escalate();

    expect(escalated).toHaveLength(2);
    expect(escalated.every((alert) => alert.level === 3)).toBe(true);
  });
});
