import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';

import { db } from '../db/client.js';
import {
  alerts,
  contacts,
  users,
  type AlertLevel,
  type AlertStatus,
} from '../db/schema.js';
import { displayName } from './profile.service.js';

/**
 * A friend who is in danger right now, with the place to go.
 *
 * Returned only for friends with an open alert. Anyone without one is absent
 * from the response entirely rather than sent as "safe" — a caller cannot
 * accidentally render a list of everyone's locations.
 */
export interface DangerMarker {
  friend: {
    id: string;
    /** Local nickname if set, otherwise her real name. */
    name: string;
    realName: string;
    avatarUrl: string | null;
    /** Her own words about herself, shown on the marker card. */
    bio: string | null;
    /** Medical needs and so on, readable at the moment it matters. */
    emergencyNote: string | null;
    phone: string | null;
  };
  alert: {
    id: string;
    level: AlertLevel;
    status: AlertStatus;
    message: string | null;
    /**
     * Where she was when she pressed the button. `address` is the reverse
     * geocode the phone supplied; it is what the map should label the pin
     * with, because "Marszałkowska 1" is actionable and "52.23, 21.01" is not.
     */
    address: string | null;
    lat: number | null;
    lng: number | null;
    createdAt: Date;
    updatedAt: Date;
  };
  /** How stale the pin is, so the app can warn when it is old. */
  ageSeconds: number;
}

const OPEN_STATUSES: AlertStatus[] = ['active', 'acknowledged'];

/**
 * Friends who currently have an alert open, newest first.
 *
 * One marker per friend: if someone re-raised while an alert was already open
 * the row is replaced in place, but a friend can still have several historical
 * alerts, and only the newest open one is relevant on a map.
 */
export async function listDangerMarkers(userId: string): Promise<DangerMarker[]> {
  const rows = await db
    .select({ contact: contacts, friend: users, alert: alerts })
    .from(contacts)
    // Only mutual, accepted friends: a pending request must never put someone
    // on a map, and one-way manual contacts have not agreed to this.
    .innerJoin(users, eq(users.id, contacts.contactUserId))
    .innerJoin(
      alerts,
      and(eq(alerts.userId, contacts.contactUserId), inArray(alerts.status, OPEN_STATUSES)),
    )
    .where(eq(contacts.userId, userId))
    .orderBy(desc(alerts.createdAt));

  const now = Date.now();

  return rows.map((row) => ({
    friend: {
      id: row.friend.id,
      name: displayName(row.contact),
      realName: row.friend.name,
      avatarUrl: row.friend.avatarUrl,
      bio: row.friend.shareProfileWithFriends ? row.friend.bio : null,
      emergencyNote: row.friend.shareProfileWithFriends ? row.friend.emergencyNote : null,
      phone: row.friend.phone,
    },
    alert: {
      id: row.alert.id,
      level: row.alert.level,
      status: row.alert.status,
      message: row.alert.message,
      address: row.alert.address,
      lat: row.alert.lat,
      lng: row.alert.lng,
      createdAt: row.alert.createdAt,
      updatedAt: row.alert.updatedAt,
    },
    ageSeconds: Math.max(0, Math.round((now - row.alert.updatedAt.getTime()) / 1000)),
  }));
}

/**
 * One friend in detail, for the tap on a pin.
 *
 * Separate from the list because the address and her phone are the things a
 * responder needs, and the app fetches them only when someone is actually
 * tapped rather than shipping them for every pin at once.
 */
export async function findDangerMarker(
  userId: string,
  friendId: string,
): Promise<DangerMarker | undefined> {
  // The list is already scoped to friends with an open alert, so reusing it
  // keeps one definition of who may be seen on the map.
  const markers = await listDangerMarkers(userId);
  return markers.find((marker) => marker.friend.id === friendId);
}

/** How many friends are in danger, for a badge without fetching the map. */
export async function countDangerMarkers(userId: string): Promise<number> {
  const rows = await db
    .select({ id: alerts.id })
    .from(contacts)
    .innerJoin(
      alerts,
      and(eq(alerts.userId, contacts.contactUserId), inArray(alerts.status, OPEN_STATUSES)),
    )
    .where(eq(contacts.userId, userId));

  return rows.length;
}

/**
 * Marks with no coordinates.
 *
 * The app must not fall back to (0, 0) in this case: that would drop a pin in
 * the Gulf of Guinea and look like bad data. An address-only marker is still
 * worth showing, just not on the map proper.
 */
export function lacksCoordinates(marker: DangerMarker): boolean {
  return marker.alert.lat === null || marker.alert.lng === null;
}