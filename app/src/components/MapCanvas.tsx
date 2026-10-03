import { Camera, GeoJSONSource, Layer, Map, UserLocation } from '@maplibre/maplibre-react-native';
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
import type { SmoothedPoint } from '@/hooks/useSmoothedLocations';

export type MapCanvasProps = {
  friends: Record<string, SmoothedPoint>;
  level: number;
  cameraRef: RefObject<CameraRef | null>;
  onMapPress?: (coordinate: [number, number]) => void;
};

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point>;

const MAP_STYLE = osmRasterStyle();

/**
 * The fullscreen map.
 *
 * Everything about it is deliberately quiet: desaturated tiles, no chrome, no
 * labels of our own. Friend positions are small circles; the user's own
 * position is the native puck, which is the one thing on screen that already
 * moves smoothly on its own.
 */
export function MapCanvas({ friends, level, cameraRef, onMapPress }: MapCanvasProps) {
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

      {/* Two layers so the marker reads at any zoom: a soft halo, then the dot. */}
      <GeoJSONSource id="friends" data={collection}>
        <Layer
          id="friends-halo"
          type="circle"
          paint={{
            'circle-radius': 15,
            'circle-color': markerColor,
            'circle-opacity': 0.35,
            'circle-blur': 0.45,
          }}
        />
        <Layer
          id="friends-dot"
          type="circle"
          paint={{
            'circle-radius': 6,
            'circle-color': '#FFFFFF',
            'circle-stroke-color': markerColor,
            'circle-stroke-width': 2.5,
          }}
        />
      </GeoJSONSource>
    </Map>
  );
}

const styles = StyleSheet.create({
  map: { ...StyleSheet.absoluteFill },
});
