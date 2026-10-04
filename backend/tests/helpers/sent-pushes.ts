/**
 * Captures what the backend tried to push, so tests can assert on the exact
 * payload the mobile app would receive without contacting APNs or FCM.
 */
import { vi } from "vitest";

export interface SentPush {
  provider: "apns" | "fcm";
  token: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface PushRecorder {
  sent: SentPush[];
  /** Pushes addressed to a specific device token. */
  forToken: (token: string) => SentPush[];
  restore: () => void;
}

const APNS_HOSTS = ["api.push.apple.com", "api.sandbox.push.apple.com"];
const FCM_HOSTS = ["fcm.googleapis.com", "oauth2.googleapis.com"];

type FetchArgs = Parameters<typeof fetch>;
type FetchInput = FetchArgs[0];
type FetchInit = FetchArgs[1];
type HeadersLike = NonNullable<NonNullable<FetchInit>["headers"]>;

function urlOf(input: FetchInput): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

/**
 * Intercepts global fetch. Every outbound call is inspected: APNs and FCM are
 * recorded and answered with success, anything else passes through untouched.
 */
export function recordPushes(): PushRecorder {
  const sent: SentPush[] = [];
  const realFetch = globalThis.fetch;

  const fakeFetch = vi.fn(async (input: FetchInput, init?: FetchInit) => {
    const url = urlOf(input);
    const headers = normalizeHeaders(init && init.headers);

    if (APNS_HOSTS.some((host) => url.includes(host))) {
      const token = url.slice(url.lastIndexOf("/") + 1);
      sent.push({
        provider: "apns",
        token,
        headers,
        body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      });
      return new Response("", { status: 200 });
    }

    if (FCM_HOSTS.some((host) => url.includes(host))) {
      // The OAuth2 token exchange is a prerequisite, not a notification.
      if (url.includes("oauth2")) {
        return new Response(
          JSON.stringify({ access_token: "test-access-token" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }
      const parsed = JSON.parse(String(init?.body ?? "{}")) as {
        message?: { token?: string };
      };
      sent.push({
        provider: "fcm",
        token: parsed.message?.token ?? "",
        headers,
        body: parsed as unknown as Record<string, unknown>,
      });
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    return realFetch(input, init);
  });

  globalThis.fetch = fakeFetch as unknown as typeof fetch;

  return {
    sent,
    forToken: (token) => sent.filter((push) => push.token === token),
    restore: () => {
      globalThis.fetch = realFetch;
    },
  };
}

/** The aps dictionary, which is where iOS delivery behaviour lives. */
export function aps(body: Record<string, unknown>): Record<string, unknown> {
  return body.aps as Record<string, unknown>;
}

/** The android block of an FCM message. */
export function android(
  body: Record<string, unknown>,
): Record<string, unknown> {
  return (body.message as Record<string, unknown>).android as Record<
    string,
    unknown
  >;
}

/** The FCM data block, which carries our payload on Android. */
export function fcmData(body: Record<string, unknown>): Record<string, string> {
  return (body.message as Record<string, unknown>).data as Record<
    string,
    string
  >;
}

function normalizeHeaders(
  headers: HeadersLike | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;

  if (Array.isArray(headers)) {
    for (const entry of headers) {
      const [key, value] = entry;
      out[String(key).toLowerCase()] = String(value);
    }
  } else if (typeof (headers as Headers).forEach === "function") {
    (headers as Headers).forEach((value, key) => {
      out[key.toLowerCase()] = value;
    });
  } else {
    for (const [key, value] of Object.entries(headers))
      out[key.toLowerCase()] = String(value);
  }
  return out;
}
