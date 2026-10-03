import 'dotenv/config';

import { userInfo } from 'node:os';
import { z } from 'zod';

// An empty value means "not set": .env files routinely carry `KEY=` for
// optional variables, and that must fall through to the default rather than
// fail enum validation. Without this, `cp .env.example .env` would not boot.
const optionalText = z
  .string()
  .optional()
  .transform((value) => (value && value.trim() ? value.trim() : undefined));

const optionalUrl = optionalText.pipe(z.url().optional());
const optionalEmail = optionalText.pipe(z.email().optional());

const enumWithDefault = <T extends string>(values: readonly T[], fallback: T) =>
  optionalText.pipe(z.enum(values).default(fallback));

const schema = z
  .object({
    NODE_ENV: enumWithDefault(
      ['development', 'test', 'production'] as const,
      'development',
    ),
    LOG_LEVEL: enumWithDefault(
      ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const,
      'info',
    ),
    PORT: z.coerce.number().int().positive().default(3000),
    API_PREFIX: z.string().default('/api/v1'),

    // Local Postgres runs under your own macOS role over a Unix socket, so the
  // default needs no credentials. Set DATABASE_URL in .env to override.
    DATABASE_URL: z
      .string()
      .min(1)
      .default(() => `postgresql://${encodeURIComponent(userInfo().username)}@/safety?host=/tmp`),

    CLERK_JWKS_URL: z.url(),
    CLERK_ISSUER: optionalUrl,

    FCM_PROJECT_ID: optionalText,
    FCM_CLIENT_EMAIL: optionalEmail,
    FCM_PRIVATE_KEY: optionalText,

    APNS_KEY_ID: optionalText,
    APNS_TEAM_ID: optionalText,
    APNS_BUNDLE_ID: z.string().default('com.example.safety'),
    APNS_PRIVATE_KEY: optionalText,
    APNS_USE_SANDBOX: optionalText
      .transform((value) => value === undefined || value === 'true')
      .default(true),

    /** Public base URL, used to build the QR payload an invite scan resolves to. */
    PUBLIC_BASE_URL: optionalText.pipe(z.url().optional()),

    /** Custom scheme the mobile app registers, for invite deep links. */
    APP_LINK_SCHEME: optionalText.default('safetyapp'),

    /* Email, for danger alerts that reach a phone with no push connection. */
    SMTP_HOST: optionalText,
    SMTP_PORT: optionalText,
    SMTP_USER: optionalText,
    SMTP_PASSWORD: optionalText,
    EMAIL_FROM: optionalText,

    ESCALATE_UNSAFE_AFTER_MINUTES: z.coerce.number().int().positive().default(15),
    ESCALATE_DANGER_AFTER_MINUTES: z.coerce.number().int().positive().default(5),
    CANCEL_WINDOW_SECONDS: z.coerce.number().int().positive().default(30),

    EMERGENCY_WEBHOOK_URL: optionalUrl,
    EMERGENCY_WEBHOOK_SECRET: optionalText,
  })
  // Either a provider is fully configured or not at all: half-set credentials
  // would fail later, at the first push, instead of here at boot.
  .refine(
    (value) =>
      [value.FCM_PROJECT_ID, value.FCM_CLIENT_EMAIL, value.FCM_PRIVATE_KEY].filter(Boolean)
        .length % 3 === 0,
    { message: 'FCM_PROJECT_ID, FCM_CLIENT_EMAIL and FCM_PRIVATE_KEY must be set together' },
  )
  .refine(
    (value) =>
      [value.APNS_KEY_ID, value.APNS_TEAM_ID, value.APNS_PRIVATE_KEY].filter(Boolean).length % 3 ===
      0,
    { message: 'APNS_KEY_ID, APNS_TEAM_ID and APNS_PRIVATE_KEY must be set together' },
  );

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => {
    const path = issue.path.join('.') || 'environment';
    return `  - ${path}: ${issue.message}`;
  });
  throw new Error(`Invalid environment configuration:\n${issues.join('\n')}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';

/** True when a provider has enough credentials to attempt delivery. */
export const apnsConfigured = Boolean(env.APNS_PRIVATE_KEY);
export const fcmConfigured = Boolean(env.FCM_PROJECT_ID && env.FCM_PRIVATE_KEY);