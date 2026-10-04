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

/** Predefiniowane aury awatarów — wspólna paleta dla profilu i znaczników mapy. */
export const auras = [
  { id: 'fuchsia', name: 'Róż', hex: '#F472B6' },
  { id: 'purple', name: 'Fiolet', hex: '#A78BFA' },
  { id: 'coral', name: 'Koral', hex: '#E05624' },
  { id: 'emerald', name: 'Mięta', hex: '#34D399' },
  { id: 'amber', name: 'Złoto', hex: '#FBBF24' },
  { id: 'sky', name: 'Błękit', hex: '#38BDF8' },
] as const;

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
  /** Wysokość kontenera gestu (większy niż bar — zapas na powiększoną gałkę). */
  track: 72,
  /** Bar ma dokładnie tę wysokość co średnica gałki — jego końce są wtedy
   *  tym samym kształtem co gałka. */
  get bar() {
    return this.knob;
  },

  /**
   * Pusty bar: ten sam przydymiony materiał co pozostałe pływające pigułki na
   * mapie (`palette.surface`), więc slider nie wygląda jak obcy element.
   */
  barFill: 'rgba(20, 22, 26, 0.86)',
  barBorder: 'rgba(255, 255, 255, 0.10)',
  /** Wklęsłość pustego baru (CSS `box-shadow`, w RN `boxShadow` z new arch). */
  barInset: 'inset 0 2px 6px rgba(0, 0, 0, 0.45)',
  /** Cień, który odkleja bar od mapy — ten sam co `floatingShadow(8)`. */
  barShadow: '0 5px 13px rgba(0, 0, 0, 0.45)',

  /**
   * Materiał gałki: półprzezroczysta biel z rozświetleniem u góry.
   * Web składa to w `linear-gradient` + `backdrop-filter: blur(5px)`, RN w
   * `expo-linear-gradient` + `expo-blur`. Gradient jest wspólny co do wartości,
   * więc krawędź światła pada tak samo.
   */
  knobGradient: ['rgba(255, 255, 255, 0.80)', 'rgba(220, 223, 229, 0.58)'] as [string, string],
  knobBorder: 'rgba(255, 255, 255, 0.45)',
  knobShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
  knobBlur: 5,
  knobSaturate: 1.15,
  /** Gałka pod palcem rośnie o tyle — czuć, że coś się złapało. */
  knobPressedScale: 1.06,
  /** Kolor uchwytu » na gałce. */
  knobGrip: 'rgba(0, 0, 0, 0.42)',

  /**
   * Materiał wypełnienia: kolor poziomu plus ten sam rozświetlony wierzch,
   * który ma gałka — dlatego pasek wygląda, jakby był z tego samego tworzywa.
   */
  fillSheenTop: 'rgba(255, 255, 255, 0.22)',
  fillSheenMid: 'rgba(255, 255, 255, 0.06)',
  fillSheenBottom: 'rgba(0, 0, 0, 0.10)',
  /** Odblask, który raz przejeżdża po wypełnionym barze po commicie. */
  shine: 'rgba(255, 255, 255, 0.40)',

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
  /** Przenikanie koloru wypełnienia między strefami. */
  zoneBlendMs: 160,
  /** Pojawianie się / gaśnięcie dymka nad sliderem i labela w barze. */
  fadeMs: 180,
  /** Przejazd odblasku po wypełnionym barze. */
  shineMs: 900,
  /** Okres „zaczepki” na strzałkach gałki w spoczynku. */
  gripHintMs: 3200,
  /**
   * Okres pulsu, gdy palec trzyma suwak na najwyższym poziomie.
   *
   * To najpoważniejszy moment interakcji i jedyny, w którym użytkownik jeszcze
   * może się wycofać — puls ma to pokazać, zanim cokolwiek się wydarzy.
   */
  maxPulseMs: 900,
} as const;

/**
 * Kolor tekstu i ticków leżących NA wypełnieniu danego poziomu: żółty
 * potrzebuje ciemnego, reszta białego.
 */
export function textOnLevel(level: number): string {
  return level === 1 ? '#1A1405' : '#FFFFFF';
}

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
