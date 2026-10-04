/**
 * The single source of truth for what each threat level *means*.
 *
 * Both the slider and the level state machine read from here, so adding a level
 * or moving a threshold cannot leave the UI and the behaviour out of sync.
 */

export const THREAT_SAFE = 0;
export const THREAT_HINT = 1;
export const THREAT_HELP = 2;
export const THREAT_FULL = 3;

export type ThreatLevel = 0 | 1 | 2 | 3;

export const MAX_LEVEL: ThreatLevel = THREAT_FULL;

/** Every level in ascending order — the stops the slider snaps between. */
export const STOP_LEVELS: readonly ThreatLevel[] = [
  THREAT_SAFE,
  THREAT_HINT,
  THREAT_HELP,
  THREAT_FULL,
] as const;

/** Slider zones. `from` is inclusive, `to` is exclusive except for the last. */
export const ZONES: ReadonlyArray<{ level: ThreatLevel; from: number; to: number }> = [
  { level: THREAT_SAFE, from: 0, to: 0.18 },
  { level: THREAT_HINT, from: 0.18, to: 0.5 },
  { level: THREAT_HELP, from: 0.5, to: 0.85 },
  { level: THREAT_FULL, from: 0.85, to: 1 },
] as const;

/** Where the knob snaps to when released in each zone, as a fraction of travel. */
export const DETENTS: Record<ThreatLevel, number> = {
  [THREAT_SAFE]: 0,
  [THREAT_HINT]: 0.34,
  [THREAT_HELP]: 0.66,
  [THREAT_FULL]: 1,
};

/** How far past 1.0 you can over-drag before the track refuses. */
export const OVERDRAG = 0.06;

/** Seconds before the fake incoming call fires at level 1+. */
export const FAKE_CALL_DELAY_MS = 5_000;

/**
 * Teksty zależne od opóźnienia, liczone z niego samego.
 *
 * Wcześniej „10 s" było wpisane na sztywno w trzech miejscach (tu, na mapie i w
 * webowym demo), więc zmiana stała by na trzech niezależnych ścieżkach.
 */
export const FAKE_CALL_DELAY_S = FAKE_CALL_DELAY_MS / 1000;

export function fakeCallHint(): string {
  return `${FAKE_CALL_DELAY_S} s i telefon zadzwoni`;
}

export function fakeCallPreview(): string {
  return `Poziom 1 · Telefon zadzwoni za ${FAKE_CALL_DELAY_S} s`;
}

/** Upper bound on one recorded audio segment. */
export const EVIDENCE_CHUNK_SECONDS = 30;

/** Location broadcast interval while an alert is active. */
export const LOCATION_INTERVAL_ACTIVE_MS = 2_000;
export const LOCATION_INTERVAL_LIVE_MS = 15_000;

export function levelForProgress(progress: number): ThreatLevel {
  const clamped = Math.min(1, Math.max(0, progress));
  for (const zone of ZONES) {
    if (clamped < zone.to) return zone.level;
  }
  return MAX_LEVEL;
}

/** Detent for a level, with a total function so it is always safe to index. */
export function detentFor(level: ThreatLevel): number {
  return DETENTS[level] ?? DETENTS[THREAT_SAFE];
}

export function label(level: ThreatLevel): string {
  switch (level) {
    case THREAT_SAFE:
      return 'Bezpiecznie';
    case THREAT_HINT:
      return 'Potrzebuję chwili';
    case THREAT_HELP:
      return 'Potrzebuję pomocy';
    case THREAT_FULL:
      return 'Pełny alarm';
    default:
      return '';
  }
}

export function hint(level: ThreatLevel): string {
  switch (level) {
    case THREAT_SAFE:
      return '';
    case THREAT_HINT:
      return fakeCallHint();
    case THREAT_HELP:
      return 'Znajomi dostaną lokalizację';
    case THREAT_FULL:
      return 'Pełny alarm + nagranie';
    default:
      return '';
  }
}
