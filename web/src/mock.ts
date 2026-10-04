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

export const MOCK_FRIENDS: MockFriend[] = [
  {
    userId: "kasia",
    displayName: "Kasia",
    emoji: "🦊",
    aura: "#F2761B",
    lat: DEFAULT_CENTER[1] + 0.008,
    lng: DEFAULT_CENTER[0] - 0.011,
  },
  {
    userId: "mama",
    displayName: "Mama",
    emoji: "🌙",
    aura: "#8AB4F8",
    lat: DEFAULT_CENTER[1] - 0.012,
    lng: DEFAULT_CENTER[0] + 0.014,
    stale: true,
  },
  {
    userId: "ola",
    displayName: "Ola",
    emoji: "⚡",
    aura: "#4CAF7D",
    lat: DEFAULT_CENTER[1] + 0.016,
    lng: DEFAULT_CENTER[0] + 0.006,
  },
];

export function mockHeatmap(): HeatmapCell[] {
  const rand = mulberry32(20261004);
  const cells: HeatmapCell[] = [];
  // Skupiska w okolicach Rynku, Kazimierza, Dworca i Nowej Huty — gęstość jak w seedzie demo.
  const clusters: Array<[number, number, number]> = [
    [19.9373, 50.0617, 9],
    [19.9445, 50.0515, 7],
    [19.9470, 50.0685, 6],
    [20.0, 50.07, 4],
  ];
  let max = 1;
  for (const [clng, clat, n] of clusters) {
    for (let i = 0; i < n; i++) {
      const cat = CATS[Math.floor(rand() * CATS.length)]!;
      const count = 1 + Math.floor(rand() * 5);
      max = Math.max(max, count);
      cells.push({
        lng: clng + (rand() - 0.5) * 0.018,
        lat: clat + (rand() - 0.5) * 0.014,
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
  { name: "Tata", relation: "mobile" },
];
