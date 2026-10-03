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
import type { HeatmapGeoJSON } from '@/lib/api';

export type MapCanvasProps = {
  friends: Record<string, SmoothedPoint>;
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
 * labels of our own. Friend positions are small circles; the user's own
 * position is the native puck, which is the one thing on screen that already
 * moves smoothly on its own.
 *
 * Now features a Kraków danger heatmap based on reported safety incidents
 * (harassment, sexual assaults, violent assaults, robberies).
 */
export function MapCanvas({
  friends,
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

      {/* Kraków Danger Heatmap (Red: high danger/crimes, Yellow: lower/isolated incidents) */}
      {showHeatmap && heatmapData && heatmapData.features && heatmapData.features.length > 0 && (
        <GeoJSONSource
          id="danger-heatmap-source"
          data={heatmapData as unknown as GeoJSON.FeatureCollection}
        >
          <Layer
            id="danger-heatmap-layer"
            type="heatmap"
            maxzoom={17}
            paint={{
              'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 13, 1.5, 16, 2.8],
              // Color ramp: Transparent -> Yellow (low danger) -> Amber -> Red (frequent danger) -> Dark Crimson
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
          <Layer
            id="danger-points-glow"
            type="circle"
            minzoom={13}
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 6, 16, 12],
              'circle-color': [
                'match',
                ['get', 'category'],
                'sexual_assault',
                '#E53935',
                'assault',
                '#F4511E',
                'robbery',
                '#FB8C00',
                'harassment',
                '#FDD835',
                'stalking',
                '#AB47BC',
                '#FFB300',
              ],
              'circle-opacity': 0.65,
              'circle-blur': 0.4,
            }}
          />
          <Layer
            id="danger-points-inner"
            type="circle"
            minzoom={13}
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 16, 5],
              'circle-color': '#FFFFFF',
              'circle-stroke-color': '#B71C1C',
              'circle-stroke-width': 1.5,
              'circle-opacity': 0.9,
            }}
          />
        </GeoJSONSource>
      )}

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
