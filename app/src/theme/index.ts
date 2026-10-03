import { Platform } from 'react-native';

/**
 * Colour palette.
 *
 * The map is desaturated on purpose: a neutral grey-brown map with a few normal
 * markers is what you want to be visible from across a room. The only saturated
 * colour in the app is the slider, and it only becomes saturated once the user
 * commits to a threat level.
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

/** Cross-platform elevation that actually shows up on both platforms. */
export function floatingShadow(elevation = 8): object {
  if (Platform.OS === 'android') {
    return { elevation };
  }
  return {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: elevation * 1.6,
    shadowOffset: { width: 0, height: elevation * 0.6 },
  };
}
