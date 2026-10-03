import { Platform } from "react-native";
import {
  MAX_THREAT_LEVEL,
  THREAT_LEVEL_COLOR,
  type ThreatLevel,
} from "@safecall/shared";

export const colors = {
  void: "#0B0D10",
  ink: "#11151A",
  surface: "#171C22",
  surfaceHigh: "#1F262E",
  hairline: "#2A323B",
  hairlineSoft: "#222931",
  text: "#EDEFF2",
  textDim: "#98A1AC",
  textFaint: "#6B7480",
  idle: THREAT_LEVEL_COLOR[0],
  l1: THREAT_LEVEL_COLOR[1],
  l2: THREAT_LEVEL_COLOR[2],
  l3: THREAT_LEVEL_COLOR[3],
  safe: "#4FB286",
} as const;

export const threatColor: Record<ThreatLevel, string> = {
  0: colors.idle,
  1: colors.l1,
  2: colors.l2,
  3: colors.l3,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const font = {
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  }) as string,
} as const;

export const type = {
  micro: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "700" as const,
  },
  label: {
    fontSize: 13,
    letterSpacing: 0.2,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 15,
    fontWeight: "500" as const,
  },
} as const;

export const MAX_LEVEL: ThreatLevel = MAX_THREAT_LEVEL as ThreatLevel;

/**
 * Track gradient stops for a 0..MAX_LEVEL drag. Every level owns a band so the
 * colour does not smear across a detent: the neutral grey bleeds into amber well
 * before level 1, amber reaches orange exactly at level 2, orange lands on red
 * exactly at level 3.
 */
export const TRACK_STOPS: readonly [number, string][] = [
  [0, "#6E747D"],
  [0.16, "#8C8577"],
  [0.34, colors.l1],
  [0.58, "#F09A25"],
  [0.78, colors.l2],
  [1, colors.l3],
];

export const shadow = {
  soft: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  lift: {
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 16,
  },
} as const;
