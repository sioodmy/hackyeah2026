/**
 * Wspólne tokeny designu — jedyne źródło prawdy dla wyglądu.
 *
 * Ten plik **nie może** importować `react-native` ani `expo`, bo webowy podgląd
 * (`web/`, branch `web/preview`) importuje go przez alias `@app/theme/tokens`.
 * Dzięki temu paleta, typografia i geometria slidera są jednym i tym samym
 * kodem w obu implementacjach, a nie kopią, która po cichu się rozjeżdża.
 *
 * To, co **musi** zostać poza tym plikiem (bo potrzebuje Platform):
 * `floatingShadow` w `theme/index.ts`.
 */

export const palette = {
  /** Map chrome / floating surfaces. */
  surface: 'rgba(20, 22, 26, 0.86)',
  surfaceSolid: '#14161A',
  surfaceRaised: 'rgba(30, 33, 38, 0.94)',
  border: 'rgba(255, 255, 255, 0.10)',
  borderStrong: 'rgba(255, 255, 255, 0.18)',

  text: '#F4F5F7',
  textMuted: '#9BA1AA',
  textFaint: '#6B717A',

  /** Threat levels, matching the slider stops exactly. */
  level0: '#5C6069',
  level1: '#EFC02B',
  level2: '#F2761B',
  level3: '#D62828',

  accent: '#8AB4F8',
  success: '#4CAF7D',
} as const;

export function colorForLevel(level: number): string {
  switch (level) {
    case 1:
      return palette.level1;
    case 2:
      return palette.level2;
    case 3:
      return palette.level3;
    default:
      return palette.level0;
  }
}

export const radii = {
  pill: 999,
  card: 20,
  track: 32,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const type = {
  title: { fontSize: 20, fontWeight: '600' as const, color: palette.text },
  body: { fontSize: 15, fontWeight: '400' as const, color: palette.text },
  label: { fontSize: 13, fontWeight: '600' as const, color: palette.textMuted },
  caption: { fontSize: 12, fontWeight: '500' as const, color: palette.textFaint },
} as const;

/**
 * Slider — geometria i materiały, wspólne dla RN i webu.
 *
 * Wszystkie wartości są w px i dotyczą obu platform: web używa ich w stylach
 * inline, RN w `StyleSheet`. Zmiana tutaj zmienia oba renderowania naraz.
 */
export const sliderTokens = {
  /** Średnica gałki. */
  knob: 56,
  /** Wysokość kontenera gestu (t bigger niż bar, bo gałka wystaje). */
  track: 72,
  /** Bar ma dokładnie tę wysokość co średnica gałki — jego końce są wtedy
   *  tym samym kształtem co gałka. */
  get bar() {
    return this.knob;
  },

  /** Kolor pustego baru. */
  barFill: '#191C23',
  barBorder: 'rgba(255, 255, 255, 0.10)',

  /**
   * Materiał gałki: półprzezroczysta biel z rozświetleniem u góry.
   * Web składa to w `linear-gradient` + `backdrop-filter: blur(5px)`, RN w
   * `expo-linear-gradient` + `expo-blur`. Gradient jest wspólny co do wartości,
   * więc krawędź światła pada tak samo.
   */
  knobGradient: ['#ffffff80', '#d7dae080'] as [string, string],
  knobBorder: 'rgba(255, 255, 255, 0.34)',
  knobBlur: 5,
  knobSaturate: 1.15,
  /** Kolor uchwytu » na gałce. */
  knobGrip: 'rgba(0, 0, 0, 0.38)',

  /**
   * Materiał wypełnienia: kolor poziomu plus ten sam rozświetlony wierzch,
   * który ma gałka — dlatego pasek wygląda, jakby był z tego samego tworzywa.
   */
  fillSheenTop: 'rgba(255, 255, 255, 0.22)',
  fillSheenMid: 'rgba(255, 255, 255, 0.06)',
  fillSheenBottom: 'rgba(0, 0, 0, 0.10)',

  /** Tick skali: rośnie z poziomem, więc da się go odczytać wzrokiem. */
  tickWidth: 2,
  tickHeight: [5, 7, 9, 11],
  tickOpacityActive: 0.5,
  tickOpacityIdle: 0.22,
  stopLabelSize: 10,
  stopLabelIdle: 'rgba(255, 255, 255, 0.34)',
  stopWidth: 44,

  /** Magnes przyciągający do detentów. */
  magnetRange: 0.14,
  magnetStrength: 0.7,

  /** Czasy animacji w ms — dojazd, wypełnienie, powrót. */
  commitMs: 420,
  holdMs: 1600,
  resetMs: 900,
} as const;

/** Przełącznik w Ustawieniach — wspólna geometria (RN: własny, nie natywny). */
export const switchTokens = {
  width: 46,
  height: 28,
  padding: 2,
  thumb: 24,
  on: palette.level2,
  off: 'rgba(255, 255, 255, 0.2)',
  thumbColor: palette.text,
} as const;

/** Wspólna paleta stopni rampa heatmapy (bez żółtego — patrz MapCanvas). */
export const heatmapTokens = {
  opacity: 0.34,
  ramp: [
    'rgba(0, 0, 0, 0)',
    'rgba(214, 87, 40, 0.16)',
    'rgba(206, 47, 32, 0.30)',
    'rgba(190, 26, 32, 0.46)',
    'rgba(160, 16, 30, 0.60)',
    'rgba(122, 8, 26, 0.72)',
  ] as const,
  /** Próg gęstości, na którym pojawia się kolejny stopień rampy. */
  rampStops: [0, 0.15, 0.35, 0.6, 0.8, 1] as const,
} as const;
