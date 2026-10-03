import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  deviceIdParams,
  deviceSchema,
  registerDeviceBody,
  updateDeviceBody,
} from '../schemas.js';
import {
  listDevices,
  registerDevice,
  removeDevice,
  setActive,
} from '../services/device.service.js';

export const deviceRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Called on every login. Without a registered token the phone receives
   * nothing, so this is the single most important integration call.
   */
  app.post(
    '/devices',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['devices'],
        summary: 'Register a push token',
        description:
          'Idempotent: posting an already-known token reactivates it and reassigns it to the caller.',
        body: registerDeviceBody,
        response: { 201: deviceSchema },
      },
    },
    async (request, reply) => {
      const device = await registerDevice(request.user.id, request.body);
      return reply.status(201).send(device);
    },
  );

  app.get(
    '/devices',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['devices'],
        summary: 'List own devices',
        response: { 200: z.array(deviceSchema) },
      },
    },
    async (request) => listDevices(request.user.id),
  );

  app.patch(
    '/devices/:deviceId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['devices'],
        summary: 'Pause or resume a token',
        params: deviceIdParams,
        body: updateDeviceBody,
        response: { 200: deviceSchema },
      },
    },
    async (request) =>
      setActive(request.user.id, request.params.deviceId, request.body.isActive),
  );

  app.delete(
    '/devices/:deviceId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['devices'],
        summary: 'Unregister a token',
        description: 'Called on logout.',
        params: deviceIdParams,
        // A 204 has no body, so no response schema: the Zod serializer has
        // nothing to compile and Fastify would reject a null type here.
      },
    },
    async (request, reply) => {
      await removeDevice(request.user.id, request.params.deviceId);
      return reply.status(204).send();
    },
  );
};