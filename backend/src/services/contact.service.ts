import { and, asc, desc, eq } from 'drizzle-orm';

import { NotFoundError } from '../core/errors.js';
import { db } from '../db/client.js';
import { contacts, users, type AlertLevel, type Contact } from '../db/schema.js';

export interface ContactInput {
  name: string;
  phone: string;
  email?: string | null;
  relationship?: string | null;
  isPrimary?: boolean;
  minLevel?: number;
}

export async function listContacts(userId: string): Promise<Contact[]> {
  return db.query.contacts.findMany({
    where: eq(contacts.userId, userId),
    orderBy: [desc(contacts.isPrimary), asc(contacts.createdAt)],
  });
}

export async function createContact(userId: string, input: ContactInput): Promise<Contact> {
  if (input.isPrimary) await clearPrimary(userId);

  // If the contact already uses the app we link the account, which is what
  // makes push delivery possible.
  const contactUserId = input.email
    ? await findUserIdByEmail(input.email)
    : undefined;

  const [row] = await db
    .insert(contacts)
    .values({
      userId,
      name: input.name,
      phone: input.phone,
      email: input.email ?? null,
      relationship: input.relationship ?? null,
      isPrimary: input.isPrimary ?? false,
      minLevel: input.minLevel ?? 1,
      contactUserId: contactUserId ?? null,
    })
    .returning();

  return row!;
}

export async function updateContact(
  userId: string,
  contactId: string,
  changes: Partial<ContactInput>,
): Promise<Contact> {
  const existing = await findOwned(userId, contactId);
  if (changes.isPrimary) await clearPrimary(userId);

  const [row] = await db
    .update(contacts)
    .set({
      ...(changes.name !== undefined && { name: changes.name }),
      ...(changes.phone !== undefined && { phone: changes.phone }),
      ...(changes.email !== undefined && { email: changes.email }),
      ...(changes.relationship !== undefined && { relationship: changes.relationship }),
      ...(changes.isPrimary !== undefined && { isPrimary: changes.isPrimary }),
      ...(changes.minLevel !== undefined && { minLevel: changes.minLevel }),
    })
    .where(eq(contacts.id, existing.id))
    .returning();

  return row!;
}

export async function deleteContact(userId: string, contactId: string): Promise<void> {
  const existing = await findOwned(userId, contactId);
  await db.delete(contacts).where(eq(contacts.id, existing.id));
}

export async function findOwned(userId: string, contactId: string): Promise<Contact> {
  const row = await db.query.contacts.findFirst({
    where: and(eq(contacts.id, contactId), eq(contacts.userId, userId)),
  });
  if (!row) throw new NotFoundError('Contact not found');
  return row;
}

/** Contacts of `userId` that should be told about an alert of this level. */
export async function contactsToNotify(userId: string, level: AlertLevel): Promise<Contact[]> {
  const all = await db.query.contacts.findMany({ where: eq(contacts.userId, userId) });
  return all.filter((contact) => contact.minLevel <= level);
}

/** The contact row linking `ownerId`'s alert list to `recipientId`. */
export async function findBetween(
  ownerId: string,
  recipientId: string,
): Promise<Contact | undefined> {
  return db.query.contacts.findFirst({
    where: and(
      eq(contacts.userId, ownerId),
      eq(contacts.contactUserId, recipientId),
    ),
  });
}

/** Every contact entry across all owners pointing at this user. */
export async function linksForUser(recipientId: string): Promise<Contact[]> {
  return db.query.contacts.findMany({ where: eq(contacts.contactUserId, recipientId) });
}

async function findUserIdByEmail(email: string): Promise<string | undefined> {
  const row = await db.query.users.findFirst({ where: eq(users.email, email) });
  return row?.id;
}

async function clearPrimary(userId: string): Promise<void> {
  await db
    .update(contacts)
    .set({ isPrimary: false })
    .where(and(eq(contacts.userId, userId), eq(contacts.isPrimary, true)));
}