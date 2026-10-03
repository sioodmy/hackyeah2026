/**
 * Typed client for the PanicMap REST API.
 *
 * Requests carry Clerk session tokens in `Authorization: Bearer <token>` when a
 * session is active. Unauthenticated calls succeed for endpoints that do not
 * require a principal (e.g. `GET /healthz`, public invites, guest incident viewing/reporting).
 */

import Constants from 'expo-constants';

export type ThreatLevel = 0 | 1 | 2 | 3;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

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
  expectedChunkCount?: number | null;
  nextSeq: number;
  manifestSha256: string | null;
  hasManifest: boolean;
};

export type IncidentCategory =
  | 'harassment'
  | 'sexual_assault'
  | 'assault'
  | 'robbery'
  | 'stalking'
  | 'suspicious'
  | 'other';

export type IncidentReport = {
  id: string;
  userId?: string | null;
  category: string;
  categoryLabel: string;
  severity: number;
  weight: number;
  lat: number;
  lng: number;
  title?: string | null;
  description?: string | null;
  reportedAt?: string | null;
  createdAt?: string | null;
};

export type HeatmapFeature = {
  type: 'Feature';
  id?: string;
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: {
    id: string;
    category: string;
    categoryLabel: string;
    severity: number;
    weight: number;
    title?: string | null;
    description?: string | null;
    reportedAt?: string | null;
  };
};

export type HeatmapGeoJSON = {
  type: 'FeatureCollection';
  features: HeatmapFeature[];
};

export type IncidentStats = {
  total: number;
  city: string;
  byCategory: Record<string, number>;
  highRiskZones: string[];
};

export type ReportIncidentInput = {
  category: string;
  severity?: number;
  lat: number;
  lng: number;
  weight?: number;
  title?: string;
  description?: string;
  reportedAt?: string;
};

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

    incidentHeatmap: (category?: string, minSeverity?: number) => {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (minSeverity) params.append('min_severity', String(minSeverity));
      const qs = params.toString();
      return request<HeatmapGeoJSON>(`/api/v1/incidents/heatmap${qs ? `?${qs}` : ''}`);
    },

    incidents: (category?: string, limit: number = 100) => {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      params.append('limit', String(limit));
      return request<IncidentReport[]>(`/api/v1/incidents?${params.toString()}`);
    },

    reportIncident: (input: ReportIncidentInput) =>
      request<IncidentReport>('/api/v1/incidents', {
        method: 'POST',
        body: JSON.stringify(input),
      }),

    incidentStats: () => request<IncidentStats>('/api/v1/incidents/stats'),

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
};

export type FriendLocationMap = Record<string, FriendLocation>;

export type ApiClient = ReturnType<typeof createApiClient>;
