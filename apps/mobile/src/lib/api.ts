import type {
  Alert,
  Contact,
  CreateInviteResponse,
  DispatchResponse,
  GeoPoint,
  LocationUpdate,
  RedeemInviteRequest,
  RaiseAlertRequest,
  RaiseAlertResponse,
  RegisterDeviceRequest,
  ThreatLevel,
  UpdateAlertRequest,
} from "@safecall/shared";

import { config } from "./env";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type TokenProvider = () => string | null;

let getToken: TokenProvider = () => null;

/** Wired up once Clerk is mounted so every request carries the session JWT. */
export function setTokenProvider(provider: TokenProvider): void {
  getToken = provider;
}

async function request<T>(
  path: string,
  init: RequestInit & { anonymous?: boolean } = {},
): Promise<T> {
  const { anonymous, ...rest } = init;
  const token = anonymous ? null : getToken();

  const headers = new Headers(rest.headers);
  headers.set("accept", "application/json");
  if (rest.body) headers.set("content-type", "application/json");

  // Dev mode talks to a server running with DEV_AUTH=1, which trusts a plain
  // header instead of a Clerk token.
  if (token?.startsWith("dev:")) {
    headers.set("x-dev-user", token.slice(4));
  } else if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${config.apiUrl}${path}`, { ...rest, headers });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const err =
      body && typeof body === "object" && "error" in body
        ? (body as { error: { message?: string; code?: string } }).error
        : undefined;
    throw new ApiError(
      response.status,
      err?.message ?? response.statusText,
      err?.code,
    );
  }

  return body as T;
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });

export const api = {
  health: () => request<{ ok: boolean; db: boolean }>("/health"),

  me: () =>
    request<{
      id: string;
      displayName: string | null;
      avatarUrl: string | null;
    }>("/api/me"),

  contacts: () => request<Contact[]>("/api/contacts"),

  redeemInvite: (body: RedeemInviteRequest) =>
    request<{ contact: Contact }>("/api/contacts", {
      method: "POST",
      ...json(body),
    }),

  removeContact: (contactId: string) =>
    request<{ ok: true }>(`/api/contacts/${encodeURIComponent(contactId)}`, {
      method: "DELETE",
    }),

  createInvite: (ttlSeconds?: number) =>
    request<CreateInviteResponse>("/api/invites", {
      method: "POST",
      ...json({ ttlSeconds }),
    }),

  alerts: () => request<Alert[]>("/api/alerts"),

  activeAlert: () => request<Alert | null>("/api/alerts/active"),

  raiseAlert: (body: RaiseAlertRequest) =>
    request<RaiseAlertResponse>("/api/alerts", {
      method: "POST",
      ...json(body),
    }),

  updateAlert: (id: string, body: UpdateAlertRequest) =>
    request<Alert>(`/api/alerts/${encodeURIComponent(id)}`, {
      method: "PATCH",
      ...json(body),
    }),

  dispatch: (body: {
    location: GeoPoint;
    level: ThreatLevel;
    alertId?: string;
    accuracy?: number | null;
    place?: string | null;
    note?: string | null;
  }) =>
    request<DispatchResponse>("/api/dispatch", {
      method: "POST",
      ...json(body),
    }),

  pushLocation: (body: LocationUpdate) =>
    request<{ ok: true }>("/api/locations/me", {
      method: "PUT",
      ...json(body),
    }),

  registerDevice: (body: RegisterDeviceRequest) =>
    request<{ ok: true }>("/api/devices", { method: "POST", ...json(body) }),
};
