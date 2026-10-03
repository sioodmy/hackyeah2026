import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

import type { GeoPoint } from "@safecall/shared";

const HEARTBEAT_MS = 5_000;

interface Options {
  /** Receives every new fix. */
  onFix: (
    point: GeoPoint,
    accuracy: number | null,
    heading: number | null,
  ) => void;
  enabled: boolean;
}

/**
 * Foreground location watch. The heartbeat pushes the newest fix on a fixed
 * cadence so a stationary phone still keeps its timestamp fresh, which is what
 * friends see as "online".
 */
export function useLocationWatch({ onFix, enabled }: Options) {
  const [permission, setPermission] = useState<
    "unknown" | "granted" | "denied"
  >("unknown");
  const onFixRef = useRef(onFix);
  onFixRef.current = onFix;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let latest: {
      point: GeoPoint;
      accuracy: number | null;
      heading: number | null;
    } | null = null;

    const publish = () => {
      if (!latest) return;
      onFixRef.current(latest.point, latest.accuracy, latest.heading);
    };

    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;

      if (status !== "granted") {
        setPermission("denied");
        return;
      }

      setPermission("granted");

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (cancelled) return;

      latest = toFix(current);
      publish();

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 5,
          timeInterval: 3_000,
        },
        (next) => {
          latest = toFix(next);
          publish();
        },
      );

      if (cancelled) {
        subscription.remove();
        return;
      }

      heartbeat = setInterval(publish, HEARTBEAT_MS);
    })();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      subscription?.remove();
    };
  }, [enabled]);

  return { permission };
}

function toFix(position: Location.LocationObject): {
  point: GeoPoint;
  accuracy: number | null;
  heading: number | null;
} {
  return {
    point: {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    },
    accuracy: position.coords.accuracy ?? null,
    heading: position.coords.heading ?? null,
  };
}
