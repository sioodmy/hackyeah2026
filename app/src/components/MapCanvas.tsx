import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
  UserLocation,
} from '@maplibre/maplibre-react-native';
import { useMemo, type RefObject } from 'react';
import { StyleSheet } from 'react-native';
import type {
  CameraRef,
  PressEvent,
  PressEventWithFeatures,
} from '@maplibre/maplibre-react-native';
import type { NativeSyntheticEvent } from 'react-native';

import { palette } from '@/theme';
import { DEFAULT_CENTER, DEFAULT_ZOOM, osmRasterStyle } from '@/theme/mapStyle';
import { isStale, type SmoothedPoint } from '@/hooks/useSmoothedLocations';
import { FriendMapMarker } from '@/components/FriendMapMarker';

export type MapCanvasProps = {
  friends: Record<string, SmoothedPoint>;
  staleSeconds?: Record<string, number>;
  level: number;
  cameraRef: RefObject<CameraRef | null>;
  onMapPress?: (coordinate: [number, number]) => void;
};

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point>;

const MAP_STYLE = osmRasterStyle();

/**
 * The fullscreen map.
 *
 * Renders live friend locations as custom avatar pins with their chosen emoji
 * and display name, backed by a soft glowing threat-level halo on the street.
 */
export function MapCanvas({ friends, staleSeconds, level, cameraRef, onMapPress }: MapCanvasProps) {
  const collection = useMemo<FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: Object.values(friends).map((point) => ({
        type: 'Feature',
        id: point.userId,
        properties: { id: point.userId },
        geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
      })),
    }),
    [friends],
  );

  const markerColor = level >= 3 ? palette.level3 : level >= 2 ? palette.level2 : palette.level1;

  const handlePress = useMemo(() => {
    if (!onMapPress) return undefined;
    return (event: NativeSyntheticEvent<PressEvent | PressEventWithFeatures>) => {
      const lngLat = event.nativeEvent.lngLat;
      if (!lngLat) return;
      // `LngLat` is a [longitude, latitude] tuple.
      const [longitude, latitude] = lngLat;
      onMapPress([longitude, latitude]);
    };
  }, [onMapPress]);

  return (
    <Map
      style={styles.map}
      mapStyle={MAP_STYLE}
      logo={false}
      attribution={false}
      onPress={handlePress}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM }}
        minZoom={3}
        maxZoom={19}
      />

      <UserLocation animated accuracy heading={false} />

      {/* Luminous halo on the map pavement under each friend */}
      <GeoJSONSource id="friends" data={collection}>
        <Layer
          id="friends-halo"
          type="circle"
          paint={{
            'circle-radius': 18,
            'circle-color': markerColor,
            'circle-opacity': 0.35,
            'circle-blur': 0.45,
          }}
        />
      </GeoJSONSource>

      {/* Rich emoji avatar and name markers */}
      {Object.values(friends).map((point) => (
        <Marker
          key={point.userId}
          id={`friend-${point.userId}`}
          lngLat={[point.lng, point.lat]}
          anchor="bottom"
        >
          <FriendMapMarker
            point={point}
            level={level}
            isStale={isStale(staleSeconds?.[point.userId])}
          />
        </Marker>
      ))}
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { ...StyleSheet.absoluteFill },
});
