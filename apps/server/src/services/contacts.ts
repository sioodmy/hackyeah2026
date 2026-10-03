import { createHmac, randomInt, randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import {
  type Contact,
  type CreateInviteResponse,
  type InviteCodePayload,
} from "@safecall/shared";

import { config } from "../config.js";
import { db } from "../db/client.js";
import { friendships, inviteCodes, locations, users } from "../db/schema.js";

const CODE_TTL_SECONDS = 60 * 60;
const ISSUER = "safe-call";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export async function acceptedFriendIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ friendId: friendships.friendId })
    .from(friendships)
    .where(
      and(eq(friendships.ownerId, userId), eq(friendships.status, "accepted")),
    );

  return rows.map((row) => row.friendId);
}

export async function contactsFor(userId: string): Promise<Contact[]> {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      lat: locations.lat,
      lng: locations.lng,
      accuracy: locations.accuracy,
      heading: locations.heading,
      updatedAt: locations.updatedAt,
    })
    .from(friendships)
    .innerJoin(users, eq(users.id, friendships.friendId))
    .leftJoin(locations, eq(locations.userId, users.id))
    .where(
      and(eq(friendships.ownerId, userId), eq(friendships.status, "accepted")),
    )
    .orderBy(users.displayName);

  return rows.map((row) => ({
    id: row.id,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl ?? undefined,
    lastSeenAt: row.updatedAt ? row.updatedAt.toISOString() : undefined,
    location: row.updatedAt
      ? {
          lat: Number(row.lat),
          lng: Number(row.lng),
          accuracy: row.accuracy ?? undefined,
          heading: row.heading ?? undefined,
          updatedAt: row.updatedAt.toISOString(),
        }
      : null,
  }));
}

export async function createInvite(
  userId: string,
  displayName: string,
  ttlSeconds: number = CODE_TTL_SECONDS,
): Promise<CreateInviteResponse> {
  const code = await uniqueCode();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

  await db.insert(inviteCodes).values({
    code,
    userId,
    displayName,
    expiresAt,
  });

  const payload = signInvite({
    v: 1,
    code,
    userId,
    displayName,
    iss: ISSUER,
    exp: Math.floor(expiresAt.getTime() / 1000),
  });

  return {
    code,
    displayName,
    expiresAt: expiresAt.toISOString(),
    payload,
  };
}

export async function redeemInvite(
  ownerId: string,
  code: string,
): Promise<Contact | null> {
  const [invite] = await db
    .select()
    .from(inviteCodes)
    .where(eq(inviteCodes.code, code));

  if (!invite) return null;
  if (invite.expiresAt.getTime() < Date.now()) return null;
  if (invite.usedAt && invite.usedBy && invite.usedBy !== ownerId) return null;
  if (invite.userId === ownerId) return null;

  await db
    .insert(friendships)
    .values({ ownerId, friendId: invite.userId, status: "accepted" })
    .onConflictDoUpdate({
      target: [friendships.ownerId, friendships.friendId],
      set: { status: "accepted", updatedAt: new Date() },
    });

  await db
    .insert(friendships)
    .values({ ownerId: invite.userId, friendId: ownerId, status: "accepted" })
    .onConflictDoUpdate({
      target: [friendships.ownerId, friendships.friendId],
      set: { status: "accepted", updatedAt: new Date() },
    });

  await db
    .update(inviteCodes)
    .set({ usedAt: new Date(), usedBy: ownerId })
    .where(and(eq(inviteCodes.code, code), isNull(inviteCodes.usedAt)));

  const [friend] = await db
    .select()
    .from(users)
    .where(eq(users.id, invite.userId));

  if (!friend) return null;

  return {
    id: friend.id,
    displayName: friend.displayName,
    avatarUrl: friend.avatarUrl ?? undefined,
  };
}

export async function removeFriend(
  ownerId: string,
  contactId: string,
): Promise<void> {
  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.ownerId, ownerId),
        eq(friendships.friendId, contactId),
      ),
    );

  await db
    .delete(friendships)
    .where(
      and(
        eq(friendships.ownerId, contactId),
        eq(friendships.friendId, ownerId),
      ),
    );
}

async function uniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = `${randomChunk(4)}-${randomChunk(3)}`;
    const [existing] = await db
      .select({ code: inviteCodes.code })
      .from(inviteCodes)
      .where(eq(inviteCodes.code, code));

    if (!existing) return code;
  }

  return `X${randomUUID().replaceAll("-", "").slice(0, 7).toUpperCase()}`;
}

function randomChunk(length: number): string {
  return Array.from({ length }, () => {
    const index = randomInt(CODE_ALPHABET.length);
    return CODE_ALPHABET.charAt(index);
  }).join("");
}

type UnsignedInvite = Omit<InviteCodePayload, "sig">;

export function signInvite(input: UnsignedInvite): InviteCodePayload {
  const canonical = JSON.stringify(input);
  const sig = createHmac("sha256", config.INVITE_SIGNING_SECRET)
    .update(canonical)
    .digest("base64url");

  return { ...input, sig };
}

export function verifyInvite(payload: InviteCodePayload): boolean {
  const { sig, ...rest } = payload;
  const canonical = JSON.stringify(rest);
  const expected = createHmac("sha256", config.INVITE_SIGNING_SECRET)
    .update(canonical)
    .digest("base64url");

  if (sig.length !== expected.length) return false;
  return timingSafeEqual(sig, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}
