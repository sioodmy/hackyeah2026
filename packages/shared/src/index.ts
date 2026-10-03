import { z } from "zod";

/**
 * Threat level of the in-app slider.
 *
 * 0 - idle, the default resting position. Nothing is broadcast.
 * 1 - "I need an excuse to leave". Starts a decoy incoming call after a short
 *     timeout. No one is notified.
 * 2 - "I am not safe". Same decoy call, plus every friend is notified with a
 *     location and an instruction to call me immediately.
 * 3 - "full alert". Friends get a loud full-screen alert, and the public
 *     services are notified through the dispatch endpoint.
 */
export const MAX_THREAT_LEVEL = 3;

/** Levels that actually dispatch something. */
export const ACTIVE_THREAT_LEVELS = [1, 2, 3] as const;
export type ActiveThreatLevel = (typeof ACTIVE_THREAT_LEVELS)[number];

export const threatLevelSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type ThreatLevel = z.infer<typeof threatLevelSchema>;

export const activeThreatLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type ActiveThreatLevelSchema = z.infer<typeof activeThreatLevelSchema>;

export function isActiveThreatLevel(
  level: ThreatLevel,
): level is ActiveThreatLevel {
  return level >= 1;
}

/** Human readable label, used by the UI and by the dispatch payload. */
export const THREAT_LEVEL_LABEL: Record<ThreatLevel, string> = {
  0: "Bezpiecznie",
  1: "Potrzebuję pretekstu",
  2: "Jestem w niebezpieczeństwie",
  3: "Pełny alarm",
};

/** Accent colour per level. Kept here so the server can log/publish it too. */
export const THREAT_LEVEL_COLOR: Record<ThreatLevel, string> = {
  0: "#8A8F98",
  1: "#E8B931",
  2: "#F2751A",
  3: "#E01E37",
};

export const ALERT_STATUS = [
  "active",
  "escalated",
  "resolved",
  "cancelled",
] as const;
export const alertStatusSchema = z.enum(ALERT_STATUS);
export type AlertStatus = z.infer<typeof alertStatusSchema>;

// ---------------------------------------------------------------------------
// Geolocation
// ---------------------------------------------------------------------------

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

export const locationUpdateSchema = geoPointSchema.extend({
  accuracy: z.number().nonnegative().nullish(),
  heading: z.number().min(0).max(360).nullish(),
  speed: z.number().nullish(),
  batteryLevel: z.number().min(0).max(1).nullish(),
  recordedAt: z.number().int().nonnegative().optional(),
});
export type LocationUpdate = z.infer<typeof locationUpdateSchema>;

/** A friend as exposed to the map screen. */
export const contactSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullish(),
  lastSeenAt: z.string().datetime().nullish(),
  location: geoPointSchema
    .extend({
      accuracy: z.number().nullish(),
      heading: z.number().nullish(),
      updatedAt: z.string().datetime(),
    })
    .nullish(),
});
export type Contact = z.infer<typeof contactSchema>;

export const contactListSchema = z.array(contactSchema);

// ---------------------------------------------------------------------------
// Friends / QR handshake
// ---------------------------------------------------------------------------

export const FRIEND_STATUS = ["pending", "accepted", "blocked"] as const;
export const friendStatusSchema = z.enum(FRIEND_STATUS);
export type FriendStatus = z.infer<typeof friendStatusSchema>;

/**
 * Payload encoded in the invite QR code.
 *
 * Versioned and signed by the server so that a scanned code can be validated
 * offline before hitting the API. `sig` is an HMAC-SHA256 of the compact JSON
 * body, base64url encoded, keyed with the server's INVITE_SIGNING_SECRET.
 */
export const inviteCodePayloadSchema = z.object({
  v: z.literal(1),
  code: z.string().min(6).max(64),
  userId: z.string(),
  displayName: z.string(),
  iss: z.string(),
  exp: z.number().int().positive(),
  sig: z.string(),
});
export type InviteCodePayload = z.infer<typeof inviteCodePayloadSchema>;

export const createInviteRequestSchema = z.object({
  ttlSeconds: z
    .number()
    .int()
    .min(30)
    .max(24 * 60 * 60)
    .optional(),
});
export type CreateInviteRequest = z.infer<typeof createInviteRequestSchema>;

export const createInviteResponseSchema = z.object({
  code: z.string(),
  displayName: z.string(),
  expiresAt: z.string().datetime(),
  /** Compact string to render as a QR code. */
  payload: inviteCodePayloadSchema,
});
export type CreateInviteResponse = z.infer<typeof createInviteResponseSchema>;

export const redeemInviteRequestSchema = z.object({
  code: z.string().min(6).max(64),
});
export type RedeemInviteRequest = z.infer<typeof redeemInviteRequestSchema>;

export const redeemInviteResponseSchema = z.object({
  contact: contactSchema,
});
export type RedeemInviteResponse = z.infer<typeof redeemInviteResponseSchema>;

export const removeFriendRequestSchema = z.object({
  contactId: z.string(),
});
export type RemoveFriendRequest = z.infer<typeof removeFriendRequestSchema>;

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const raiseAlertRequestSchema = z.object({
  level: activeThreatLevelSchema,
  location: geoPointSchema.nullish(),
  accuracy: z.number().nonnegative().nullish(),
  place: z.string().max(200).nullish(),
  note: z.string().max(500).nullish(),
  /** Set on escalation so the same alert row is reused. */
  alertId: z.string().optional(),
});
export type RaiseAlertRequest = z.infer<typeof raiseAlertRequestSchema>;

export const updateAlertRequestSchema = z.object({
  level: threatLevelSchema.optional(),
  status: alertStatusSchema.optional(),
  note: z.string().max(500).nullish(),
});
export type UpdateAlertRequest = z.infer<typeof updateAlertRequestSchema>;

export const alertSchema = z.object({
  id: z.string(),
  level: threatLevelSchema,
  status: alertStatusSchema,
  location: geoPointSchema.nullish(),
  place: z.string().nullish(),
  note: z.string().nullish(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullish(),
  /** Set once the mock services endpoint has accepted the alert. */
  dispatchedAt: z.string().datetime().nullish(),
  dispatchReference: z.string().nullish(),
});
export type Alert = z.infer<typeof alertSchema>;

export const alertListSchema = z.array(alertSchema);

export const raiseAlertResponseSchema = z.object({
  alert: alertSchema,
  notifiedCount: z.number().int().nonnegative(),
});
export type RaiseAlertResponse = z.infer<typeof raiseAlertResponseSchema>;

// ---------------------------------------------------------------------------
// Mock dispatch (stand-in for the real emergency services integration)
// ---------------------------------------------------------------------------

export const SERVICE_KIND = ["police", "ambulance", "fire"] as const;
export const serviceKindSchema = z.enum(SERVICE_KIND);
export type ServiceKind = z.infer<typeof serviceKindSchema>;

export const dispatchRequestSchema = z.object({
  service: serviceKindSchema.default("police"),
  alertId: z.string().optional(),
  location: geoPointSchema,
  accuracy: z.number().nonnegative().nullish(),
  place: z.string().max(200).nullish(),
  note: z.string().max(500).nullish(),
  level: threatLevelSchema,
  contactPhone: z.string().max(40).nullish(),
});
export type DispatchRequest = z.infer<typeof dispatchRequestSchema>;

export const dispatchResponseSchema = z.object({
  reference: z.string(),
  service: serviceKindSchema,
  receivedAt: z.string().datetime(),
  etaMinutes: z.number().int().nonnegative(),
  /** Fake operator log line, surfaced in the app for the demo. */
  transcript: z.string(),
});
export type DispatchResponse = z.infer<typeof dispatchResponseSchema>;

// ---------------------------------------------------------------------------
// Push device registration
// ---------------------------------------------------------------------------

export const registerDeviceRequestSchema = z.object({
  token: z.string().min(8),
  platform: z.enum(["ios", "android"]),
  provider: z.enum(["expo", "fcm", "apns"]).default("expo"),
});
export type RegisterDeviceRequest = z.infer<typeof registerDeviceRequestSchema>;

// ---------------------------------------------------------------------------
// Realtime channel
// ---------------------------------------------------------------------------

export const WsServerEvent = {
  /** Server -> client. Authoritative friend locations. */
  Locations: "locations",
  /** Server -> client. Somebody I care about raised / escalated an alert. */
  Alert: "alert",
  /** Server -> client. Somebody I care about stood down. */
  AlertCleared: "alert:cleared",
  /** Server -> client. Friend request accepted / friendship changed. */
  ContactUpsert: "contact:upsert",
  /** Server -> client. Emitted to every online client in the demo. */
  DispatchAck: "dispatch:ack",
  /** Server -> client. A decoy incoming call, triggered by level 1/2. */
  DecoyCall: "decoy:call",
} as const;
export type WsServerEvent = (typeof WsServerEvent)[keyof typeof WsServerEvent];

export const WsClientEvent = {
  /** Client -> server. Location heartbeat, roughly every 5 s while visible. */
  LocationPing: "location:ping",
  /** Client -> server. Keepalive. */
  Ping: "ping",
} as const;
export type WsClientEvent = (typeof WsClientEvent)[keyof typeof WsClientEvent];

export interface WsEnvelope<T = unknown> {
  type: string;
  /** Monotonic per-connection counter, echoed back by the client. */
  seq?: number;
  at: string;
  payload: T;
}

export interface LocationsWsPayload {
  contacts: Contact[];
}

export interface AlertWsPayload {
  alert: Alert;
  contact: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  /** Level 3 only: services have been notified. */
  dispatched: boolean;
  /** Level >= 2: friends should call the person immediately. */
  callMe: boolean;
}

export interface AlertClearedWsPayload {
  alertId: string;
  contactId: string;
  displayName: string;
}

export interface DecoyCallWsPayload {
  /** Opaque id the receiving client uses to render a fake incoming call. */
  callId: string;
  callerName: string;
  callerNumber: string;
  reason: "decoy" | "alert";
  /** Level that triggered the decoy call. */
  level: ThreatLevel;
}

export interface DispatchAckWsPayload extends DispatchResponse {}
