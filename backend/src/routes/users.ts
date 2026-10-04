import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";

import type { User } from "../db/schema.js";
import { NotFoundError } from "../core/errors.js";
import { updateProfileBody, userSchema } from "../schemas.js";
import { updateProfile } from "../services/user.service.js";

function formatUser(user: User) {
  return {
    ...user,
    displayName: user.name || null,
  };
}

export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * The auth hook mirrors the Clerk profile into our database on every
   * authenticated request, so this mainly confirms it landed.
   */
  app.post(
    "/users/sync",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["users"],
        summary: "Sync the Clerk profile locally",
        response: { 200: userSchema },
      },
    },
    async (request) => formatUser(request.user),
  );

  app.get(
    "/users/me",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["users"],
        summary: "Read own profile",
        response: { 200: userSchema },
      },
    },
    async (request) => formatUser(request.user),
  );

  app.patch(
    "/users/me",
    {
      preHandler: app.authenticate,
      schema: {
        tags: ["users"],
        summary: "Update own profile",
        body: updateProfileBody,
        response: { 200: userSchema },
      },
    },
    async (request) => {
      const { displayName, name, ...rest } = request.body;
      const effectiveName = displayName !== undefined ? displayName : name;
      const updated = await updateProfile(request.user.id, {
        ...rest,
        ...(effectiveName !== undefined && { name: effectiveName ?? "" }),
      });
      if (!updated) throw new NotFoundError("User not found");
      return formatUser(updated);
    },
  );
};
