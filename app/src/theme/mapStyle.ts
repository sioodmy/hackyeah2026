/**
 * Ciemny WEKTOR OSM — OpenFreeMap `styles/dark` (dane OpenStreetMap, bez klucza).
 *
 * `EXPO_PUBLIC_OSM_TILE_URL` zostaje jako furtka na własne kafelki rastrowe
 * (wtedy wracają dzienne transformy). Bez niej: wektor z URL-a, glify i sprite
 * dociąga sama maplibre.
 *
 * Atrybucja: © OpenFreeMap, © OpenMapTiles, dane © OpenStreetMap contributors.
 */

import type { StyleSpecification } from '@maplibre/maplibre-react-native';

export type { StyleSpecification };

export const DARK_VECTOR_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

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

export function defaultMapStyle(tileUrl: string = OSM_TILE_URL): string | StyleSpecification {
  const isCustom = Boolean(process.env.EXPO_PUBLIC_OSM_TILE_URL);
  if (!isCustom) return DARK_VECTOR_STYLE_URL;

  const tiles = [tileUrl];
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
    name: 'Mokosh Modern Dark OSM',
    sources: {
      osm: {
        type: 'raster',
        tiles,
        tileSize: 256,
        maxzoom: 19,
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
