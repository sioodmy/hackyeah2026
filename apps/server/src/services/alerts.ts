import { randomUUID } from "node:crypto";

import { and, desc, eq, inArray } from "drizzle-orm";
import {
  type Alert,
  type AlertStatus,
  type RaiseAlertRequest,
  type RaiseAlertResponse,
  type ThreatLevel,
} from "@safecall/shared";

import { db } from "../db/client.js";
import { alertRecipients, alerts, deviceTokens, users } from "../db/schema.js";
import type { AlertRow } from "../db/schema.js";
import { hub } from "../realtime/hub.js";
import { acceptedFriendIds } from "./contacts.js";
import { dispatchProvider } from "./mock-dispatch.js";
import { pushProvider } from "./push.js";

export function toAlert(row: typeof alerts.$inferSelect): Alert {
  return {
    id: row.id,
    level: row.level as ThreatLevel,
    status: row.status as AlertStatus,
    location:
      row.lat !== null && row.lng !== null
        ? { lat: row.lat, lng: row.lng }
        : null,
    place: row.place,
    note: row.note,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    dispatchedAt: row.dispatchedAt ? row.dispatchedAt.toISOString() : null,
    dispatchReference: row.dispatchReference,
  };
}

export async function listAlerts(userId: string): Promise<Alert[]> {
  const rows = await db
    .select()
    .from(alerts)
    .where(eq(alerts.userId, userId))
    .orderBy(desc(alerts.createdAt))
    .limit(50);

  return rows.map(toAlert);
}

export async function activeAlertFor(userId: string): Promise<Alert | null> {
  const row = await activeAlertRow(userId);
  return row ? toAlert(row) : null;
}

async function activeAlertRow(userId: string): Promise<AlertRow | null> {
  const [row] = await db
    .select()
    .from(alerts)
    .where(
      and(
        eq(alerts.userId, userId),
        inArray(alerts.status, ["active", "escalated"]),
      ),
    )
    .orderBy(desc(alerts.updatedAt))
    .limit(1);

  return row ?? null;
}

export async function raiseAlert(
  userId: string,
  displayName: string,
  input: RaiseAlertRequest,
): Promise<RaiseAlertResponse> {
  const existing = input.alertId
    ? await loadAlert(input.alertId, userId)
    : await activeAlertRow(userId);

  const now = new Date();
  const escalating = existing !== null && input.level > existing.level;

  let row: AlertRow;

  if (existing) {
    const [updated] = await db
      .update(alerts)
      .set({
        level: input.level,
        status: escalating ? "escalated" : existing.status,
        lat: input.location?.lat ?? null,
        lng: input.location?.lng ?? null,
        place: input.place ?? existing.place,
        note: input.note ?? existing.note,
        updatedAt: now,
      })
      .where(eq(alerts.id, existing.id))
      .returning();

    row = updated ?? existing;
  } else {
    const [inserted] = await db
      .insert(alerts)
      .values({
        id: randomUUID(),
        userId,
        level: input.level,
        status: "active",
        lat: input.location?.lat ?? null,
        lng: input.location?.lng ?? null,
        place: input.place ?? null,
        note: input.note ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!inserted) throw new Error("Nie udało się utworzyć alarmu");
    row = inserted;
  }

  const alert = toAlert(row);

  // Level 1 is deliberately private: nobody is told anything.
  if (input.level < 2) {
    return { alert, notifiedCount: 0 };
  }

  const friendIds = await acceptedFriendIds(userId);
  if (friendIds.length > 0) {
    await recordRecipients(row.id, friendIds);
    await notifyFriends(userId, displayName, friendIds, alert, input.level);
  }

  if (input.level >= 3 && alert.dispatchedAt === null) {
    const receipt = await dispatchProvider.dispatch({
      service: "police",
      level: input.level,
      location: alert.location ?? { lat: 0, lng: 0 },
      accuracy: input.accuracy ?? null,
      place: alert.place,
      note: alert.note,
      alertId: alert.id,
    });

    const [dispatched] = await db
      .update(alerts)
      .set({
        dispatchedAt: new Date(receipt.receivedAt),
        dispatchReference: receipt.reference,
        updatedAt: new Date(),
      })
      .where(eq(alerts.id, alert.id))
      .returning();

    if (dispatched) {
      alert.dispatchedAt = dispatched.dispatchedAt?.toISOString() ?? null;
      alert.dispatchReference = dispatched.dispatchReference;
      hub.broadcast("dispatch:ack", receipt);
    }
  }

  return { alert, notifiedCount: friendIds.length };
}

export async function updateAlert(
  userId: string,
  alertId: string,
  patch: { level?: ThreatLevel; status?: AlertStatus; note?: string | null },
): Promise<Alert | null> {
  const existing = await loadAlert(alertId, userId);
  if (!existing) return null;

  const [updated] = await db
    .update(alerts)
    .set({
      ...(patch.level !== undefined ? { level: patch.level } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.note !== undefined ? { note: patch.note } : {}),
      updatedAt: new Date(),
      resolvedAt:
        patch.status === "resolved" || patch.status === "cancelled"
          ? new Date()
          : existing.resolvedAt,
    })
    .where(eq(alerts.id, alertId))
    .returning();

  const alert = toAlert(updated ?? existing);

  if (patch.status === "resolved" || patch.status === "cancelled") {
    const friendIds = await acceptedFriendIds(userId);
    if (friendIds.length === 0) return alert;

    const displayName = (await displayNameFor(userId)) ?? "Ktoś";
    for (const friendId of friendIds) {
      hub.send(friendId, "alert:cleared", {
        alertId: alert.id,
        contactId: userId,
        displayName,
      });
    }
  }

  return alert;
}

async function notifyFriends(
  userId: string,
  displayName: string,
  friendIds: string[],
  alert: Alert,
  level: ThreatLevel,
): Promise<void> {
  const contact = { id: userId, displayName, avatarUrl: null as string | null };

  for (const friendId of friendIds) {
    hub.sendFriendAlert(friendId, alert, contact, {
      dispatched: level >= 3,
      callMe: true,
    });
  }

  await pushFriends(friendIds, alert, level, displayName);
}

async function pushFriends(
  friendIds: string[],
  alert: Alert,
  level: ThreatLevel,
  displayName: string,
): Promise<void> {
  const tokens = await db
    .select({ token: deviceTokens.token })
    .from(deviceTokens)
    .where(inArray(deviceTokens.userId, friendIds));

  if (tokens.length === 0) return;

  const where = alert.location
    ? `${alert.location.lat.toFixed(5)}, ${alert.location.lng.toFixed(5)}`
    : "lokalizacja niedostępna";

  await pushProvider.send(
    tokens.map((row) => ({
      to: row.token,
      title:
        level >= 3
          ? `PEŁNY ALARM · ${displayName}`
          : `${displayName} potrzebuje pomocy`,
      body: `Poziom ${level} — ${where}. Zadzwoń do niej natychmiast.`,
      sound: level >= 3 ? "default" : undefined,
      priority: level >= 3 ? "high" : "default",
      data: {
        kind: "alert",
        alertId: alert.id,
        level: String(level),
        lat: String(alert.location?.lat ?? ""),
        lng: String(alert.location?.lng ?? ""),
      },
    })),
  );
}

async function recordRecipients(
  alertId: string,
  friendIds: string[],
): Promise<void> {
  const existing = await db
    .select({ userId: alertRecipients.userId })
    .from(alertRecipients)
    .where(
      and(
        eq(alertRecipients.alertId, alertId),
        inArray(alertRecipients.userId, friendIds),
      ),
    );

  const known = new Set(existing.map((row) => row.userId));
  const fresh = friendIds.filter((id) => !known.has(id));

  if (fresh.length === 0) return;

  await db.insert(alertRecipients).values(
    fresh.map((userId) => ({
      id: randomUUID(),
      alertId,
      userId,
      channel: "realtime",
      deliveredAt: new Date(),
    })),
  );
}

async function loadAlert(
  alertId: string,
  userId: string,
): Promise<AlertRow | null> {
  const [row] = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .limit(1);

  return row ?? null;
}

async function displayNameFor(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row?.displayName ?? null;
}
