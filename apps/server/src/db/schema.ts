import { relations } from "drizzle-orm";
import {
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const friendStatus = pgEnum("friend_status", [
  "pending",
  "accepted",
  "blocked",
]);
export const alertStatus = pgEnum("alert_status", [
  "active",
  "escalated",
  "resolved",
  "cancelled",
]);
export const platformEnum = pgEnum("device_platform", ["ios", "android"]);
export const providerEnum = pgEnum("device_provider", ["expo", "fcm", "apns"]);

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull().default("Anonimowa"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_display_name_idx").on(table.displayName)],
);

export const friendships = pgTable(
  "friendships",
  {
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    friendId: text("friend_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: friendStatus("status").notNull().default("accepted"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.ownerId, table.friendId] }),
    index("friendships_friend_idx").on(table.friendId),
  ],
);

export const inviteCodes = pgTable(
  "invite_codes",
  {
    code: text("code").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: text("used_by").references(() => users.id, {
      onDelete: "set null",
    }),
  },
  (table) => [index("invite_codes_user_idx").on(table.userId)],
);

export const locations = pgTable("locations", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  accuracy: real("accuracy"),
  heading: real("heading"),
  speed: real("speed"),
  batteryLevel: real("battery_level"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const alerts = pgTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    level: integer("level").notNull().default(1),
    status: alertStatus("status").notNull().default("active"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    place: text("place"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    dispatchReference: text("dispatch_reference"),
  },
  (table) => [
    index("alerts_user_created_idx").on(table.userId, table.createdAt),
  ],
);

export const alertRecipients = pgTable(
  "alert_recipients",
  {
    id: text("id").primaryKey(),
    alertId: text("alert_id")
      .notNull()
      .references(() => alerts.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: text("channel").notNull().default("realtime"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    readAt: timestamp("read_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("alert_recipients_unique_idx").on(table.alertId, table.userId),
    index("alert_recipients_user_idx").on(table.userId),
  ],
);

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: platformEnum("platform").notNull(),
    provider: providerEnum("provider").notNull().default("expo"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("device_tokens_token_idx").on(table.token)],
);

export const usersRelations = relations(users, ({ many }) => ({
  friends: many(friendships, { relationName: "owner" }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  owner: one(users, {
    fields: [friendships.ownerId],
    references: [users.id],
    relationName: "owner",
  }),
  friend: one(users, {
    fields: [friendships.friendId],
    references: [users.id],
    relationName: "friend",
  }),
}));

export type UserRow = typeof users.$inferSelect;
export type AlertRow = typeof alerts.$inferSelect;
export type LocationRow = typeof locations.$inferSelect;
