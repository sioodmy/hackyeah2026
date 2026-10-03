import { z } from 'zod';

import type { AlertLevel } from './db/schema.js';

/**
 * Alert levels are a closed scale. The union is what makes the rest of the
 * codebase safe: services receive `1 | 2 | 3 | 4`, never a bare number.
 */
/**
 * Zod v4's multi-value literal emits a single `enum` in the OpenAPI document,
 * which a union of separate literals does not. Clients reading /docs see the
 * closed set directly instead of an `anyOf` of four branches.
 */
export const alertLevelSchema = z
  .literal([1, 2, 3, 4])
  .describe('1 uncomfortable, 2 unsafe, 3 danger, 4 omega');

export const alertStatusSchema = z.enum([
  'active',
  'acknowledged',
  'resolved',
  'cancelled',
  'escalated',
]);

/* ---------------------------------------------------------------- alerts -- */

export const createAlertBody = z.object({
  level: alertLevelSchema,
  message: z.string().trim().max(1000).optional().describe('What is happening, in her words'),
  lat: z.number().min(-90).max(90).optional().describe('Latitude of the sender'),
  lng: z.number().min(-180).max(180).optional().describe('Longitude of the sender'),
  address: z.string().max(500).optional().describe('Reverse-geocoded street address'),
});

export const alertIdParams = z.object({
  alertId: z.uuid().describe('Alert id'),
});

export const listAlertsQuerystring = z.object({
  status: alertStatusSchema.optional().describe('Filter by lifecycle state'),
  limit: z.coerce.number().int().min(1).max(200).default(50).describe('Max rows to return'),
});

/* -------------------------------------------------------------- invites -- */

export const createInviteBody = z.object({
  maxUses: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe('How many friends may use this code. Defaults to 1.'),
  ttlHours: z
    .number()
    .int()
    .min(1)
    .max(720)
    .optional()
    .describe('Hours until the code stops working. Defaults to 24.'),
  requiresApproval: z
    .boolean()
    .optional()
    .describe(
      'When true (default) the owner must accept each request before anything is shared. Set false to link immediately, for people who have already agreed offline.',
    ),
});

export const inviteCodeParams = z.object({
  codeId: z.uuid().describe('Invite code id, from the code you created'),
});

export const redeemInviteBody = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(512)
    .describe(
      'The bare code ("K7M2XPQ4"), the web link, or the deep link. People paste all three, so all three are accepted.',
    ),
  message: z
    .string()
    .trim()
    .max(280)
    .optional()
    .describe('Shown to the other person with the request, so they recognise you.'),
});

export const inviteLinkSchema = z.object({
  web: z.string().describe('Open in a browser. Paste into SMS, chat or email.'),
  deep: z
    .string()
    .describe('Opens the app directly. Use for the QR image on a phone.'),
  code: z.string(),
});

export const inviteCodeSchema = z.object({
  id: z.uuid(),
  code: z.string().describe('The short code, e.g. "K7M2XPQ4"'),
  maxUses: z.number(),
  usedCount: z.number(),
  requiresApproval: z
    .boolean()
    .describe('True when the owner must accept before anything is shared'),
  expiresAt: z.date(),
  revokedAt: z.date().nullable(),
  redeemable: z.boolean().describe('False once used up, expired or cancelled'),
  qrPayload: z.string().describe('Exactly what to encode in the QR image'),
  links: inviteLinkSchema,
});

/* ----------------------------------------------------------------- alerts -- */

export const alertSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  level: alertLevelSchema,
  message: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  address: z.string().nullable(),
  status: alertStatusSchema,
  acknowledgedByContactId: z.uuid().nullable(),
  acknowledgedAt: z.date().nullable(),
  resolvedAt: z.date().nullable(),
  escalatedFromId: z.uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const inboxAlertSchema = alertSchema.extend({
  sender_name: z.string(),
  sender_phone: z.string().nullable(),
});

/* -------------------------------------------------------------- contacts -- */

const contactFields = {
  name: z.string().trim().min(1).max(255),
  phone: z.string().trim().min(3).max(32),
  email: z.email().optional().describe('Links to an app account with the same address'),
  relationship: z.string().trim().max(64).optional(),
  isPrimary: z.boolean().optional().describe('Only one contact can be primary'),
  minLevel: alertLevelSchema
    .optional()
    .describe('Notify this contact from this level upwards'),
};

export const createContactBody = z.object(contactFields).extend({
  isPrimary: contactFields.isPrimary.default(false),
  minLevel: contactFields.minLevel.default(1),
});

/**
 * Defaults deliberately live only on the create schema: `.partial()` keeps
 * defaults, which would make an empty patch `{}` look like a valid update.
 */
export const updateContactBody = z
  .object(contactFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field is required',
  });

export const contactIdParams = z.object({
  contactId: z.uuid().describe('Contact id'),
});

export const contactSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  contactUserId: z.uuid().nullable(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  relationship: z.string().nullable(),
  isPrimary: z.boolean(),
  minLevel: z.number(),
  source: z
    .enum(['manual', 'invite_code', 'accepted_request'])
    .describe('How this contact was added'),
  nickname: z
    .string()
    .nullable()
    .describe('What you call them. Local only: never sent to them.'),
  notifyEmail: z
    .string()
    .nullable()
    .describe('Where danger alerts are emailed for this contact'),
  createdAt: z.date(),
});

/* -------------------------------------------------------------- friends -- */

export const friendParams = z.object({
  friendId: z.uuid().describe('The other user id'),
});

/** The slice of a profile a friend is allowed to see. */
export const publicProfileSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  bio: z.string().nullable(),
  emergencyNote: z
    .string()
    .nullable()
    .describe('Her own words: medical needs, who to call, anything vital'),
  phone: z.string().nullable(),
});

/** A friend link, as seen from one side: the contact row and who it points at. */
export const friendshipSchema = z.object({
  contact: contactSchema,
  friend: z.object({
    id: z.uuid(),
    name: z.string().describe('The local nickname if set, otherwise her real name'),
    realName: z.string().describe('Her actual name, for "Mamusia (Kasia)"'),
    phone: z.string().nullable(),
    profile: publicProfileSchema,
  }),
});

/** Per-contact settings: nickname, threshold, and the email for danger alerts. */
export const updateFriendBody = z
  .object({
    nickname: z
      .string()
      .trim()
      .max(64)
      .nullable()
      .optional()
      .describe('What you call her. Local only: never sent to her.'),
    minLevel: alertLevelSchema.optional().describe('Notify from this level upwards'),
    notifyEmail: z
      .email()
      .nullable()
      .optional()
      .describe('Where to email danger alerts (levels 3 and 4) for this contact'),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field is required',
  });

export const friendRequestStatusSchema = z.enum(['pending', 'accepted', 'declined']);

/** A pending invitation, with enough profile to recognise the sender. */
export const friendRequestSchema = z.object({
  request: z.object({
    id: z.uuid(),
    requesterId: z.uuid(),
    addresseeId: z.uuid(),
    status: friendRequestStatusSchema,
    message: z.string().nullable(),
    respondedAt: z.date().nullable(),
    createdAt: z.date(),
  }),
  from: z.object({
    id: z.uuid(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    bio: z.string().nullable(),
  }),
  to: z.object({ id: z.uuid(), name: z.string() }),
});

export const requestFriendSchema = z.object({
  request: friendRequestSchema,
  alreadyRequested: z
    .boolean()
    .describe('True when a request was already pending, so nothing was created'),
  status: friendRequestStatusSchema.describe(
    'pending until the owner accepts; "accepted" if they were already friends',
  ),
});

export const listRequestsQuery = z.object({
  direction: z
    .enum(['incoming', 'outgoing'])
    .default('incoming')
    .describe('incoming is the inbox to answer, outgoing is what you are waiting on'),
  status: friendRequestStatusSchema.default('pending'),
});

export const friendRequestIdParams = z.object({
  requestId: z.uuid().describe('Friend request id'),
});

/* --------------------------------------------------------------- devices -- */

export const registerDeviceBody = z.object({
  token: z.string().min(1).max(2048).describe('APNs or FCM device token'),
  platform: z.enum(['ios', 'android']),
});

export const deviceIdParams = z.object({
  deviceId: z.uuid().describe('Device id returned when registering'),
});

export const updateDeviceBody = z.object({
  isActive: z.boolean().describe('Set false to stop sending to this token'),
});

export const deviceSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  token: z.string(),
  platform: z.enum(['ios', 'android']),
  isActive: z.boolean(),
  lastSeenAt: z.date(),
  createdAt: z.date(),
});

/* ----------------------------------------------------------------- users -- */

export const updateProfileBody = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    phone: z.string().trim().min(3).max(32).optional(),
    pushEnabled: z.boolean().optional(),
    bio: z
      .string()
      .trim()
      .max(280)
      .nullable()
      .optional()
      .describe('A line about you, shown on friend requests so people recognise you'),
    emergencyNote: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional()
      .describe(
        'Shown to friends when an alert reaches them: medical needs, who to call, anything vital when there is no time to ask.',
      ),
    shareProfileWithFriends: z
      .boolean()
      .optional()
      .describe('Set false to hide your bio and emergency note from friends'),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field is required',
  });

export const userSchema = z.object({
  id: z.uuid(),
  clerkId: z.string(),
  email: z.string().nullable(),
  name: z.string(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  pushEnabled: z.boolean(),
  bio: z.string().nullable(),
  emergencyNote: z.string().nullable(),
  shareProfileWithFriends: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/* --------------------------------------------------------------- errors -- */

export const errorSchema = z.object({
  error: z.object({
    code: z.string().describe('Stable machine-readable code'),
    message: z.string(),
  }),
});

/** Guards the level union if this file is ever edited by hand. */
export const _levelTypecheck: AlertLevel = 4;