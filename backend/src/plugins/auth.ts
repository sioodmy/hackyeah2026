import fp from "fastify-plugin";

import { extractBearerToken, verifyClerkToken } from "../core/clerk.js";
import { upsertFromClerk } from "../services/user.service.js";

/**
 * Clerk issues the session JWT (the app logs in with Google through Clerk).
 * This hook verifies it against Clerk's JWKS and mirrors the profile into our
 * database, so handlers can rely on `request.user` existing.
 */
async function authPlugin(
  app: import("fastify").FastifyInstance,
): Promise<void> {
  app.decorate("authenticate", async (request) => {
    const token = extractBearerToken(request.headers.authorization);
    const claims = await verifyClerkToken(token);
    const { user } = await upsertFromClerk(claims);

    request.claims = claims;
    request.user = user;
  });
}

export default fp(authPlugin, { name: "auth" });
