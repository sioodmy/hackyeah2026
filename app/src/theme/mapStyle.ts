/**
 * The OSM raster style.
 *
 * OpenStreetMap's public tile servers are fine for a demo but their usage policy
 * asks for a real tile provider (or a cache) at any volume, so the URL is a
 * constant you can swap without touching the component. Override it at build
 * time with `EXPO_PUBLIC_OSM_TILE_URL`.
 *
 * The paint settings are the reason this looks like a map and not like a warning
 * screen: the tiles are desaturated and slightly dimmed, so the map is quiet and
 * the slider is the only saturated thing on the display.
 */

import type { StyleSpecification } from '@maplibre/maplibre-react-native';

export type { StyleSpecification };

export const OSM_TILE_URL =
  process.env.EXPO_PUBLIC_OSM_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Warsaw — used before the first location fix lands. */
export const DEFAULT_CENTER: [number, number] = [52.2297, 21.0122];
export const DEFAULT_ZOOM = 13.5;

export function osmRasterStyle(tileUrl: string = OSM_TILE_URL): StyleSpecification {
  return {
    version: 8,
    name: 'PanicMap OSM',
    sources: {
      osm: {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#1A1D21' },
      },
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        paint: {
          // Desaturate and dim: from across a room this must not compete with
          // anything else on screen.
          'raster-saturation': -0.45,
          'raster-contrast': 0.04,
          'raster-brightness-min': 0.06,
          'raster-brightness-max': 0.82,
          'raster-opacity': 0.92,
        },
      },
    ],
  };
}
