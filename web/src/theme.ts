/**
 * Webowy podgląd — tokeny designu wspólne z apką.
 *
 * Wszystko czytane z `@app/theme/tokens` (jedno źródło prawdy dla obu
 * platform). Web **nie** kopiuje palety — jak apka zmieni kolor, preview
 * zmienia się razem z nią.
 *
 * Wyjątkiem jest `floatingShadow`: `app/src/theme/index.ts` importuje
 * `Platform` z react-native, więc web bierze z tego samego pliku cienie
 * ręcznie (CSS).
 */

export {
  palette,
  colorForLevel,
  textOnLevel,
  auras,
  radii,
  spacing,
  type,
  sliderTokens,
  switchTokens,
  heatmapTokens,
} from "@app/theme/tokens";

export {
  THREAT_SAFE,
  THREAT_HINT,
  THREAT_HELP,
  THREAT_FULL,
  MAX_LEVEL,
  STOP_LEVELS,
  DETENTS,
  OVERDRAG,
  FAKE_CALL_DELAY_MS,
  FAKE_CALL_DELAY_S,
  fakeCallHint,
  fakeCallPreview,
  EVIDENCE_CHUNK_SECONDS,
  LOCATION_INTERVAL_ACTIVE_MS,
  LOCATION_INTERVAL_LIVE_MS,
  levelForProgress,
  detentFor,
  label,
  hint,
  type ThreatLevel,
} from "@app/theme/levels";

/** Dark vector OSM — wektorowy, bez klucza (jak w `app/src/theme/mapStyle`). */
export const DARK_VECTOR_STYLE_URL =
  "https://tiles.openfreemap.org/styles/dark";

/**
 * Tauron Arena, Kraków [lng, lat] — środek mapy w demo.
 *
 * Celowo nie Rynek: wokół hali jest rozległa, czytelna siatka ulic i parking,
 * więc skupiska zdarzeń z mocka rysują się jako osobne plamy zamiast zlewać
 * się w centrum.
 */
export const DEFAULT_CENTER: [number, number] = [19.9689, 50.0676];
export const DEFAULT_ZOOM = 13.5;
