import { randomInt } from 'node:crypto';

import { and, asc, desc, eq, gt, isNull, or, sql } from 'drizzle-orm';

import { BadRequestError, ConflictError, NotFoundError } from '../core/errors.js';
import { db } from '../db/client.js';
import {
  contacts,
  inviteCodes,
  users,
  type Contact,
  type InviteCode,
  type User,
} from '../db/schema.js';
import { displayName, toPublicProfile, type PublicProfile } from './profile.service.js';

/**
 * No 0/O or 1/I: these codes get read aloud, typed in, and photographed off a
 * screen, and a 0/O mix-up costs someone their emergency contact.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export const DEFAULT_CODE_TTL_HOURS = 24;

/** A friend link is symmetric: if I can see her alerts, she sees mine. */
export interface Friendship {
  contact: Contact;
  friend: {
    id: string;
    /** Local nickname if set, otherwise her real name. */
    name: string;
    /** Her actual name, kept separate so the UI can show "Mamusia (Kasia)". */
    realName: string;
    phone: string | null;
    /** The slice of her profile she has chosen to share. */
    profile: PublicProfile;
  };
}

export async function createInviteCode(
  ownerId: string,
  options: { maxUses?: number; ttlHours?: number; requiresApproval?: boolean } = {},
): Promise<InviteCode> {
  const maxUses = options.maxUses ?? 1;
  const ttlHours = options.ttlHours ?? DEFAULT_CODE_TTL_HOURS;
  // Approval is the default: an invite is also a request for access to
  // someone's live location, so the owner decides who gets it.
  const requiresApproval = options.requiresApproval ?? true;

  if (maxUses < 1 || maxUses > 50) {
    throw new BadRequestError('maxUses must be between 1 and 50');
  }
  if (ttlHours < 1 || ttlHours > 24 * 30) {
    throw new BadRequestError('ttlHours must be between 1 hour and 30 days');
  }

  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);

  // Collisions are astronomically unlikely at 8 characters, but a retry loop
  // turns "unlikely" into "impossible" without adding a round trip.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const [row] = await db
      .insert(inviteCodes)
      .values({ ownerId, code, maxUses, requiresApproval, expiresAt })
      .onConflictDoNothing({ target: inviteCodes.code })
      .returning();

    if (row) return row;
  }

  throw new Error('Could not allocate a unique invite code');
}

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export interface InvitePreview extends InviteCode {
  /** Display name of whoever issued the code, for the confirm screen. */
  ownerName: string;
  ownerAvatarUrl: string | null;
}

/**
 * Reads a code without consuming it, for the "is this still valid?" check the
 * app does after a scan but before redeeming.
 */
export async function peekInviteCode(rawCode: string): Promise<InvitePreview> {
  const code = rawCode.trim().toUpperCase();

  const invite = await db.query.inviteCodes.findFirst({ where: eq(inviteCodes.code, code) });
  if (!invite) throw new NotFoundError('That code does not exist');

  const owner = await db.query.users.findFirst({ where: eq(users.id, invite.ownerId) });
  if (!owner) throw new NotFoundError('The person who made this code no longer exists');

  return {
    ...invite,
    ownerName: owner.name || 'Someone',
    ownerAvatarUrl: owner.avatarUrl,
  };
}

export async function listInviteCodes(ownerId: string): Promise<InviteCode[]> {
  return db.query.inviteCodes.findMany({
    where: eq(inviteCodes.ownerId, ownerId),
    orderBy: [desc(inviteCodes.createdAt)],
  });
}

export async function revokeInviteCode(ownerId: string, codeId: string): Promise<void> {
  const existing = await db.query.inviteCodes.findFirst({
    where: and(eq(inviteCodes.id, codeId), eq(inviteCodes.ownerId, ownerId)),
  });
  if (!existing) throw new NotFoundError('Invite code not found');

  await db
    .update(inviteCodes)
    .set({ revokedAt: new Date() })
    .where(eq(inviteCodes.id, codeId));
}

/** Everyone who shares their alerts with this user, in both directions. */
export async function listFriendships(userId: string): Promise<Friendship[]> {
  const rows = await db
    .select({ contact: contacts, friend: users })
    .from(contacts)
    .innerJoin(users, eq(users.id, contacts.contactUserId))
    .where(eq(contacts.userId, userId))
    .orderBy(asc(contacts.createdAt));

  return rows.map((row) => ({
    contact: row.contact,
    friend: {
      id: row.friend.id,
      // The nickname is what the owner calls her, so that is what the app
      // shows. It never leaves this row.
      name: displayName(row.contact),
      realName: row.friend.name,
      phone: row.friend.phone,
      profile: toPublicProfile(row.friend),
    },
  }));
}

/**
 * Per-contact settings: what to call her, from which level to notify, and
 * where to email a danger alert.
 */
export async function updateFriendSettings(
  userId: string,
  friendId: string,
  changes: {
    nickname?: string | null;
    minLevel?: number;
    notifyEmail?: string | null;
  },
): Promise<Contact> {
  const contact = await db.query.contacts.findFirst({
    where: and(eq(contacts.userId, userId), eq(contacts.contactUserId, friendId)),
  });
  if (!contact) throw new NotFoundError('Friend not found');

  const [row] = await db
    .update(contacts)
    .set({
      ...(changes.nickname !== undefined && { nickname: changes.nickname }),
      ...(changes.minLevel !== undefined && { minLevel: changes.minLevel }),
      ...(changes.notifyEmail !== undefined && { notifyEmail: changes.notifyEmail }),
    })
    .where(eq(contacts.id, contact.id))
    .returning();

  return row!;
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  // Both directions, in one statement: removing someone must also drop you
  // from their list, otherwise the "friends" promise is only half kept.
  await db
    .delete(contacts)
    .where(
      or(
        and(eq(contacts.userId, userId), eq(contacts.contactUserId, friendId)),
        and(eq(contacts.userId, friendId), eq(contacts.contactUserId, userId)),
      ),
    );
}

/**
 * Codes that can still be redeemed, for the UI to decide what to show.
 * `now` is injectable so the expiry window is testable without waiting.
 */
export function isRedeemable(code: InviteCode, now: Date = new Date()): boolean {
  return !code.revokedAt && code.usedCount < code.maxUses && code.expiresAt > now;
}

/**
 * What to encode in the QR image.
 *
 * A URI scheme rather than the bare code, so a scan opens the app directly and
 * the payload still says which server issued it.
 */
export function qrPayload(code: string, apiBaseUrl: string): string {
  const base = apiBaseUrl.replace(/\/+$/, '');
  return `${base}/api/v1/invites/redeem/${code}`;
}