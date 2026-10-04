/**
 * Mock danych zamiast backendu. Kształt celowo bliski typom z app/src/lib/api,
 * żeby późniejsze podpięcie fetch było mechaniczne.
 */
import { DEFAULT_CENTER } from "./theme";

export type ThreatLevel = 0 | 1 | 2 | 3;

export type MockFriend = {
  userId: string;
  displayName: string;
  emoji: string;
  aura: string;
  lat: number;
  lng: number;
  stale?: boolean;
};

export type HeatmapCell = {
  lng: number;
  lat: number;
  count: number;
  weight: number;
  severity: number;
  category: string;
  categoryLabel: string;
};

export type AckAction = "seen" | "answered" | "on_the_way";

export type MockAck = {
  userId: string;
  displayName: string;
  action: AckAction;
};

const CATS: Array<{ category: string; label: string; severity: number }> = [
  { category: "harassment", label: "Zaczepianie", severity: 2 },
  { category: "assault", label: "Napaść fizyczna", severity: 3 },
  { category: "sexual_assault", label: "Napaść seksualna", severity: 3 },
  { category: "robbery", label: "Rozbój", severity: 2 },
  { category: "stalking", label: "Śledzenie", severity: 2 },
  { category: "suspicious", label: "Zastraszanie", severity: 1 },
];

/** Deterministyczny PRNG, żeby heatmapa wyglądała tak samo przy każdym odświeżeniu. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Znajomi widoczni na mapie.
 *
 * **Kasii tu nie ma** — jest użytkowniczką telefonu z demo, więc nie może
 * świecić na własnej mapie. Zgłoszenia w jej imieniu w `DemoPhone` zostają,
 * bo to osobna lista „kto odebrał", a nie mapa znajomych.
 *
 * Pozycje dobrane empirycznie, nie z mapy: przy `DEFAULT_ZOOM = 13.5` i
 * skalowaniu sekcji `0.72` jeden stopień długości to ~11 920 px, a jeden
 * stopień szerokości ~18 500 px, więc kadr 283 × 613 px obejmuje okno
 * ±0,011° lng i ±0,016° lat wokół `DEFAULT_CENTER`. Wszyscy znajomi mieszczą
 * się w tym oknie z zapasem, więc mapa pokazuje ich od razu — bez wciskania
 * palców, bez zmiany zooma. Po zmianie `DEFAULT_ZOOM` te delte trzeba
 * przeliczyć.
 */
export const MOCK_FRIENDS: MockFriend[] = [
  {
    userId: "mama",
    displayName: "Mama",
    emoji: "🌙",
    aura: "#8AB4F8",
    lat: DEFAULT_CENTER[1] - 0.0065,
    lng: DEFAULT_CENTER[0] - 0.0034,
    stale: true,
  },
  {
    userId: "ola",
    displayName: "Ola",
    emoji: "⚡",
    aura: "#4CAF7D",
    lat: DEFAULT_CENTER[1] + 0.0051,
    lng: DEFAULT_CENTER[0] + 0.0055,
  },
  {
    userId: "zuza",
    displayName: "Zuza",
    emoji: "🎧",
    aura: "#C084FC",
    lat: DEFAULT_CENTER[1] + 0.0081,
    lng: DEFAULT_CENTER[0] - 0.0059,
  },
];

export function mockHeatmap(): HeatmapCell[] {
  const rand = mulberry32(20261004);
  const cells: HeatmapCell[] = [];
  /**
   * Skupiska wokół Tauron Arena.
   *
   * Nazwy są realnymi miejscami w Krakowie, ale **pozycje są ściśnięte do
   * okna widzenia mapy w demo**. Przy `DEFAULT_ZOOM = 13.5` telefon w sekcji ma
   * 393 × 852 px, więc kadr obejmuje tylko ~±0,0058° lng i ~±0,0084° lat, czyli
   * mniej więcej ±830 m na wschód i zachód. Realne odległości (Park Lotników
   * ~1 km, Rondo Mogileckie ~1,9 km) wyjechałyby poza kadr, więc mock trzyma je
   * w okolicy hali. To dane zmyślone, nie geokodowanie.
   *
   * Współrzędne zapisane są przesunięciami względem `DEFAULT_CENTER` wyliczonymi
   * z px → stopnie przy 6,24 m/px (8,67 m/px × skalowanie sekcji 0,72). Dzięki
   * temu po zmianie zoomu lub skali wystarczy przeliczyć te delty, a nie szukać
   * współrzędnych na nowo.
   *
   * Rozrzut w klastrze (±0,003° lng, ±0,0026° lat ≈ 215 m) jest mniejszy niż
   * promień warstwy heatmapy przy tym zoomie, więc każde skupisko zlewa się w
   * jedną plamę, a nie w rozlaną mgłę.
   *
   * Gęstość zgłoszeń na klastrze musi być wyższa niż liczba plam: warstwa
   * heatmapy sumuje gęstość, więc przy 26 punktach na klastrze zamiast 12
   * pojedyncze zgłoszenia zlewają się w jedno pole z gradientem. Przy mniejszej
   * liczbie wychodziło kilka osobnych kropek zamiast ciepłej plamy.
   *
   * `n` to liczba zgłoszeń, `peak` — ich wagi: sam obszar hali jest najcięższy,
   * peryferie tylko tleją, więc demo pokazuje gradację zamiast jednego
   * równomiernego czerwonego kółka.
   */
  const clusters: Array<{ name: string; lng: number; lat: number; n: number; peak: number }> = [
    { name: "Tauron Arena", lng: 19.9689, lat: 50.0676, n: 26, peak: 9 },
    { name: "Park Lotników", lng: 19.9641, lat: 50.0697, n: 16, peak: 6 },
    { name: "Stadion Miejski", lng: 19.9645, lat: 50.0732, n: 13, peak: 5 },
    { name: "Czyżyny", lng: 19.9741, lat: 50.0661, n: 14, peak: 5 },
    { name: "Błonia", lng: 19.9713, lat: 50.0728, n: 11, peak: 4 },
  ];
  let max = 1;
  for (const c of clusters) {
    for (let i = 0; i < c.n; i++) {
      const cat = CATS[Math.floor(rand() * CATS.length)]!;
      // Skrajne zgłoszenia są cięższe niż środek — tak rozkładają się realne
      // raporty, i dzięki temu plama ma miękką, nie jednokolorową obwódkę.
      const spread = Math.abs(rand() - 0.5) * 2;
      const count = Math.max(1, Math.round(1 + spread * (c.peak - 1) + rand() * 1.4));
      max = Math.max(max, count);
      cells.push({
        lng: c.lng + (rand() - 0.5) * 0.006,
        lat: c.lat + (rand() - 0.5) * 0.0052,
        count,
        weight: count,
        severity: cat.severity,
        category: cat.category,
        categoryLabel: cat.label,
      });
    }
  }
  for (const c of cells) c.weight = c.weight / max;
  return cells.sort((a, b) => b.count - a.count);
}

export function mockHeatmapGeoJSON(cells: HeatmapCell[]) {
  return {
    type: "FeatureCollection" as const,
    features: cells.map((c, i) => ({
      type: "Feature" as const,
      id: i,
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] as [number, number] },
      properties: {
        count: c.count,
        weight: c.weight,
        severity: c.severity,
        category: c.category,
        categoryLabel: c.categoryLabel,
      },
    })),
  };
}

export const ACK_LABEL: Record<AckAction, string> = {
  seen: "widzi alert",
  answered: "rozmawia",
  on_the_way: "idzie do ciebie",
};

export function ackLine(acks: MockAck[]): string | null {
  if (!acks.length) return null;
  return acks.map((a) => `${a.displayName} — ${ACK_LABEL[a.action]}`).join(" · ");
}

export const CATEGORIES = [
  { id: "harassment", label: "Zaczepianie / Molestowanie", severity: 2, icon: "🗣️", color: "#FDD835" },
  { id: "sexual_assault", label: "Próba gwałtu / Napaść seksualna", severity: 3, icon: "🛑", color: "#D32F2F" },
  { id: "assault", label: "Napaść fizyczna / Pobicie", severity: 3, icon: "⚠️", color: "#F4511E" },
  { id: "robbery", label: "Rozbój / Kradzież zuchwała", severity: 2, icon: "🚨", color: "#FB8C00" },
  { id: "stalking", label: "Śledzenie / Podejrzana osoba", severity: 2, icon: "👀", color: "#AB47BC" },
  { id: "suspicious", label: "Agresywna grupa / Zastraszanie", severity: 1, icon: "👥", color: "#FFA000" },
] as const;

export const MOCK_CONTACTS = [
  { name: "Mama", relation: "komórka" },
  { name: "Kasia", relation: "komórka" },
  { name: "Tata", relation: "komórka" },
];
