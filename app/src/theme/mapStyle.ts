/**
 * Modern Dark Mode OSM raster style.
 *
 * Uses CARTO Dark Matter raster tiles (derived directly from OpenStreetMap data)
 * across subdomains a/b/c/d for fast, unblocked, modern dark mode tile streaming.
 * You can also override it at build time with `EXPO_PUBLIC_OSM_TILE_URL`.
 *
 * If daylight OSM tiles (tile.openstreetmap.de/org) are provided, custom
 * high-contrast dark mode paint transforms are applied.
 */

import type { StyleSpecification } from '@maplibre/maplibre-react-native';

export type { StyleSpecification };

export const DEFAULT_OSM_TILES: string[] = [
  'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
];

export const OSM_TILE_URL: string = process.env.EXPO_PUBLIC_OSM_TILE_URL ?? DEFAULT_OSM_TILES[0]!;

/** Kraków [longitude, latitude] — used before the first location fix lands. */
export const DEFAULT_CENTER: [number, number] = [19.9373, 50.0617];
export const DEFAULT_ZOOM = 13.5;

export function osmRasterStyle(tileUrl: string = OSM_TILE_URL): StyleSpecification {
  const isCustom = Boolean(process.env.EXPO_PUBLIC_OSM_TILE_URL);
  const tiles = tileUrl === OSM_TILE_URL && !isCustom ? DEFAULT_OSM_TILES : [tileUrl];

  const isDaylightOsm =
    tileUrl.includes('openstreetmap.de') || tileUrl.includes('tile.openstreetmap.org');

  const rasterPaint = isDaylightOsm
    ? {
        'raster-saturation': -0.92,
        'raster-contrast': 0.28,
        'raster-brightness-min': 0.0,
        'raster-brightness-max': 0.58,
        'raster-opacity': 0.9,
      }
    : {
        'raster-saturation': 0.0,
        'raster-contrast': 0.12,
        'raster-brightness-min': 0.0,
        'raster-brightness-max': 1.0,
        'raster-opacity': 0.98,
      };

  return {
    version: 8,
    name: 'PanicMap Modern Dark OSM',
    sources: {
      osm: {
        type: 'raster',
        tiles,
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors, © CARTO',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#111317' },
      },
      {
        id: 'osm',
        type: 'raster',
        source: 'osm',
        paint: rasterPaint,
      },
    ],
  };
}
