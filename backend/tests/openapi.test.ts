/**
 * The OpenAPI document is generated from the same Zod schemas that validate
 * requests, so these assertions are the guard against the two drifting apart.
 * If a route's schema changes without the docs following, this fails.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ClerkStub } from "./helpers/auth.js";
import {
  createTestDatabase,
  type TestDatabaseHandle,
} from "./helpers/test-db.js";

let clerk: ClerkStub;
let testDb: TestDatabaseHandle;
let app: import("fastify").FastifyInstance;
let spec: Record<string, any>;

beforeAll(async () => {
  clerk = new ClerkStub();
  await clerk.start();

  const { buildApp } = await import("../src/app.js");
  const { setDatabase } = await import("../src/db/client.js");

  testDb = await createTestDatabase();
  setDatabase(testDb.db);

  app = await buildApp();
  await app.ready();

  spec = app.swagger() as Record<string, any>;
});

afterAll(async () => {
  // Set up may have failed partway; only tear down what was created.
  await app?.close();
  await testDb?.close();
  await clerk.stop();
});

describe("openapi document", () => {
  it("is served as JSON", async () => {
    const response = await app.inject({ method: "GET", url: "/docs/json" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
  });

  it("renders browsable documentation", async () => {
    const response = await app.inject({ method: "GET", url: "/docs" });
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("swagger");
  });

  it("is an OpenAPI 3 document", () => {
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe("Safety Alert API");
  });

  it("declares bearer authentication globally", () => {
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(spec.security).toEqual([{ bearerAuth: [] }]);
  });

  it("documents every endpoint the app needs", () => {
    const paths = Object.keys(spec.paths).sort();

    expect(paths).toEqual(
      [
        "/health",
        "/api/v1/alerts",
        "/api/v1/alerts/{alertId}",
        "/api/v1/alerts/{alertId}/acknowledge",
        "/api/v1/alerts/{alertId}/cancel",
        "/api/v1/alerts/{alertId}/resolve",
        "/api/v1/alerts/inbox",
        "/api/v1/auth/session",
        "/api/v1/contacts",
        "/api/v1/contacts/{contactId}",
        "/api/v1/devices",
        "/api/v1/devices/{deviceId}",
        "/api/v1/friends",
        "/api/v1/friends/{friendId}",
        "/api/v1/friends/requests",
        "/api/v1/friends/requests/count",
        "/api/v1/friends/requests/{requestId}/accept",
        "/api/v1/friends/requests/{requestId}/cancel",
        "/api/v1/friends/requests/{requestId}/decline",
        "/api/v1/invites",
        "/api/v1/invites/preview",
        "/api/v1/invites/redeem",
        "/api/v1/invites/{codeId}",
        "/api/v1/invites/{codeId}/links",
        "/api/v1/locations/ping",
        "/api/v1/locations/snapshot",
        "/api/v1/users/me",
        "/api/v1/users/sync",
      ].sort(),
    );
  });

  it("documents the accept step on a friend request", () => {
    const responses =
      spec.paths["/api/v1/friends/requests/{requestId}/accept"].post.responses;

    // 403 is the point of the endpoint: only the code owner may accept.
    expect(Object.keys(responses)).toEqual(
      expect.arrayContaining(["200", "403", "404", "409"]),
    );
  });

  it("documents the shareable web and deep links", () => {
    const links =
      spec.paths["/api/v1/invites"].post.responses["201"].content[
        "application/json"
      ].schema.properties.links;

    expect(Object.keys(links.properties).sort()).toEqual([
      "code",
      "deep",
      "web",
    ]);
  });

  it("documents the alert levels as a closed enum, not a bare integer", () => {
    const levelSchema =
      spec.paths["/api/v1/alerts"].post.requestBody.content["application/json"]
        .schema.properties.level;

    expect(levelSchema.enum).toEqual([1, 2, 3, 4]);
  });

  it("documents the create-alert request body", () => {
    const body =
      spec.paths["/api/v1/alerts"].post.requestBody.content["application/json"]
        .schema;

    expect(body.required).toEqual(["level"]);
    expect(Object.keys(body.properties).sort()).toEqual(
      ["address", "lat", "level", "lng", "message"].sort(),
    );
  });

  it("documents the alert response fields the app parses", () => {
    const schema =
      spec.paths["/api/v1/alerts"].post.responses["201"].content[
        "application/json"
      ].schema;

    for (const field of [
      "id",
      "level",
      "status",
      "message",
      "lat",
      "lng",
      "address",
      "createdAt",
    ]) {
      expect(Object.keys(schema.properties)).toContain(field);
    }
  });

  it("documents the inbox shape with the sender attached", () => {
    const items =
      spec.paths["/api/v1/alerts/inbox"].get.responses["200"].content[
        "application/json"
      ].schema;
    const properties = Object.keys(items.items.properties);

    expect(properties).toContain("sender_name");
    expect(properties).toContain("sender_phone");
  });

  it("documents list filters", () => {
    const params = spec.paths["/api/v1/alerts"].get.parameters.map(
      (p: any) => p.name,
    );

    expect(params).toEqual(expect.arrayContaining(["status", "limit"]));
  });

  it("documents every error status a client can hit", () => {
    const responses = Object.keys(
      spec.paths["/api/v1/alerts/{alertId}/acknowledge"].post.responses,
    );

    expect(responses).toEqual(
      expect.arrayContaining(["200", "400", "401", "403", "404", "409"]),
    );
  });

  it("uses one error envelope everywhere", () => {
    const errorSchema =
      spec.paths["/api/v1/alerts/{alertId}/cancel"].post.responses["409"]
        .content["application/json"].schema;

    expect(Object.keys(errorSchema.properties)).toEqual(["error"]);
    expect(Object.keys(errorSchema.properties.error.properties).sort()).toEqual(
      ["code", "message"],
    );
  });

  it("groups endpoints under the documented tags", () => {
    const tags = spec.tags.map((t: any) => t.name);

    expect(tags).toEqual([
      "meta",
      "auth",
      "users",
      "contacts",
      "devices",
      "alerts",
      "friends",
    ]);
  });

  it("documents the invite code and QR payload the app scans", () => {
    const created =
      spec.paths["/api/v1/invites"].post.responses["201"].content[
        "application/json"
      ].schema;

    // The QR code is rendered from this string, so it has to be in the docs.
    expect(Object.keys(created.properties)).toEqual(
      expect.arrayContaining(["code", "qrPayload", "redeemable", "expiresAt"]),
    );
  });

  it("documents that redeeming takes a code in the body", () => {
    const body =
      spec.paths["/api/v1/invites/redeem"].post.requestBody.content[
        "application/json"
      ].schema;

    expect(body.required).toEqual(["code"]);
    expect(body.properties.code.type).toBe("string");
  });

  it("exposes a usable 400 error shape", async () => {
    const token = await clerk.issueToken("user_errshape", {
      email: "err@example.com",
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/alerts",
      headers: { authorization: `Bearer ${token}` },
      payload: { level: 9 },
    });

    // Fastify rejects before the handler, so the code is Fastify's own rather
    // than our 'validation_error'. The envelope shape is what clients rely on.
    expect(response.statusCode).toBe(400);
    expect(Object.keys(response.json().error).sort()).toEqual([
      "code",
      "message",
    ]);
    expect(response.json().error.message).toMatch(/1\|2\|3\|4/);
  });

  it("carries the description text for the alert endpoints", () => {
    expect(spec.paths["/api/v1/alerts"].post.description).toMatch(
      /pushes it to every trusted/i,
    );
    expect(spec.paths["/api/v1/alerts"].post.summary).toBe("Raise an alert");
  });
});

describe("responses match the spec", () => {
  it("returns fields the declared response schema promises", async () => {
    // A serializer mismatch would strip or rename fields, so compare the real
    // body against the schema rather than trusting the compiler.
    const token = await clerk.issueToken("user_spec", {
      email: "spec@example.com",
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/users/sync",
      headers: { authorization: `Bearer ${token}` },
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/users/me",
      headers: { authorization: `Bearer ${token}` },
    });

    const schema =
      spec.paths["/api/v1/users/me"].get.responses["200"].content[
        "application/json"
      ].schema;

    for (const field of Object.keys(schema.properties)) {
      expect(response.json()).toHaveProperty(field);
    }
  });
});
