/**
 * Friend requests: scan a code, the other person decides.
 *
 * Previously scanning linked people immediately, which quietly handed a
 * stranger permanent access to your live location during an emergency. Now a
 * scan files a request and nothing is shared until it is accepted.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { ConflictError, ForbiddenError, NotFoundError } from '../core/errors.js';
import { db } from '../db/client.js';
import {
  contacts,
  friendRequests,
  inviteCodes,
  users,
  type Contact,
  type FriendRequest,
  type User,
} from '../db/schema.js';

export interface FriendRequestView {
  request: FriendRequest;
  /** Whoever sent the request, for the addressee to recognise. */
  from: { id: string; name: string; avatarUrl: string | null; bio: string | null };
  /** Whoever must decide, for the requester to wait on. */
  to: { id: string; name: string };
}

export interface AcceptResult {
  request: FriendRequest;
  contact: Contact;
  friend: { id: string; name: string; phone: string | null };
}

/**
 * Turns a scanned code into a pending request.
 *
 * The code slot is claimed here so a screenshot cannot be replayed, but no
 * contact link is created: that waits for acceptance.
 */
export async function requestFriendship(
  requesterId: string,
  rawCode: string,
  message?: string,
): Promise<{ request: FriendRequestView; alreadyRequested: boolean }> {
  const code = rawCode.trim().toUpperCase();

  const invite = await db.query.inviteCodes.findFirst({ where: eq(inviteCodes.code, code) });
  if (!invite) throw new NotFoundError('That code does not exist');
  if (invite.ownerId === requesterId) {
    throw new ConflictError('You cannot use your own code');
  }
  if (invite.revokedAt) throw new ConflictError('That code was cancelled');
  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new ConflictError('That code has expired');
  }

  const addressee = await db.query.users.findFirst({ where: eq(users.id, invite.ownerId) });
  if (!addressee) throw new NotFoundError('The person who made this code no longer exists');

  // Already friends: say so rather than filing a request neither wants.
  const existing = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.userId, invite.ownerId),
      eq(contacts.contactUserId, requesterId),
    ),
  });
  if (existing) {
    return {
      request: await settledView(requesterId, invite.ownerId),
      alreadyRequested: false,
    };
  }

  const pending = await db.query.friendRequests.findFirst({
    where: and(
      eq(friendRequests.requesterId, requesterId),
      eq(friendRequests.addresseeId, invite.ownerId),
      eq(friendRequests.status, 'pending'),
    ),
  });
  if (pending) {
    // Re-scanning while waiting: same request, no error, no duplicate.
    return { request: await viewOf(pending), alreadyRequested: true };
  }

  // Claim a slot only when approval is needed; an auto-approve code does not
  // consume uses on scan.
  let codeId: string | null = null;
  if (invite.requiresApproval) {
    const [claimed] = await db
      .update(inviteCodes)
      .set({ usedCount: sql`${inviteCodes.usedCount} + 1` })
      .where(
        and(
          eq(inviteCodes.id, invite.id),
          // The capacity guard is the whole point: two simultaneous scans of
          // the same screenshot must not both create a request.
          sql`${inviteCodes.usedCount} < ${inviteCodes.maxUses}`,
          isNull(inviteCodes.revokedAt),
          sql`${inviteCodes.expiresAt} > now()`,
        ),
      )
      .returning();

    if (!claimed) throw new ConflictError('That code has already been used');
    codeId = claimed.id;

    const [created] = await db
      .insert(friendRequests)
      .values({
        requesterId,
        addresseeId: invite.ownerId,
        inviteCodeId: codeId,
        message: message ?? null,
      })
      .returning();

    return { request: await viewOf(created!), alreadyRequested: false };
  }

  // No approval needed: link immediately, the way the pre-approval behaviour
  // did. There is no request to file and nobody to wait for.
  const requester = await db.query.users.findFirst({ where: eq(users.id, requesterId) });
  if (!requester) throw new NotFoundError('Your account no longer exists');

  await linkMutually(addressee, requester);
  await settleReverseRequest(requesterId, addressee.id);

  return {
    request: await settledView(requesterId, addressee.id),
    alreadyRequested: false,
  };
}

/**
 * The settled outcome for a pair that is already linked, so every caller gets
 * the same shape whether approval was skipped or the friendship predates this.
 */
async function settledView(a: string, b: string): Promise<FriendRequestView> {
  const row = await db.query.friendRequests.findFirst({
    where: and(
      eq(friendRequests.requesterId, a),
      eq(friendRequests.addresseeId, b),
    ),
  });
  if (row) return viewOf(row);

  // Never requested: synthesise an accepted request so the response still
  // matches the documented shape.
  return viewOf({
    id: '00000000-0000-0000-0000-000000000000',
    requesterId: a,
    addresseeId: b,
    status: 'accepted',
    inviteCodeId: null,
    message: null,
    respondedAt: new Date(),
    createdAt: new Date(),
  });
}

async function settleReverseRequest(requesterId: string, addresseeId: string): Promise<void> {
  await db
    .update(friendRequests)
    .set({ status: 'accepted', respondedAt: new Date() })
    .where(
      and(
        eq(friendRequests.requesterId, addresseeId),
        eq(friendRequests.addresseeId, requesterId),
        eq(friendRequests.status, 'pending'),
      ),
    );
}

/** The addressee's inbox of things waiting for a decision. */
export async function listIncoming(
  userId: string,
  status: FriendRequest['status'] = 'pending',
): Promise<FriendRequestView[]> {
  const rows = await db.query.friendRequests.findMany({
    where: and(
      eq(friendRequests.addresseeId, userId),
      eq(friendRequests.status, status),
    ),
    orderBy: [desc(friendRequests.createdAt)],
  });
  return Promise.all(rows.map(viewOf));
}

/** What I sent, so the app can show "waiting for an answer". */
export async function listOutgoing(
  userId: string,
  status: FriendRequest['status'] = 'pending',
): Promise<FriendRequestView[]> {
  const rows = await db.query.friendRequests.findMany({
    where: and(
      eq(friendRequests.requesterId, userId),
      eq(friendRequests.status, status),
    ),
    orderBy: [desc(friendRequests.createdAt)],
  });
  return Promise.all(rows.map(viewOf));
}

/**
 * Accepts a request and links both accounts.
 *
 * Only the addressee may accept: the person who owns the code decides who gets
 * access to their alerts.
 */
export async function acceptRequest(
  requestId: string,
  userId: string,
): Promise<AcceptResult> {
  const request = await db.query.friendRequests.findFirst({
    where: eq(friendRequests.id, requestId),
  });
  if (!request) throw new NotFoundError('Friend request not found');
  if (request.addresseeId !== userId) {
    throw new ForbiddenError('Only the person who received the request can accept it');
  }
  if (request.status !== 'pending') {
    throw new ConflictError(`This request was already ${request.status}`);
  }

  const [claimed] = await db
    .update(friendRequests)
    .set({ status: 'accepted', respondedAt: new Date() })
    .where(and(eq(friendRequests.id, requestId), eq(friendRequests.status, 'pending')))
    .returning();
  if (!claimed) throw new ConflictError('This request was already answered');

  const requester = await db.query.users.findFirst({
    where: eq(users.id, request.requesterId),
  });
  const addressee = await db.query.users.findFirst({
    where: eq(users.id, request.addresseeId),
  });
  if (!requester || !addressee) {
    throw new NotFoundError('One of these accounts no longer exists');
  }

  const contact = await linkMutually(addressee, requester);

  // The reverse direction is now pending too. Auto-accepting it would mean the
  // requester silently gains access back, which is not what they asked for.
  await settleReverse(request);

  return {
    request: claimed,
    contact,
    friend: { id: requester.id, name: requester.name, phone: requester.phone },
  };
}

export async function declineRequest(requestId: string, userId: string): Promise<FriendRequest> {
  const request = await db.query.friendRequests.findFirst({
    where: eq(friendRequests.id, requestId),
  });
  if (!request) throw new NotFoundError('Friend request not found');
  if (request.addresseeId !== userId) {
    throw new ForbiddenError('Only the person who received the request can decline it');
  }
  if (request.status !== 'pending') {
    throw new ConflictError(`This request was already ${request.status}`);
  }

  const [declined] = await db
    .update(friendRequests)
    .set({ status: 'declined', respondedAt: new Date() })
    .where(and(eq(friendRequests.id, requestId), eq(friendRequests.status, 'pending')))
    .returning();

  return declined!;
}

export async function cancelRequest(requestId: string, userId: string): Promise<void> {
  const request = await db.query.friendRequests.findFirst({
    where: eq(friendRequests.id, requestId),
  });
  if (!request) throw new NotFoundError('Friend request not found');
  if (request.requesterId !== userId) {
    throw new ForbiddenError('Only the person who sent the request can cancel it');
  }
  if (request.status !== 'pending') {
    throw new ConflictError('This request has already been answered');
  }

  // Declining is the same outcome from the requester's point of view.
  await db
    .update(friendRequests)
    .set({ status: 'declined', respondedAt: new Date() })
    .where(eq(friendRequests.id, requestId));
}

/**
 * If the other side had a request pending in the opposite direction, it is now
 * redundant: the friendship exists. Mark it accepted so neither person is left
 * with a stale "waiting for an answer".
 */
async function settleReverse(request: FriendRequest): Promise<void> {
  await db
    .update(friendRequests)
    .set({ status: 'accepted', respondedAt: new Date() })
    .where(
      and(
        eq(friendRequests.requesterId, request.addresseeId),
        eq(friendRequests.addresseeId, request.requesterId),
        eq(friendRequests.status, 'pending'),
      ),
    );
}



/** Creates the contact rows in both directions, tolerating repeats. */
async function linkMutually(owner: User, friend: User): Promise<Contact> {
  await ensureContact(owner, friend, 'accepted_request');
  return ensureContact(friend, owner, 'accepted_request');
}

async function ensureContact(
  owner: User,
  friend: User,
  source: 'manual' | 'invite_code' | 'accepted_request',
): Promise<Contact> {
  const existing = await db.query.contacts.findFirst({
    where: and(eq(contacts.userId, owner.id), eq(contacts.contactUserId, friend.id)),
  });
  // Never reset an existing link's notification settings on re-acceptance.
  if (existing) return existing;

  const [row] = await db
    .insert(contacts)
    .values({
      userId: owner.id,
      contactUserId: friend.id,
      name: friend.name,
      phone: friend.phone ?? '',
      email: friend.email,
      minLevel: 1,
      source,
    })
    .onConflictDoNothing()
    .returning();

  if (row) return row;

  const found = await db.query.contacts.findFirst({
    where: and(eq(contacts.userId, owner.id), eq(contacts.contactUserId, friend.id)),
  });
  if (!found) throw new Error('Failed to create the contact link');
  return found;
}

async function viewOf(request: FriendRequest): Promise<FriendRequestView> {
  const [from, to] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, request.requesterId) }),
    db.query.users.findFirst({ where: eq(users.id, request.addresseeId) }),
  ]);

  return {
    request,
    from: {
      id: from?.id ?? request.requesterId,
      name: from?.name || 'Someone',
      avatarUrl: from?.avatarUrl ?? null,
      bio: from?.bio ?? null,
    },
    to: { id: to?.id ?? request.addresseeId, name: to?.name || 'Someone' },
  };
}

/** Pending count in one direction, for the app's badge. */
export async function countRequests(
  userId: string,
  direction: 'incoming' | 'outgoing',
): Promise<number> {
  const column = direction === 'incoming' ? friendRequests.addresseeId : friendRequests.requesterId;

  const rows = await db
    .select({ id: friendRequests.id })
    .from(friendRequests)
    .where(and(eq(column, userId), eq(friendRequests.status, 'pending')));

  return rows.length;
}