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
import type { HeatmapGeoJSON } from '@/lib/api';

export type MapCanvasProps = {
  friends: Record<string, SmoothedPoint>;
  staleSeconds?: Record<string, number>;
  level: number;
  cameraRef: RefObject<CameraRef | null>;
  onMapPress?: (coordinate: [number, number]) => void;
  showHeatmap?: boolean;
  heatmapData?: HeatmapGeoJSON | null;
};

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Point>;

const MAP_STYLE = osmRasterStyle();

/**
 * The fullscreen map.
 *
 * Everything about it is deliberately quiet: desaturated tiles, no chrome, no
 * labels of our own. Friend positions are avatar pins with a soft glowing
 * threat-level halo; the user's own position is the native puck, which is the
 * one thing on screen that already moves smoothly on its own.
 *
 * Also renders the Kraków danger heatmap. The server only ever returns grid
 * cells (see `heatCellMeters`), never individual report coordinates, so this
 * layer cannot pinpoint anybody.
 */
export function MapCanvas({
  friends,
  staleSeconds,
  level,
  cameraRef,
  onMapPress,
  showHeatmap = true,
  heatmapData,
}: MapCanvasProps) {
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

      {/* Kraków danger heatmap: yellow (few) -> crimson (many). */}
      {showHeatmap && heatmapData && heatmapData.features && heatmapData.features.length > 0 && (
        <GeoJSONSource id="danger-heatmap-source" data={heatmapData}>
          <Layer
            id="danger-heatmap-layer"
            type="heatmap"
            minzoom={8}
            maxzoom={19}
            paint={{
              'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 13, 1.5, 16, 2.8],
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0,
                'rgba(0, 0, 0, 0)',
                0.15,
                'rgba(255, 235, 59, 0.55)',
                0.35,
                'rgba(255, 193, 7, 0.70)',
                0.55,
                'rgba(255, 112, 67, 0.82)',
                0.75,
                'rgba(244, 67, 54, 0.92)',
                1.0,
                'rgba(183, 28, 28, 0.98)',
              ],
              'heatmap-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                9,
                14,
                12,
                24,
                15,
                36,
                17,
                50,
              ],
              'heatmap-opacity': 0.85,
            }}
          />
        </GeoJSONSource>
      )}

      {/* Two layers so the marker reads at any zoom: a soft halo, then the pin. */}
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
