import { Platform } from 'react-native';

import { palette as tokensPalette } from './tokens';

/**
 * Barwy, typografia i promienie mieszkają w `tokens.ts`, bo webowy podgląd
 * (`web/`) importuje je stamtąd — bez `react-native`. Ten plik dodaje tylko
 * rzeczy, które Platform wymagają, i zachowuje dotychczasowy API.
 *
 * NIE DUBLUJ tu wartości kolorów: zmiana ma iść do `tokens.ts`, inaczej web
 * i apka się rozjadą po cichu.
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
} from './tokens';

/** Tylko dla diagnostyki — nie płać duplikatu. */
void tokensPalette;

/**
 * Cross-platform elevation that actually shows up on both platforms.
 *
 * Webowy podgląd odwzorowuje to w CSS (`box-shadow`); tu zostaje natywna
 * wersja, bo i tak liczy ją silnik danej platformy.
 */
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
