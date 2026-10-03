import {
  boolean,
  index,
  pgEnum,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Alert severity. The numbers are the wire format the mobile app sends and
 * receives, so they must stay stable:
 *   1 uncomfortable - call me / give me a reason to leave
 *   2 unsafe       - I do not feel safe
 *   3 danger       - someone is following me
 *   4 omega        - I am in immediate danger of being attacked
 */
export const ALERT_LEVELS = [1, 2, 3, 4] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export const ALERT_LEVEL_NAMES = {
  1: 'uncomfortable',
  2: 'unsafe',
  3: 'danger',
  4: 'omega',
} as const satisfies Record<AlertLevel, string>;

export const OMEGA: AlertLevel = 4;

export const ALERT_STATUSES = [
  'active',
  'acknowledged',
  'resolved',
  'cancelled',
  'escalated',
] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const alertStatusEnum = pgEnum('alert_status', ALERT_STATUSES);

export const platformEnum = pgEnum('device_platform', ['ios', 'android']);

/** How a contact link came to exist. */
export const contactSourceEnum = pgEnum('contact_source', [
  'manual',
  'invite_code',
  'accepted_request',
]);

export const FRIEND_REQUEST_STATUSES = ['pending', 'accepted', 'declined'] as const;
export type FriendRequestStatus = (typeof FRIEND_REQUEST_STATUSES)[number];

export const friendRequestStatusEnum = pgEnum(
  'friend_request_status',
  FRIEND_REQUEST_STATUSES,
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clerkId: varchar('clerk_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 320 }),
    name: varchar('name', { length: 255 }).notNull().default(''),
    phone: varchar('phone', { length: 32 }),
    avatarUrl: text('avatar_url'),
    pushEnabled: boolean('push_enabled').notNull().default(true),

    /** Shown on friend requests so the other person knows who is asking. */
    bio: varchar('bio', { length: 280 }),
    /**
     * Free-text note a friend sees when an alert reaches them: medical needs,
     * who to call, where she usually is. This is the "profile" a contact gets
     * at the moment it matters, when there is no time to ask.
     */
    emergencyNote: text('emergency_note'),

    /**
     * Who may see this profile. An emergency contact arguably should get the
     * note without anyone having to toggle it, so this defaults to visible.
     */
    shareProfileWithFriends: boolean('share_profile_with_friends').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_clerk_id_idx').on(table.clerkId)],
);

export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Set when the contact also has an account, so we can push to them. */
    contactUserId: uuid('contact_user_id').references(() => users.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 32 }).notNull(),
    email: varchar('email', { length: 320 }),
    relationship: varchar('relationship', { length: 64 }),
    isPrimary: boolean('is_primary').notNull().default(false),
    /** Notify this contact from this level upwards. */
    minLevel: smallint('min_level').notNull().default(1),
    /** How the link was made: typed in by hand, via a code, or by accepting. */
    source: contactSourceEnum('source').notNull().default('manual'),
    /**
     * What the owner calls this person, locally: "Mamusia", "Kasia", "Tata".
     * Never sent to the other person, so it cannot leak between them.
     */
    nickname: varchar('nickname', { length: 64 }),
    /**
     * Where to send a danger alert when the phone is off. A push needs the app;
     * an email reaches a switched-off phone through the carrier's network.
     */
    notifyEmail: varchar('notify_email', { length: 320 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('contacts_user_id_idx').on(table.userId),
    // One entry per pair: redeeming the same code twice cannot double up.
    uniqueIndex('contacts_pair_idx').on(table.userId, table.contactUserId),
  ],
);

/**
 * Short codes, shown as a QR code, that let one person add another as a friend.
 *
 * The code is the credential, so it is single-use by default and expires: a
 * screenshot of a QR code should not stay useful forever.
 */

/**
 * A pending invitation between two accounts.
 *
 * Scanning a code no longer links people immediately: it files a request, and
 * nothing is shared until the other person accepts. That matters because an
 * invite is also a request to see someone's live location during an emergency.
 */
export const friendRequests = pgTable(
  'friend_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Who scanned the code and wants in. */
    requesterId: uuid('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Who owns the code and must decide. */
    addresseeId: uuid('addressee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: friendRequestStatusEnum('status').notNull().default('pending'),
    /** The code it came from, so usage stays accounted for. */
    inviteCodeId: uuid('invite_code_id').references(() => inviteCodes.id, {
      onDelete: 'set null',
    }),
    /** Shown to the addressee so they recognise who is asking. */
    message: varchar('message', { length: 280 }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('friend_requests_addressee_idx').on(table.addresseeId, table.status),
    index('friend_requests_requester_idx').on(table.requesterId, table.status),
    // One live request per direction per pair: re-scanning cannot flood
    // someone with identical requests.
    uniqueIndex('friend_requests_pending_idx').on(
      table.requesterId,
      table.addresseeId,
      table.status,
    ),
  ],
);

export const inviteCodes = pgTable(
  'invite_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Whoever shows the QR code and receives the alerts. */
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 16 }).notNull(),
    /** How many people may redeem it. One QR per friend is the usual case. */
    maxUses: smallint('max_uses').notNull().default(1),
    usedCount: smallint('used_count').notNull().default(0),
    /**
     * Consuming a slot on scan, but the link only exists once accepted. The
     * code is spent either way so a shared screenshot cannot be replayed.
     */
    requiresApproval: boolean('requires_approval').notNull().default(true),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('invite_codes_code_idx').on(table.code),
    index('invite_codes_owner_idx').on(table.ownerId),
  ],
);

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    platform: platformEnum('platform').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('devices_token_idx').on(table.token)],
);

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Stored as a smallint; the union keeps callers from passing a bare number.
    level: smallint('level').$type<AlertLevel>().notNull(),
    message: text('message'),
    lat: real('lat'),
    lng: real('lng'),
    address: varchar('address', { length: 500 }),
    status: alertStatusEnum('status').notNull().default('active'),
    acknowledgedByContactId: uuid('acknowledged_by_contact_id').references(() => contacts.id, {
      onDelete: 'set null',
    }),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    escalatedFromId: uuid('escalated_from_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('alerts_user_id_created_at_idx').on(table.userId, table.createdAt),
    index('alerts_status_idx').on(table.status),
    index('alerts_contact_user_idx').on(table.userId, table.level),
  ],
);

/** Levels at or above which a notification must break through do-not-disturb. */
export function isCritical(level: AlertLevel): boolean {
  return level >= 3;
}

export function alertLevelName(level: AlertLevel): string {
  return ALERT_LEVEL_NAMES[level];
}

export function notificationPriority(level: AlertLevel): 'normal' | 'high' | 'critical' {
  if (level === 4) return 'critical';
  if (level >= 2) return 'high';
  return 'normal';
}



export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Device = typeof devices.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type InviteCode = typeof inviteCodes.$inferSelect;
export type FriendRequest = typeof friendRequests.$inferSelect;

/**
 * Levels that also go out by email.
 *
 * Push needs the app awake; an email reaches a phone that is switched off,
 * which is exactly the case where an alert matters most and push is useless.
 */
export const EMAIL_ALERT_LEVELS: ReadonlySet<AlertLevel> = new Set([3, 4]);