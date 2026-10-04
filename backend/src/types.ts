import "fastify";

import type { ClerkClaims } from "./core/clerk.js";
import type { User } from "./db/schema.js";

declare module "fastify" {
  interface FastifyRequest {
    /** Verified Clerk JWT claims, set by the authenticate hook. */
    claims: ClerkClaims;
    /** Local profile row, mirrored from the claims by the authenticate hook. */
    user: User;
  }

  interface FastifyInstance {
    /** preHandler: verifies the JWT and mirrors the user profile. */
    authenticate: import("fastify").preHandlerHookHandler;
  }
}

export type AuthenticatedUser = User;
