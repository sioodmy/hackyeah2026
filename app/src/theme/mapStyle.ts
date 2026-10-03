/**
 * The OSM raster style.
 *
 * OpenStreetMap's public tile servers (tile.openstreetmap.org) block direct mobile
 * app traffic with an "Access denied" error. We use the official German OSM chapter
 * mirror (tile.openstreetmap.de) across subdomains a/b/c for fast, reliable,
 * unblocked tile streaming.
 * You can also override it at build time with `EXPO_PUBLIC_OSM_TILE_URL`.
 *
 * The paint settings desaturate and slightly dim the tiles so the map remains
 * quiet and the threat slider / alert indicators stand out clearly.
 */

import type { StyleSpecification } from '@maplibre/maplibre-react-native';

export type { StyleSpecification };

export const DEFAULT_OSM_TILES: string[] = [
  'https://a.tile.openstreetmap.de/{z}/{x}/{y}.png',
  'https://b.tile.openstreetmap.de/{z}/{x}/{y}.png',
  'https://c.tile.openstreetmap.de/{z}/{x}/{y}.png',
];

export const OSM_TILE_URL: string =
  process.env.EXPO_PUBLIC_OSM_TILE_URL ?? 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';

/** Warsaw [longitude, latitude] — used before the first location fix lands. */
export const DEFAULT_CENTER: [number, number] = [21.0122, 52.2297];
export const DEFAULT_ZOOM = 13.5;

export function osmRasterStyle(tileUrl: string = OSM_TILE_URL): StyleSpecification {
  const tiles =
    tileUrl === OSM_TILE_URL && !process.env.EXPO_PUBLIC_OSM_TILE_URL
      ? DEFAULT_OSM_TILES
      : [tileUrl];

  return {
    version: 8,
    name: 'PanicMap OSM',
    sources: {
      osm: {
        type: 'raster',
        tiles,
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
