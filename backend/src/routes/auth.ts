import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import { userSchema } from "../schemas.js";

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Confirms the Clerk session token is still valid and returns the local
   * profile. Convenient as a startup check after login.
   */
  app.get(
    "/auth/session",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["auth"],
        summary: "Verify the session token",
        description: "Verifies the Clerk JWT and mirrors the profile locally.",
        response: { 200: userSchema },
      },
    },
    async (request) => request.user,
  );
};
