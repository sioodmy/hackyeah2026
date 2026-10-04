import { and, eq } from "drizzle-orm";

import { NotFoundError } from "../core/errors.js";
import { db } from "../db/client.js";
import { devices, type Device } from "../db/schema.js";

export interface DeviceInput {
  token: string;
  platform: "ios" | "android";
}

/**
 * Tokens are unique across users because they rotate: when someone logs in on
 * a new account the same physical device must not keep the old account's alerts.
 */
export async function registerDevice(
  userId: string,
  input: DeviceInput,
): Promise<Device> {
  const existing = await db.query.devices.findFirst({
    where: eq(devices.token, input.token),
  });

  if (existing) {
    const [row] = await db
      .update(devices)
      .set({
        userId,
        platform: input.platform,
        isActive: true,
        lastSeenAt: new Date(),
      })
      .where(eq(devices.id, existing.id))
      .returning();
    return row!;
  }

  const [row] = await db
    .insert(devices)
    .values({ userId, ...input })
    .returning();
  return row!;
}

export async function listDevices(userId: string): Promise<Device[]> {
  return db.query.devices.findMany({ where: eq(devices.userId, userId) });
}

export async function setActive(
  userId: string,
  deviceId: string,
  isActive: boolean,
): Promise<Device> {
  const [row] = await db
    .update(devices)
    .set({ isActive, lastSeenAt: new Date() })
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
    .returning();

  if (!row) throw new NotFoundError("Device not found");
  return row;
}

/** Called on logout so we stop pushing to a token we no longer own. */
export async function removeDevice(
  userId: string,
  deviceId: string,
): Promise<void> {
  await db
    .delete(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)));
}
