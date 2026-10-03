import type { FastifyInstance } from "fastify";
import { WsClientEvent, type WsEnvelope } from "@safecall/shared";

import { identifyUpgrade } from "../auth/clerk.js";
import { hub } from "./hub.js";
import { contactsFor } from "../services/contacts.js";
import { broadcastLocation, persistLocation } from "../services/locations.js";

export async function realtimeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ws", { websocket: true }, async (socket, request) => {
    const query = request.query as { token?: string };
    const principal = await identifyUpgrade(query.token, request);

    if (!principal) {
      socket.close(4401, "unauthorized");
      return;
    }

    hub.add(principal.id, socket);

    hub.send(principal.id, "locations", {
      contacts: await contactsFor(principal.id),
    });

    socket.on("message", (raw: Buffer) => {
      let envelope: WsEnvelope<unknown>;
      try {
        envelope = JSON.parse(raw.toString()) as WsEnvelope<unknown>;
      } catch {
        return;
      }

      void handle(principal.id, envelope);
    });
  });
}

async function handle(
  userId: string,
  envelope: WsEnvelope<unknown>,
): Promise<void> {
  switch (envelope.type) {
    case WsClientEvent.Ping:
      hub.send(userId, "locations", { contacts: await contactsFor(userId) });
      break;

    case WsClientEvent.LocationPing: {
      const payload = envelope.payload as {
        lat?: unknown;
        lng?: unknown;
        accuracy?: unknown;
        heading?: unknown;
      };

      const lat = Number(payload.lat);
      const lng = Number(payload.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

      const fix = {
        lat,
        lng,
        accuracy: toNumberOrNull(payload.accuracy),
        heading: toNumberOrNull(payload.heading),
      };

      await persistLocation(userId, fix);
      await broadcastLocation(userId, fix);
      break;
    }

    default:
      break;
  }
}

function toNumberOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export {};
