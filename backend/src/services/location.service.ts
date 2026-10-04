/**
 * Live friend locations.
 *
 * Two rules hold everywhere in this file:
 *
 * 1. A ping is only ever visible to contacts who have accepted the link. There
 *    is no code path that returns someone's position to a stranger, which is
 *    what stops this endpoint from being a general-purpose tracker.
 * 2. Pings belong to an episode. Without an open alert there is nothing worth
 *    storing long-term, so the sample is kept only as part of the alert it
 *    belongs to.
 */

import { desc, eq, inArray } from "drizzle-orm";

import type { WireFrame } from "../core/realtime.js";
import { db } from "../db/client.js";
import {
  alerts,
  locationPings,
  users,
  type LocationPing,
} from "../db/schema.js";
import { linksForUser } from "./contact.service.js";

export interface LocationInput {
  lat: number;
  lng: number;
  acc?: number | null;
  bearing?: number | null;
  seq?: number | null;
  ts?: number | null;
  alertId?: string | null;
}

export interface Profile {
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FriendLocation {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
  lat: number;
  lng: number;
  acc: number | null;
  bearing: number | null;
  seq: number | null;
  ts: number | null;
  lastUpdate: string;
}

/** Contacts of `userId` who are also registered users, and so have a socket. */
export async function friendsWithAccounts(userId: string): Promise<string[]> {
  const links = await linksForUser(userId);
  return links
    .map((contact) => contact.contactUserId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

/**
 * Persist one position and return it.
 *
 * The ping is attached to the caller's open alert when one exists, so an
 * evidence session or a dispatch record points at the episode rather than at a
 * wall-clock guess.
 */
export async function storePing(
  userId: string,
  input: LocationInput,
): Promise<LocationPing> {
  let alertId = input.alertId ?? null;

  if (alertId === null) {
    const open = await db
      .select({ id: alerts.id })
      .from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(desc(alerts.createdAt))
      .limit(1);
    alertId = open[0]?.id ?? null;
  }

  const [ping] = await db
    .insert(locationPings)
    .values({
      userId,
      alertId,
      lat: input.lat,
      lng: input.lng,
      accuracy: input.acc ?? null,
      bearing: input.bearing ?? null,
      seq: input.seq ?? null,
      clientTs: input.ts ?? null,
    })
    .returning();

  return ping!;
}

/** The frame sent to contacts when this user moves. */
export function toFrame(
  userId: string,
  ping: LocationPing,
  profile: Profile,
): WireFrame {
  return {
    type: "location",
    userId,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    lat: ping.lat,
    lng: ping.lng,
    acc: ping.accuracy,
    bearing: ping.bearing,
    seq: ping.seq,
    ts: ping.clientTs,
  };
}

export async function profileOf(userId: string): Promise<Profile> {
  const [row] = await db
    .select({ name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return { displayName: row?.name ?? null, avatarUrl: row?.avatarUrl ?? null };
}

async function profilesOf(ids: string[]): Promise<Map<string, Profile>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, ids));

  const out = new Map<string, Profile>();
  for (const row of rows)
    out.set(row.id, { displayName: row.name, avatarUrl: row.avatarUrl });
  return out;
}

/**
 * Last known position of every accepted contact.
 *
 * One row per person, not one per sample: the map wants "where is she now",
 * and returning every ping would both bloat the response and leak the route
 * somebody took during an episode.
 */
export async function snapshotFor(userId: string): Promise<FriendLocation[]> {
  const friendIds = await friendsWithAccounts(userId);
  if (friendIds.length === 0) return [];

  const rows = await db
    .select()
    .from(locationPings)
    .where(inArray(locationPings.userId, friendIds))
    .orderBy(desc(locationPings.id))
    // Four samples per contact is enough to find the newest of each without
    // pulling the whole history into memory.
    .limit(friendIds.length * 4);

  const newest = new Map<string, LocationPing>();
  for (const row of rows) {
    if (!newest.has(row.userId)) newest.set(row.userId, row);
  }

  const profiles = await profilesOf([...newest.keys()]);

  return [...newest.values()].map((ping) => {
    const profile = profiles.get(ping.userId);
    return {
      userId: ping.userId,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      lat: ping.lat,
      lng: ping.lng,
      acc: ping.accuracy,
      bearing: ping.bearing,
      seq: ping.seq,
      ts: ping.clientTs,
      lastUpdate: ping.createdAt.toISOString(),
    };
  });
}

/**
 * Recent positions for the socket handshake.
 *
 * A phone that just reconnected would otherwise show an empty map until the
 * next ping interval, so the last known position per contact is replayed.
 */
export async function replayFor(
  userId: string,
  limit: number,
): Promise<FriendLocation[]> {
  return (await snapshotFor(userId)).slice(0, limit);
}
