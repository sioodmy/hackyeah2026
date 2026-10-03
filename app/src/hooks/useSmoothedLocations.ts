/**
 * Smooths the ~2s location pings so markers glide across the map.
 *
 * The server sends real coordinates every couple of seconds, which at walking
 * speed is a visible jump. Easing the rendered position toward each new target
 * on a short timer removes that entirely, and costs nothing on the UI thread
 * because it is plain React state at ~20fps.
 */

import { useEffect, useRef, useState } from 'react';

import type { FriendLocation, FriendLocationMap } from '@/lib/api';

export type SmoothedPoint = FriendLocation & { lastUpdate: number };

/** Fraction of the remaining distance covered per frame. */
const EASE = 0.18;
const FRAME_MS = 50;
/** Two minutes without a ping means "stale"; used to fade the marker. */
const STALE_AFTER_MS = 120_000;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export type UseSmoothedLocationsResult = {
  points: Record<string, SmoothedPoint>;
  staleSeconds: Record<string, number>;
};

/**
 * @param targets the newest known location per friend
 * @param clock    a monotonically increasing ms source, injected so this hook
 *                 is testable without pulling in React Native timers
 */
export function useSmoothedLocations(
  targets: FriendLocationMap,
  clock: () => number = Date.now,
): UseSmoothedLocationsResult {
  const [points, setPoints] = useState<Record<string, SmoothedPoint>>({});
  const rendered = useRef<Record<string, SmoothedPoint>>({});

  useEffect(() => {
    const timer = setInterval(() => {
      const now = clock();
      const next: Record<string, SmoothedPoint> = {};
      let changed = false;

      for (const [id, target] of Object.entries(targets)) {
        const current = rendered.current[id];

        if (!current) {
          // First sighting: appear where it actually is, do not fly in.
          next[id] = { ...target, lastUpdate: now };
          changed = true;
          continue;
        }

        const lat = lerp(current.lat, target.lat, EASE);
        const lng = lerp(current.lng, target.lng, EASE);

        const moved = Math.abs(lat - current.lat) > 1e-7 || Math.abs(lng - current.lng) > 1e-7;
        const profileChanged =
          target.displayName !== current.displayName || target.avatarUrl !== current.avatarUrl;
        if (moved || target.seq !== current.seq || profileChanged) {
          next[id] = {
            ...target,
            lat,
            lng,
            lastUpdate: target.seq !== current.seq ? now : current.lastUpdate,
          };
          changed = true;
        } else {
          next[id] = current;
        }
      }

      // Drop friends that stopped sharing.
      for (const id of Object.keys(rendered.current)) {
        if (!(id in targets)) changed = true;
      }

      if (!changed) return;
      rendered.current = next;
      setPoints(next);
    }, FRAME_MS);

    return () => clearInterval(timer);
  }, [clock, targets]);

  const staleSeconds: Record<string, number> = {};
  const now = clock();
  for (const [id, point] of Object.entries(points)) {
    staleSeconds[id] = Math.max(0, (now - point.lastUpdate) / 1000);
  }

  return { points, staleSeconds };
}

/** True when a point is old enough to dim. */
export function isStale(staleSeconds: number | undefined): boolean {
  return (staleSeconds ?? 0) * 1000 > STALE_AFTER_MS;
}
