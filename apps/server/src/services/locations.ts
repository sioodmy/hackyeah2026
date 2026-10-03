import { eq } from "drizzle-orm";

import { db } from "../db/client.js";
import { locations, users } from "../db/schema.js";
import { hub } from "../realtime/hub.js";
import { acceptedFriendIds } from "./contacts.js";

export interface LocationFix {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  batteryLevel?: number | null;
}

export async function persistLocation(
  userId: string,
  fix: LocationFix,
): Promise<void> {
  await db
    .insert(locations)
    .values({
      userId,
      lat: fix.lat,
      lng: fix.lng,
      accuracy: fix.accuracy,
      heading: fix.heading,
      speed: fix.speed ?? null,
      batteryLevel: fix.batteryLevel ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: locations.userId,
      set: {
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        heading: fix.heading,
        speed: fix.speed ?? null,
        batteryLevel: fix.batteryLevel ?? null,
        updatedAt: new Date(),
      },
    });
}

/**
 * A heartbeat only ever describes one person, so each friend receives a
 * single-element contact list instead of their whole roster.
 */
export async function broadcastLocation(
  userId: string,
  fix: Pick<LocationFix, "lat" | "lng" | "accuracy" | "heading">,
): Promise<void> {
  const friendIds = await acceptedFriendIds(userId);
  if (friendIds.length === 0) return;

  const [self] = await db
    .select({ displayName: users.displayName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!self) return;

  const updatedAt = new Date().toISOString();

  const contact = {
    id: userId,
    displayName: self.displayName,
    avatarUrl: self.avatarUrl ?? undefined,
    lastSeenAt: updatedAt,
    location: {
      lat: fix.lat,
      lng: fix.lng,
      accuracy: fix.accuracy ?? undefined,
      heading: fix.heading ?? undefined,
      updatedAt,
    },
  };

  for (const friendId of friendIds) {
    hub.send(friendId, "locations", { contacts: [contact] });
  }
}
