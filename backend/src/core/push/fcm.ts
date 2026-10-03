import { SignJWT, importPKCS8 } from 'jose';

import { env } from '../../config/env.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

type SigningKey = Awaited<ReturnType<typeof importPKCS8>>;

let cachedKey: Promise<SigningKey> | null = null;
let cachedAccess: { value: string; issuedAt: number } | null = null;

async function signingKey(): Promise<SigningKey> {
  const pem = env.FCM_PRIVATE_KEY;
  if (!pem) throw new Error('FCM_PRIVATE_KEY is not configured');
  cachedKey ??= importPKCS8(pem.replace(/\\n/g, '\n'), 'RS256');
  return cachedKey;
}

/** FCM HTTP v1 wants a short-lived OAuth2 access token signed by a service account. */
async function accessToken(): Promise<string> {
  if (cachedAccess && Date.now() - cachedAccess.issuedAt < 50 * 60_000) {
    return cachedAccess.value;
  }
  if (!env.FCM_PROJECT_ID || !env.FCM_CLIENT_EMAIL) {
    throw new Error('FCM_PROJECT_ID and FCM_CLIENT_EMAIL are required for FCM');
  }

  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(env.FCM_CLIENT_EMAIL)
    .setSubject(env.FCM_CLIENT_EMAIL)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(await signingKey());

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`FCM token exchange failed: ${response.status} ${await response.text()}`);
  }

  const body = (await response.json()) as { access_token: string };
  cachedAccess = { value: body.access_token, issuedAt: Date.now() };
  return body.access_token;
}

export interface FcmResult {
  delivered: boolean;
  tokenInvalid: boolean;
}

export async function sendFcm(
  token: string,
  payload: Record<string, unknown>,
  critical: boolean,
): Promise<FcmResult> {
  if (!env.FCM_PROJECT_ID) return { delivered: false, tokenInvalid: false };

  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${await accessToken()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        // FCM data values must be strings.
        data: Object.fromEntries(
          Object.entries(payload).map(([key, value]) => [
            key,
            typeof value === 'string' ? value : JSON.stringify(value ?? null),
          ]),
        ),
        android: {
          priority: critical ? 'HIGH' : 'NORMAL',
          notification: {
            title: String(payload.title ?? ''),
            body: String(payload.body ?? ''),
            sound: critical ? 'critical' : 'default',
            channel_id: critical ? 'alerts_critical' : 'alerts',
            priority: critical ? 'PRIORITY_MAX' : 'PRIORITY_DEFAULT',
            notification_priority: critical ? 'MAX' : 'DEFAULT',
          },
        },
        apns: {
          headers: { 'apns-priority': critical ? '10' : '5' },
          payload: {
            aps: {
              sound: critical ? 'critical.caf' : 'default',
              interruptionLevel: critical ? 'time-sensitive' : 'active',
              category: critical ? 'ALERT_CRITICAL' : 'ALERT',
            },
          },
        },
      },
    }),
  });

  if (response.ok) return { delivered: true, tokenInvalid: false };
  if (response.status === 404) return { delivered: false, tokenInvalid: true };

  // 401/403 means our access token is stale; let the next send refresh it.
  return { delivered: false, tokenInvalid: false };
}