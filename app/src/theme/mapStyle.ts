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

/** Kraków [longitude, latitude] — used before the first location fix lands. */
export const DEFAULT_CENTER: [number, number] = [19.9373, 50.0617];
export const DEFAULT_ZOOM = 13.5;

export function defaultMapStyle(): string | StyleSpecification {
  return DARK_VECTOR_STYLE_URL;
}
