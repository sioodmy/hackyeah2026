import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { updateProfileBody, userSchema } from '../schemas.js';
import { updateProfile } from '../services/user.service.js';

export const userRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * The auth hook mirrors the Clerk profile into our database on every
   * authenticated request, so this mainly confirms it landed.
   */
  app.post(
    '/users/sync',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['users'],
        summary: 'Sync the Clerk profile locally',
        response: { 200: userSchema },
      },
    },
    async (request) => request.user,
  );

  app.get(
    '/users/me',
    {
      preHandler: app.authenticate,
      schema: { tags: ['users'], summary: 'Read own profile', response: { 200: userSchema } },
    },
    async (request) => request.user,
  );

  app.patch(
    '/users/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['users'],
        summary: 'Update own profile',
        body: updateProfileBody,
        response: { 200: userSchema },
      },
    },
    async (request) => updateProfile(request.user.id, request.body),
  );
};