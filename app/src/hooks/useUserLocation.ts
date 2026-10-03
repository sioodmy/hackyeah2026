import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Position } from '@/lib/api';
import { LOCATION_INTERVAL_ACTIVE_MS, LOCATION_INTERVAL_LIVE_MS } from '@/theme/levels';

export type UseUserLocationArgs = {
  /** While true we ask for a foreground fix and keep the watch warm. */
  enabled: boolean;
  /** True from level 2 up: tighter interval, and we broadcast each fix. */
  broadcast: boolean;
  onFix: (position: Position) => void;
};

/**
 * Own-device location.
 *
 * Foreground permission only is requested — background location would be the
 * invasive version of this feature, and nothing here needs it: the app streams
 * location only while it is open and an alert is live.
 */
export function useUserLocation({ enabled, broadcast, onFix }: UseUserLocationArgs) {
  const [position, setPosition] = useState<Position | null>(null);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [error, setError] = useState<string | null>(null);

  const onFixRef = useRef(onFix);
  onFixRef.current = onFix;

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status === Location.PermissionStatus.GRANTED ? 'granted' : 'denied');
      return status === Location.PermissionStatus.GRANTED;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się poprosić o lokalizację.');
      setPermission('denied');
      return false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      const granted =
        (await Location.getForegroundPermissionsAsync()).granted || (await requestPermission());
      if (cancelled || !granted) return;

      // A first fix immediately, so the map is not empty on open.
      try {
        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        const pos: Position = {
          lat: current.coords.latitude,
          lng: current.coords.longitude,
          accuracy: current.coords.accuracy ?? undefined,
          bearing: current.coords.heading ?? undefined,
        };
        setPosition(pos);
        onFixRef.current(pos);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Brak sygnału GPS.');
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: broadcast ? 0 : 5,
          timeInterval: broadcast ? LOCATION_INTERVAL_ACTIVE_MS : LOCATION_INTERVAL_LIVE_MS,
        },
        (next) => {
          const pos: Position = {
            lat: next.coords.latitude,
            lng: next.coords.longitude,
            accuracy: next.coords.accuracy ?? undefined,
            bearing: next.coords.heading ?? undefined,
          };
          setPosition(pos);
          onFixRef.current(pos);
        },
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [broadcast, enabled, requestPermission]);

  return { position, permission, error, requestPermission };
}
