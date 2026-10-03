import type { FastifyInstance } from "fastify";
import {
  createInviteRequestSchema,
  redeemInviteRequestSchema,
} from "@safecall/shared";

import { requireUser } from "../auth/clerk.js";
import { hub } from "../realtime/hub.js";
import {
  contactsFor,
  createInvite,
  redeemInvite,
  removeFriend,
} from "../services/contacts.js";

export async function contactsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/contacts", async (request) => {
    const principal = await requireUser(request);
    return contactsFor(principal.id);
  });

  app.post("/api/contacts", async (request, reply) => {
    const principal = await requireUser(request);
    const body = redeemInviteRequestSchema.parse(request.body);

    const contact = await redeemInvite(principal.id, body.code);
    if (!contact) {
      return reply.code(410).send({
        error: {
          message: "Kod jest nieaktualny, wygasł albo został już wykorzystany",
          code: "invite_unusable",
        },
      });
    }

    await syncContactTo(principal.id, contact);

    return { contact };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/contacts/:id",
    async (request) => {
      const principal = await requireUser(request);
      await removeFriend(principal.id, request.params.id);
      return { ok: true };
    },
  );

  app.post("/api/invites", async (request) => {
    const principal = await requireUser(request);
    const body = createInviteRequestSchema.parse(request.body ?? {});

    return createInvite(principal.id, principal.displayName, body.ttlSeconds);
  });

  app.get("/api/me", async (request) => {
    const principal = await requireUser(request);
    return principal;
  });
}

async function syncContactTo(
  ownerId: string,
  contact: { id: string; displayName: string; avatarUrl?: string | null },
): Promise<void> {
  const contacts = await contactsFor(ownerId);
  const fresh = contacts.find((item) => item.id === contact.id);
  if (!fresh) return;

  hub.send(ownerId, "contact:upsert", fresh);
}
