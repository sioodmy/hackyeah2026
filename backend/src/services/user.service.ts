import { eq } from 'drizzle-orm';

import type { ClerkClaims } from '../core/clerk.js';
import { displayNameFromClaims } from '../core/clerk.js';
import { db } from '../db/client.js';
import { users, type User } from '../db/schema.js';

export interface SyncedUser {
  user: User;
  created: boolean;
}

/**
 * Clerk is the source of truth for identity; this table is our local mirror.
 * Called on every authenticated request, so an existing row is only patched.
 */
export async function upsertFromClerk(claims: ClerkClaims): Promise<SyncedUser> {
  const existing = await db.query.users.findFirst({ where: eq(users.clerkId, claims.sub) });

  const values = {
    email: claims.email ?? null,
    name: displayNameFromClaims(claims),
    phone: claims.phone_number ?? null,
    avatarUrl: claims.picture ?? null,
  };

  if (!existing) {
    const [row] = await db.insert(users).values({ clerkId: claims.sub, ...values }).returning();
    return { user: row!, created: true };
  }

  const [row] = await db
    .update(users)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(users.id, existing.id))
    .returning();

  return { user: row!, created: false };
}

export async function findById(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

export async function findByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

export async function updateProfile(
  id: string,
  changes: Partial<
    Pick<
      User,
      | 'name'
      | 'phone'
      | 'pushEnabled'
      | 'bio'
      | 'emergencyNote'
      | 'shareProfileWithFriends'
    >
  >,
): Promise<User> {
  const [row] = await db
    .update(users)
    .set({ ...changes, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return row!;
}