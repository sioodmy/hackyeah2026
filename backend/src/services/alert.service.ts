import { and, desc, eq, inArray, lte } from "drizzle-orm";

import { env } from "../config/env.js";
import {
  alerts,
  users,
  type Alert,
  type AlertLevel,
  type AlertStatus,
} from "../db/schema.js";
import { db } from "../db/client.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../core/errors.js";
import {
  contactsToNotify,
  findBetween,
  linksForUser,
} from "./contact.service.js";
import { notifyContactsOfAlert, pushToUser } from "./notification.service.js";

export interface AlertInput {
  level: AlertLevel;
  message?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}

export interface InboxItem {
  alert: Alert;
  sender: { id: string; name: string; phone: string | null };
}

const OPEN_STATUSES: AlertStatus[] = ["active", "acknowledged"];

/**
 * Raises an alert and pushes it to the owner's contacts.
 *
 * One active alert per user: if something is already going on we raise the
 * existing alert's level instead of leaving a second one dangling.
 */
export async function createAlert(
  userId: string,
  input: AlertInput,
): Promise<Alert> {
  const active = await findActiveForUser(userId);

  if (active) {
    if (input.level <= active.level) return active;
    const [bumped] = await db
      .update(alerts)
      .set({
        level: input.level,
        message: input.message ?? active.message,
        updatedAt: new Date(),
      })
      .where(eq(alerts.id, active.id))
      .returning();
    const raised = bumped!;
    await notifyContactsOfAlert(
      raised,
      await contactsToNotify(userId, raised.level),
    );
    return raised;
  }

  const [created] = await db
    .insert(alerts)
    .values({
      userId,
      level: input.level,
      message: input.message ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      address: input.address ?? null,
      status: "active",
    })
    .returning();

  const alert = created!;
  await notifyContactsOfAlert(
    alert,
    await contactsToNotify(userId, alert.level),
  );
  return alert;
}

export async function findById(alertId: string): Promise<Alert> {
  const row = await db.query.alerts.findFirst({
    where: eq(alerts.id, alertId),
  });
  if (!row) throw new NotFoundError("Alert not found");
  return row;
}

export async function findActiveForUser(
  userId: string,
): Promise<Alert | undefined> {
  return db.query.alerts.findFirst({
    where: and(
      eq(alerts.userId, userId),
      inArray(alerts.status, OPEN_STATUSES),
    ),
    orderBy: [desc(alerts.createdAt)],
  });
}

export async function listForUser(
  userId: string,
  status: AlertStatus | undefined,
  limit: number,
): Promise<Alert[]> {
  return db.query.alerts.findMany({
    where: and(
      eq(alerts.userId, userId),
      ...(status ? [eq(alerts.status, status)] : []),
    ),
    orderBy: [desc(alerts.createdAt)],
    limit,
  });
}

/**
 * Alerts raised by anyone who lists this user as a trusted contact.
 * The mobile app polls this in the foreground as a fallback for lost pushes.
 */
export async function inboxForContact(
  recipientId: string,
  status: AlertStatus | undefined,
  limit: number,
): Promise<InboxItem[]> {
  const links = await linksForUser(recipientId);
  if (links.length === 0) return [];

  const ownerIds = [...new Set(links.map((link) => link.userId))];

  const rows = await db
    .select({ alert: alerts, sender: users })
    .from(alerts)
    .innerJoin(users, eq(users.id, alerts.userId))
    .where(
      and(
        inArray(alerts.userId, ownerIds),
        ...(status ? [eq(alerts.status, status)] : []),
      ),
    )
    .orderBy(desc(alerts.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    alert: row.alert,
    sender: {
      id: row.sender.id,
      name: row.sender.name,
      phone: row.sender.phone,
    },
  }));
}

/** A trusted contact confirms they are heading over. */
export async function acknowledgeAlert(
  alertId: string,
  recipientId: string,
): Promise<Alert> {
  const alert = await findById(alertId);
  if (alert.userId === recipientId) {
    throw new ForbiddenError("This is your own alert");
  }

  const link = await findBetween(alert.userId, recipientId);
  if (!link) throw new ForbiddenError("This alert was not addressed to you");
  if (alert.status !== "active") {
    throw new ConflictError("Alert is no longer active");
  }

  const [row] = await db
    .update(alerts)
    .set({
      status: "acknowledged",
      acknowledgedByContactId: link.id,
      acknowledgedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(alerts.id, alert.id))
    .returning();

  await pushToUser(alert.userId, {
    type: "ALERT_ACKNOWLEDGED",
    alert_id: alert.id,
    level: alert.level,
    contact_name: link.name,
    priority: "high",
  });

  return row!;
}

export async function resolveAlert(
  alertId: string,
  actorId: string,
): Promise<Alert> {
  const alert = await findById(alertId);

  if (alert.userId !== actorId) {
    const link = await findBetween(alert.userId, actorId);
    if (!link) throw new ForbiddenError("You cannot resolve this alert");
  }
  if (!OPEN_STATUSES.includes(alert.status)) {
    throw new ConflictError("Alert is already closed");
  }

  const [row] = await db
    .update(alerts)
    .set({ status: "resolved", resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(alerts.id, alert.id))
    .returning();

  return row!;
}

/** Wrong button press, so only allowed in the first seconds after raising. */
export async function cancelAlert(
  alertId: string,
  userId: string,
): Promise<Alert> {
  const alert = await findById(alertId);
  if (alert.userId !== userId)
    throw new ForbiddenError("You cannot cancel this alert");
  if (alert.status !== "active")
    throw new ConflictError("Only an active alert can be cancelled");

  const ageSeconds = (Date.now() - alert.createdAt.getTime()) / 1000;
  if (ageSeconds > env.CANCEL_WINDOW_SECONDS) {
    throw new ConflictError(
      `Alerts can only be cancelled within ${env.CANCEL_WINDOW_SECONDS}s`,
    );
  }

  const [row] = await db
    .update(alerts)
    .set({ status: "cancelled", resolvedAt: new Date(), updatedAt: new Date() })
    .where(eq(alerts.id, alert.id))
    .returning();

  return row!;
}

/**
 * Raises the level of alerts nobody responded to, and re-notifies contacts.
 * Marks the old alert as escalated and creates a fresh one at the higher level
 * so the timeline stays honest.
 */
export async function escalateDueAlerts(now = new Date()): Promise<Alert[]> {
  const ladder = [
    { from: 2, minutes: env.ESCALATE_UNSAFE_AFTER_MINUTES, to: 3 },
    { from: 3, minutes: env.ESCALATE_DANGER_AFTER_MINUTES, to: 4 },
  ] as const;

  const escalated: Alert[] = [];

  for (const step of ladder) {
    const cutoff = new Date(now.getTime() - step.minutes * 60_000);

    const stale = await db.query.alerts.findMany({
      where: and(
        eq(alerts.status, "active"),
        eq(alerts.level, step.from),
        lte(alerts.createdAt, cutoff),
      ),
      limit: 100,
    });

    for (const alert of stale) {
      await db
        .update(alerts)
        .set({ status: "escalated", updatedAt: new Date() })
        .where(eq(alerts.id, alert.id));

      const [raised] = await db
        .insert(alerts)
        .values({
          userId: alert.userId,
          level: step.to,
          message: alert.message,
          lat: alert.lat,
          lng: alert.lng,
          address: alert.address,
          status: "active",
          escalatedFromId: alert.id,
        })
        .returning();

      const next = raised!;
      await notifyContactsOfAlert(
        next,
        await contactsToNotify(next.userId, next.level),
      );
      escalated.push(next);
    }
  }

  return escalated;
}
