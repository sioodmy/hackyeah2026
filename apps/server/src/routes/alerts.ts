import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  dispatchRequestSchema,
  locationUpdateSchema,
  registerDeviceRequestSchema,
  updateAlertRequestSchema,
  raiseAlertRequestSchema,
} from "@safecall/shared";

import { requireUser } from "../auth/clerk.js";
import { db } from "../db/client.js";
import { alerts, deviceTokens } from "../db/schema.js";
import { hub } from "../realtime/hub.js";
import {
  activeAlertFor,
  listAlerts,
  raiseAlert,
  updateAlert,
} from "../services/alerts.js";
import { dispatchProvider } from "../services/mock-dispatch.js";
import { broadcastLocation, persistLocation } from "../services/locations.js";

export async function alertRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/alerts", async (request) => {
    const principal = await requireUser(request);
    return listAlerts(principal.id);
  });

  app.get("/api/alerts/active", async (request) => {
    const principal = await requireUser(request);
    return activeAlertFor(principal.id);
  });

  app.post("/api/alerts", async (request, reply) => {
    const principal = await requireUser(request);
    const body = raiseAlertRequestSchema.parse(request.body);

    return raiseAlert(principal.id, principal.displayName, body);
  });

  app.patch<{ Params: { id: string } }>(
    "/api/alerts/:id",
    async (request, reply) => {
      const principal = await requireUser(request);
      const body = updateAlertRequestSchema.parse(request.body);

      const alert = await updateAlert(principal.id, request.params.id, body);
      if (!alert) {
        return reply.code(404).send({
          error: { message: "Nie znaleziono alarmu", code: "alert_not_found" },
        });
      }

      return alert;
    },
  );

  app.post("/api/dispatch", async (request) => {
    await requireUser(request);
    const body = dispatchRequestSchema.parse(request.body);

    const receipt = await dispatchProvider.dispatch({
      service: body.service,
      level: body.level,
      location: body.location,
      accuracy: body.accuracy ?? null,
      place: body.place ?? null,
      note: body.note ?? null,
      alertId: body.alertId,
    });

    if (body.alertId) {
      await db
        .update(alerts)
        .set({
          dispatchedAt: new Date(receipt.receivedAt),
          dispatchReference: receipt.reference,
          updatedAt: new Date(),
        })
        .where(eq(alerts.id, body.alertId));
    }

    return receipt;
  });
}

export async function locationRoutes(app: FastifyInstance): Promise<void> {
  app.put("/api/locations/me", async (request) => {
    const principal = await requireUser(request);
    const body = locationUpdateSchema.parse(request.body);

    await persistLocation(principal.id, body);
    await broadcastLocation(principal.id, body);

    return { ok: true };
  });
}

export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/devices", async (request) => {
    const principal = await requireUser(request);
    const body = registerDeviceRequestSchema.parse(request.body);

    await db
      .insert(deviceTokens)
      .values({
        id: randomUUID(),
        userId: principal.id,
        token: body.token,
        platform: body.platform,
        provider: body.provider,
      })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: { userId: principal.id },
      });

    return { ok: true };
  });
}
