import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  contactIdParams,
  contactSchema,
  createContactBody,
  updateContactBody,
} from '../schemas.js';
import {
  createContact,
  deleteContact,
  listContacts,
  updateContact,
} from '../services/contact.service.js';

export const contactRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/contacts',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['contacts'],
        summary: 'List trusted contacts',
        description:
          'A contact is only reachable by push if they have an account and their email matches at the time of adding.',
        response: { 200: z.array(contactSchema) },
      },
    },
    async (request) => listContacts(request.user.id),
  );

  app.post(
    '/contacts',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['contacts'],
        summary: 'Add a trusted contact',
        body: createContactBody,
        response: { 201: contactSchema },
      },
    },
    async (request, reply) => {
      const contact = await createContact(request.user.id, request.body);
      return reply.status(201).send(contact);
    },
  );

  app.patch(
    '/contacts/:contactId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['contacts'],
        summary: 'Update a trusted contact',
        params: contactIdParams,
        body: updateContactBody,
        response: { 200: contactSchema },
      },
    },
    async (request) =>
      updateContact(request.user.id, request.params.contactId, request.body),
  );

  app.delete(
    '/contacts/:contactId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['contacts'],
        summary: 'Remove a trusted contact',
        params: contactIdParams,
        // A 204 has no body, so no response schema: the Zod serializer has
        // nothing to compile and Fastify would reject a null type here.
      },
    },
    async (request, reply) => {
      await deleteContact(request.user.id, request.params.contactId);
      return reply.status(204).send();
    },
  );
};