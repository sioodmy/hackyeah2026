/**
 * Live friend locations over the WebSocket.
 *
 * Behaviour that matters in an emergency:
 *   - only connects while an alert is live (level >= 2), so a phone at rest
 *     holds no socket and shares nothing;
 *   - reconnect backs off exponentially instead of hammering the server;
 *   - markers interpolate between the ~2s pings the server sends, so they glide
 *     rather than jump (see `FriendMarker`).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { FriendLocation, FriendLocationMap, Position } from '@/lib/api';
import { wsBaseUrl } from '@/lib/api';

type FriendProfileMeta = {
  displayName: string | null;
  avatarUrl: string | null;
};

type Frame =
  | {
      type: 'hello';
      self: string;
      friends: { id: string; displayName: string | null; avatarUrl?: string | null }[];
    }
  | {
      type: 'location';
      userId: string;
      lat: number;
      lng: number;
      acc?: number | null;
      bearing?: number | null;
      seq?: number | null;
      ts?: number | null;
      displayName?: string | null;
      avatarUrl?: string | null;
    }
  | { type: 'ack'; seq: number | null }
  | { type: 'ping' }
  | { type: 'error'; message: string };

const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000];

export type PublishPayload = Position & { acc?: number; seq: number };

export type UseLiveLocationsArgs = {
  /** Live only while the user is at level 2 or above. */
  enabled: boolean;
  getToken: () => Promise<string | null>;
  selfId: string | null;
  /** HTTP fallback used when the socket is not open. */
  fallbackPing: (payload: PublishPayload) => Promise<unknown>;
};

export function useLiveLocations({
  enabled,
  getToken,
  selfId,
  fallbackPing,
}: UseLiveLocationsArgs) {
  const [locations, setLocations] = useState<FriendLocationMap>({});
  const [connected, setConnected] = useState(false);
  const [friendIds, setFriendIds] = useState<string[]>([]);

  const socketRef = useRef<WebSocket | null>(null);
  const profilesRef = useRef<Record<string, FriendProfileMeta>>({});
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const seqRef = useRef(0);
  const stoppedRef = useRef(false);
  const fallbackRef = useRef(fallbackPing);
  fallbackRef.current = fallbackPing;

  const teardown = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  }, []);

  useEffect(() => {
    stoppedRef.current = !enabled;
    if (!enabled) {
      teardown();
      setConnected(false);
      return undefined;
    }

    let cancelled = false;
    stoppedRef.current = false;

    const scheduleReconnect = () => {
      if (cancelled || stoppedRef.current) return;
      const delay = BACKOFF_MS[Math.min(attemptRef.current, BACKOFF_MS.length - 1)];
      attemptRef.current += 1;
      reconnectRef.current = setTimeout(() => {
        socketRef.current = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (cancelled || stoppedRef.current || socketRef.current) return;

      let token: string | null = null;
      try {
        token = await getToken();
      } catch {
        token = null;
      }
      if (!token || cancelled || stoppedRef.current) {
        scheduleReconnect();
        return;
      }

      const socket = new WebSocket(
        `${wsBaseUrl()}/ws/locations?token=${encodeURIComponent(token)}`,
      );
      socketRef.current = socket;

      socket.onopen = () => {
        attemptRef.current = 0;
        setConnected(true);
      };

      socket.onmessage = (event) => {
        let frame: Frame;
        try {
          frame = JSON.parse(String(event.data)) as Frame;
        } catch {
          return;
        }

        if (frame.type === 'hello') {
          setFriendIds(frame.friends.map((f) => f.id));
          for (const f of frame.friends) {
            profilesRef.current[f.id] = {
              displayName: f.displayName,
              avatarUrl: f.avatarUrl ?? null,
            };
          }
          return;
        }

        if (frame.type === 'location') {
          if (selfId && frame.userId === selfId) return;
          const known = profilesRef.current[frame.userId];
          const displayName = frame.displayName ?? known?.displayName ?? null;
          const avatarUrl = frame.avatarUrl ?? known?.avatarUrl ?? null;
          if (frame.displayName || frame.avatarUrl) {
            profilesRef.current[frame.userId] = { displayName, avatarUrl };
          }

          const next: FriendLocation = {
            userId: frame.userId,
            lat: frame.lat,
            lng: frame.lng,
            acc: frame.acc ?? null,
            bearing: frame.bearing ?? null,
            seq: frame.seq ?? null,
            ts: frame.ts ?? null,
            displayName,
            avatarUrl,
          };
          setLocations((prev) => ({ ...prev, [next.userId]: next }));
        }
      };

      socket.onerror = () => {
        // `onclose` always follows, and that is where reconnect is handled.
      };

      socket.onclose = () => {
        socketRef.current = null;
        setConnected(false);
        scheduleReconnect();
      };
    };

    void connect();

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      teardown();
    };
    // `connect`/`scheduleReconnect` are recreated per run; that is intentional,
    // they close over this effect's `cancelled` flag.
  }, [enabled, getToken, selfId, teardown]);

  /** Push our own position, preferring the socket. */
  const publish = useCallback((position: Position) => {
    seqRef.current += 1;
    const payload: PublishPayload = { ...position, seq: seqRef.current };
    const socket = socketRef.current;

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'location', ...payload }));
      return;
    }

    // Degraded, not broken: the snapshot endpoint still picks these up.
    void fallbackRef.current(payload).catch(() => {});
  }, []);

  return { locations, connected, friendIds, publish };
}
