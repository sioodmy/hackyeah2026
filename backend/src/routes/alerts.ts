import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { ForbiddenError } from '../core/errors.js';
import {
  alertIdParams,
  alertSchema,
  createAlertBody,
  inboxAlertSchema,
  listAlertsQuerystring,
} from '../schemas.js';
import {
  acknowledgeAlert,
  cancelAlert,
  createAlert,
  findById,
  inboxForContact,
  listForUser,
  resolveAlert,
} from '../services/alert.service.js';
import { findBetween } from '../services/contact.service.js';

const errorResponse = {
  400: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
  401: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
  403: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
  404: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
  409: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
};

export const alertRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Raise an alert. This is the whole client contract: one call, and the
   * backend fans out push notifications to every matching contact.
   *
   * If an alert is already open the level is raised in place rather than
   * creating a second one, and contacts are notified again.
   */
  app.post(
    '/alerts',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['alerts'],
        summary: 'Raise an alert',
        description: [
          'Creates the alert and immediately pushes it to every trusted contact',
          'whose `minLevel` threshold is reached. Level 4 additionally fires the',
          'optional emergency webhook.',
          '',
          'Re-raising while an alert is open bumps the existing one instead of',
          'creating a duplicate.',
        ].join('\n'),
        body: createAlertBody,
        response: { 201: alertSchema, ...errorResponse },
      },
    },
    async (request, reply) => {
      const alert = await createAlert(request.user.id, request.body);
      return reply.status(201).send(alert);
    },
  );

  app.get(
    '/alerts',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['alerts'],
        summary: 'Own alert history',
        querystring: listAlertsQuerystring,
        response: { 200: z.array(alertSchema), ...errorResponse },
      },
    },
    async (request) =>
      listForUser(request.user.id, request.query.status, request.query.limit),
  );

  /**
   * Alerts raised by anyone who lists this user as a trusted contact.
   *
   * The mobile app polls this while foregrounded as a safety net for a push
   * that never arrived. Polling is not needed in the background.
   */
  app.get(
    '/alerts/inbox',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['alerts'],
        summary: 'Alerts addressed to me as a contact',
        querystring: listAlertsQuerystring,
        response: { 200: z.array(inboxAlertSchema), ...errorResponse },
      },
    },
    async (request) => {
      const items = await inboxForContact(
        request.user.id,
        request.query.status,
        request.query.limit,
      );
      return items.map(({ alert, sender }) => ({
        ...alert,
        sender_name: sender.name,
        sender_phone: sender.phone,
      }));
    },
  );

  app.get(
    '/alerts/:alertId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['alerts'],
        summary: 'Read one alert',
        description: 'Readable by the owner and by the owner\'s contacts.',
        params: alertIdParams,
        response: { 200: alertSchema, ...errorResponse },
      },
    },
    async (request) => {
      const alert = await findById(request.params.alertId);
      if (alert.userId !== request.user.id) {
        const link = await findBetween(alert.userId, request.user.id);
        if (!link) throw new ForbiddenError('You cannot read this alert');
      }
      return alert;
    },
  );

  /**
   * A trusted contact confirms they are heading over. The sender's phone gets
   * an `ALERT_ACKNOWLEDGED` push, so she knows help is actually coming.
   */
  app.post(
    '/alerts/:alertId/acknowledge',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['alerts'],
        summary: 'Acknowledge an alert as a contact',
        description: 'Pushes `ALERT_ACKNOWLEDGED` back to the person who raised it.',
        params: alertIdParams,
        response: { 200: alertSchema, ...errorResponse },
      },
    },
    async (request) => acknowledgeAlert(request.params.alertId, request.user.id),
  );

  app.post(
    '/alerts/:alertId/resolve',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['alerts'],
        summary: 'Close an alert',
        description: 'Allowed for the owner and for any of the owner\'s contacts.',
        params: alertIdParams,
        response: { 200: alertSchema, ...errorResponse },
      },
    },
    async (request) => resolveAlert(request.params.alertId, request.user.id),
  );

  /**
   * Wrong button press. Only allowed within CANCEL_WINDOW_SECONDS of raising,
   * because after that the contacts may already be on their way.
   */
  app.post(
    '/alerts/:alertId/cancel',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['alerts'],
        summary: 'Cancel an alert just raised',
        params: alertIdParams,
        response: { 200: alertSchema, ...errorResponse },
      },
    },
    async (request) => cancelAlert(request.params.alertId, request.user.id),
  );
};