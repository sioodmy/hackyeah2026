import { SignJWT, importPKCS8 } from "jose";

import { env } from "../../config/env.js";

const PRODUCTION_HOST = "https://api.push.apple.com";
const SANDBOX_HOST = "https://api.sandbox.push.apple.com";

type SigningKey = Awaited<ReturnType<typeof importPKCS8>>;

let cachedKey: Promise<SigningKey> | null = null;
let cachedToken: { value: string; issuedAt: number } | null = null;

async function signingKey(): Promise<SigningKey> {
  const pem = env.APNS_PRIVATE_KEY;
  if (!pem) throw new Error("APNS_PRIVATE_KEY is not configured");
  cachedKey ??= importPKCS8(pem.replace(/\\n/g, "\n"), "ES256");
  return cachedKey;
}

/** APNs provider tokens are valid for an hour; we refresh well before that. */
async function providerToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.issuedAt < 50 * 60_000) {
    return cachedToken.value;
  }
  if (!env.APNS_KEY_ID || !env.APNS_TEAM_ID) {
    throw new Error("APNS_KEY_ID and APNS_TEAM_ID are required for APNs");
  }

  const value = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.APNS_KEY_ID })
    .setIssuedAt()
    .setIssuer(env.APNS_TEAM_ID)
    .sign(await signingKey());

  cachedToken = { value, issuedAt: Date.now() };
  return value;
}

export interface ApnsResult {
  delivered: boolean;
  /** Token is permanently dead and should be deactivated. */
  tokenInvalid: boolean;
}

export async function sendApns(
  token: string,
  payload: Record<string, unknown>,
  critical: boolean,
): Promise<ApnsResult> {
  const host = env.APNS_USE_SANDBOX ? SANDBOX_HOST : PRODUCTION_HOST;
  const authorization = `bearer ${await providerToken()}`;

  const response = await fetch(`${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
      // 10 = deliver immediately, 5 = power considerations allowed.
      "apns-priority": critical ? "10" : "5",
      "apns-push-type": "alert",
      "apns-expiration": "0",
    },
    body: JSON.stringify({
      aps: {
        alert: {
          title: String(payload.title ?? ""),
          body: String(payload.body ?? ""),
        },
        sound: critical ? "critical.caf" : "default",
        // Lets the phone ring over silent mode and Do Not Disturb.
        interruptionLevel: critical ? "time-sensitive" : "active",
        category: critical ? "ALERT_CRITICAL" : "ALERT",
        "thread-id": payload.alert_id,
        ...(critical ? { "relevance-score": 1 } : {}),
      },
      ...payload,
    }),
  });

  if (response.ok) return { delivered: true, tokenInvalid: false };

  if (
    response.status === 410 ||
    (response.status === 400 && (await isBadToken(response)))
  ) {
    return { delivered: false, tokenInvalid: true };
  }
  return { delivered: false, tokenInvalid: false };
}

async function isBadToken(response: Response): Promise<boolean> {
  try {
    const body = (await response.json()) as { reason?: string };
    return (
      body.reason === "BadDeviceToken" ||
      body.reason === "DeviceTokenNotForTopic"
    );
  } catch {
    return false;
  }
}
