import { eq } from "drizzle-orm";

import type { ClerkClaims } from "../core/clerk.js";
import { displayNameFromClaims } from "../core/clerk.js";
import { db } from "../db/client.js";
import { users, type User } from "../db/schema.js";

export interface SyncedUser {
  user: User;
  created: boolean;
}

/**
 * Clerk is the source of truth for identity; this table is our local mirror.
 * Called on every authenticated request, so an existing row is only patched.
 * Atomic upsert via PostgreSQL ON CONFLICT prevents race conditions on parallel requests.
 */
export async function upsertFromClerk(
  claims: ClerkClaims,
): Promise<SyncedUser> {
  const values = {
    email: claims.email ?? null,
    name: displayNameFromClaims(claims),
    phone: claims.phone_number ?? null,
    avatarUrl: claims.picture ?? null,
  };

  const [row] = await db
    .insert(users)
    .values({ clerkId: claims.sub, ...values })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { ...values, updatedAt: new Date() },
    })
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
  patch: {
    name?: string;
    phone?: string | null;
    bio?: string | null;
    emergencyNote?: string | null;
    shareProfileWithFriends?: boolean;
    pushEnabled?: boolean;
  },
): Promise<User | undefined> {
  const [row] = await db
    .update(users)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  return row;
}
