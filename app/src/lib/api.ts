/**
 * Typed client for the PanicMap API.
 *
 * Every call carries the Clerk session token, which the backend verifies with a
 * networkless RS256 check, so an expired token fails fast and locally.
 */

import Constants from 'expo-constants';

export type ThreatLevel = 0 | 1 | 2 | 3;

export type UserProfile = {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  inviteCode: string | null;
  lastSeenAt: string | null;
};

export type UpdateProfilePayload = {
  displayName?: string | null;
  avatarUrl?: string | null;
};

export type Friend = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: 'pending' | 'accepted' | 'declined';
  friendshipId: string | null;
  lastSeenAt?: string | null;
};

export type AlertPayload = {
  id: string;
  userId: string;
  level: ThreatLevel;
  status: 'active' | 'resolved';
  lat: number;
  lng: number;
  accuracy: number | null;
  bearing: number | null;
  createdAt: string | null;
  resolvedAt: string | null;
  dispatchCaseId: string | null;
  dispatchEtaMin: number | null;
  evidenceSessionId: string | null;
};

export type AlertResponse = {
  alert: AlertPayload;
  evidenceSessionId: string | null;
  chunkSeconds: number;
  notifiedFriends: number;
};

export type DispatchReceipt = {
  caseId: string;
  status: string;
  etaMin: number;
  unit: string;
  mocked: boolean;
  receivedAt: string;
  evidence: { sessionId: string | null; attached: boolean; note?: string };
};

export type EvidenceSession = {
  id: string;
  alertId: string | null;
  userId: string;
  status: 'open' | 'finalized';
  startedAt: string | null;
  endedAt: string | null;
  chunkSeconds: number | null;
  chunkCount: number;
  totalBytes: number;
  durationS: number | null;
  uploadedBytes: number;
  nextSeq: number;
  manifestSha256: string | null;
  hasManifest: boolean;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Where the API lives.
 *
 * `EXPO_PUBLIC_API_URL` wins. Otherwise we infer it from the Expo dev server
 * host, which is what you want on a physical phone on the same wifi (the Metro
 * host is already reachable from the device).
 */
export function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  // Android emulators reach the host machine through 10.0.2.2.
  const hostUri = Constants.expoConfig?.hostUri ?? null;
  const host = hostUri?.split(':')[0];
  if (host) {
    const reachable = host === 'localhost' ? '10.0.2.2' : host;
    return `http://${reachable}:8000`;
  }

  return 'http://127.0.0.1:8000';
}

export function wsBaseUrl(): string {
  return resolveApiBaseUrl().replace(/^http/, 'ws');
}

type TokenProvider = () => Promise<string | null>;

export function createApiClient(getToken: TokenProvider) {
  const base = resolveApiBaseUrl();

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken();

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (init.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${base}${path}`, { ...init, headers });

    if (response.status === 204) return undefined as T;

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      const detail =
        (payload as { detail?: string } | null)?.detail ??
        (typeof payload === 'string' ? payload : null) ??
        `HTTP ${response.status}`;
      throw new ApiError(response.status, String(detail));
    }

    return payload as T;
  }

  return {
    baseUrl: base,

    health: () => request<{ ok: boolean; database: boolean }>('/healthz'),

    myProfile: () => request<UserProfile>('/api/v1/users/me'),

    updateProfile: (body: UpdateProfilePayload) =>
      request<UserProfile>('/api/v1/users/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),

    registerDevice: (expoPushToken: string, platform: string) =>
      request<{ id: string }>('/api/v1/devices', {
        method: 'POST',
        body: JSON.stringify({ expoPushToken, platform }),
      }),

    friends: () => request<Friend[]>('/api/v1/friends'),

    friendRequests: () => request<Friend[]>('/api/v1/friends/requests'),

    acceptFriend: (id: string) =>
      request<Friend>(`/api/v1/friends/${id}/accept`, { method: 'POST' }),

    removeFriend: (id: string) => request<void>(`/api/v1/friends/${id}`, { method: 'DELETE' }),

    myInvite: () => request<{ payload: string; code: string }>('/api/v1/friends/qr/me/payload'),

    scanInvite: (payload: string, displayName?: string) =>
      request<Friend>('/api/v1/friends/scan', {
        method: 'POST',
        body: JSON.stringify({ payload, displayName }),
      }),

    raiseAlert: (level: ThreatLevel, position: Position) =>
      request<AlertResponse>('/api/v1/alerts', {
        method: 'POST',
        body: JSON.stringify({ level, ...position }),
      }),

    activeAlert: () => request<AlertPayload | null>('/api/v1/alerts/active'),

    resolveAlert: (id: string) =>
      request<AlertPayload>(`/api/v1/alerts/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      }),

    dispatchAuthorities: (
      alertId: string,
      level: ThreatLevel,
      position: Position,
      evidenceSessionId?: string | null,
    ) =>
      request<DispatchReceipt>('/api/v1/authorities/dispatch', {
        method: 'POST',
        body: JSON.stringify({ alertId, level, ...position, evidenceSessionId }),
      }),

    pingLocation: (payload: {
      lat: number;
      lng: number;
      acc?: number;
      seq: number;
      alertId?: string | null;
    }) =>
      request<{ ok: boolean }>('/api/v1/locations/ping', {
        method: 'POST',
        body: JSON.stringify({ ...payload, ts: Date.now() / 1000 }),
      }),

    locationSnapshot: () => request<{ locations: FriendLocation[] }>('/api/v1/locations/snapshot'),

    evidenceSessions: () => request<EvidenceSession[]>('/api/v1/evidence/sessions'),

    evidenceSession: (id: string) => request<EvidenceSession>(`/api/v1/evidence/sessions/${id}`),

    /**
     * Upload one recorded segment.
     *
     * `expo/fetch` is used rather than the global fetch because it can stream a
     * file from disk into a multipart body without ever holding the whole
     * recording in memory.
     */
    async uploadChunk(params: {
      sessionId: string;
      seq: number;
      offsetS: number;
      clientTs: number;
      file: Blob;
      sha256: string;
    }): Promise<EvidenceSession> {
      const token = await getToken();
      const form = new FormData();
      form.append('chunk', params.file, `${String(params.seq).padStart(6, '0')}.m4a`);

      const { fetch: expoFetch } = await import('expo/fetch');

      const response = await expoFetch(
        `${base}/api/v1/evidence/sessions/${params.sessionId}/chunks`,
        {
          method: 'POST',
          body: form,
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            'X-Chunk-Seq': String(params.seq),
            'X-Chunk-SHA256': params.sha256,
            'X-Chunk-Offset-S': String(params.offsetS),
            'X-Chunk-Client-Ts': String(params.clientTs),
          },
        },
      );

      const text = await response.text();
      if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        try {
          detail = (JSON.parse(text) as { detail?: string }).detail ?? detail;
        } catch {
          /* keep the status-code message */
        }
        throw new ApiError(response.status, detail);
      }
      return JSON.parse(text) as EvidenceSession;
    },

    finalizeEvidence: (
      id: string,
      body: { durationS?: number; chunkCount?: number; endLat?: number; endLng?: number },
    ) =>
      request<{ manifestSha256: string; manifestUrl: string }>(
        `/api/v1/evidence/sessions/${id}/finalize`,
        { method: 'POST', body: JSON.stringify(body) },
      ),
  };
}

export type Position = {
  lat: number;
  lng: number;
  accuracy?: number;
  bearing?: number;
};

export type FriendLocation = {
  userId: string;
  lat: number;
  lng: number;
  acc?: number | null;
  bearing?: number | null;
  seq?: number | null;
  ts?: number | null;
  displayName?: string | null;
  avatarUrl?: string | null;
};

export type FriendLocationMap = Record<string, FriendLocation>;

export type ApiClient = ReturnType<typeof createApiClient>;
