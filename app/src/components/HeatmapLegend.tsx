import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { floatingShadow, palette, radii, spacing, type } from '@/theme';

export type HeatmapLegendProps = {
  visible: boolean;
  totalIncidents?: number;
  /** Heaviest grid cells from the heatmap response, for the summary list. */
  hottestCells?: { lat: number; lng: number; count: number; severity: number }[];
  /** Why the heatmap could not be read. An empty map means "no data", not "safe". */
  error?: string | null;
  /** The request is still in flight, so the report count is not known yet. */
  loading?: boolean;
  onRetry?: () => void;
  onClose: () => void;
  onOpenReport: () => void;
};

export function HeatmapLegend({
  visible,
  totalIncidents = 0,
  hottestCells = [],
  error = null,
  loading = false,
  onRetry,
  onClose,
  onOpenReport,
}: HeatmapLegendProps) {
  if (!visible) return null;

  return (
    <View style={[styles.card, floatingShadow(12)]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.titleIcon}>🔥</Text>
          <Text style={styles.title}>Strefy Zagrożenia Kraków</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      {/* The three states are kept apart on purpose. "No reports" is a claim about
          the city and may only be made once a response has actually said so. */}
      {loading ? (
        <Text style={styles.subtitle}>Wczytywanie zgłoszeń…</Text>
      ) : error ? (
        <View>
          <Text style={styles.errorText} numberOfLines={2}>
            Mapa zagrożeń nie odświeżyła się: {error}.
            {totalIncidents > 0 ? ' Dane mogą być nieaktualne.' : ''}
          </Text>
          {onRetry ? (
            <Pressable style={styles.retryBtn} onPress={onRetry} accessibilityRole="button">
              <Text style={styles.retryBtnText}>Spróbuj ponownie</Text>
            </Pressable>
          ) : null}
        </View>
      ) : totalIncidents > 0 ? (
        <Text style={styles.subtitle}>
          Gęstość zdarzeń na podstawie {totalIncidents} zgłoszeń (zaczepki, napaści, gwałty)
        </Text>
      ) : (
        <Text style={styles.subtitle}>
          Brak zgłoszeń w tej chwili. Strefy pojawiają się dopiero po pierwszym zgłoszeniu — mapa
          nie pokazuje niczego, czego nie zgłoszono.
        </Text>
      )}

      {/* Gradient Bar: Yellow -> Amber -> Red -> Crimson */}
      <View style={styles.gradientContainer}>
        <Svg width="100%" height={10} style={styles.gradientSvg}>
          <Defs>
            <LinearGradient id="legendGrad" x1="0" y1="0" x2="1" y2="0">
              {/* Same stops as the `heatmap-color` ramp in MapCanvas, transparent
                  anchor included. */}
              <Stop offset="0" stopColor="rgba(0, 0, 0, 0)" />
              <Stop offset="0.08" stopColor="rgba(255, 235, 59, 0.5)" />
              <Stop offset="0.25" stopColor="rgba(255, 193, 7, 0.68)" />
              <Stop offset="0.5" stopColor="rgba(255, 112, 67, 0.82)" />
              <Stop offset="0.75" stopColor="rgba(244, 67, 54, 0.92)" />
              <Stop offset="1" stopColor="rgba(183, 28, 28, 0.98)" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="10" rx="5" fill="url(#legendGrad)" />
        </Svg>
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleLeft}>Pomarańczowy: pojedyncze zgłoszenie</Text>
          <Text style={styles.scaleRight}>Czerwony: wiele ciężkich zgłoszeń</Text>
        </View>
      </View>

      {/* Heaviest cells, as reported. Coordinates are grid cells (~200 m), so this
          deliberately shows a rounded position and a count rather than a street. */}
      {hottestCells.length > 0 ? (
        <View style={styles.hotspotsSection}>
          <Text style={styles.hotspotsHeader}>NAJINTENSYWNIEJSZE STREFY (ZGŁOSZENIA):</Text>
          {hottestCells.map((cell) => (
            <View key={`${cell.lat},${cell.lng}`} style={styles.hotspotRow}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      cell.severity >= 3 ? '#E53935' : cell.severity === 2 ? '#F4511E' : '#FB8C00',
                  },
                ]}
              />
              <Text style={styles.hotspotText}>
                {cell.lat.toFixed(3)}, {cell.lng.toFixed(3)} · {cell.count}{' '}
                {cell.count === 1 ? 'zgłoszenie' : 'zgłoszeń'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Pressable style={styles.reportBtn} onPress={onOpenReport}>
        <Text style={styles.reportBtnIcon}>🚨</Text>
        <Text style={styles.reportBtnText}>Zgłoś niebezpieczną sytuację</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: 96,
    backgroundColor: 'rgba(22, 25, 31, 0.95)',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: spacing.md,
    zIndex: 90,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    fontSize: 16,
  },
  title: {
    ...type.title,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 16,
    color: palette.textMuted,
  },
  subtitle: {
    ...type.caption,
    fontSize: 12,
    color: palette.textMuted,
    marginBottom: spacing.sm,
  },
  gradientContainer: {
    marginVertical: 4,
  },
  gradientSvg: {
    borderRadius: 5,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: spacing.xs,
  },
  scaleLeft: {
    ...type.caption,
    fontSize: 11,
    color: '#FFF176',
    fontWeight: '500',
    flexShrink: 1,
  },
  scaleRight: {
    ...type.caption,
    fontSize: 11,
    color: '#FF5252',
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  hotspotsSection: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  hotspotsHeader: {
    ...type.caption,
    fontSize: 10,
    fontWeight: '700',
    color: palette.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  hotspotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  hotspotText: {
    ...type.caption,
    fontSize: 11,
    color: palette.text,
  },
  errorText: {
    ...type.caption,
    fontSize: 12,
    color: palette.level3,
    marginBottom: spacing.sm,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  retryBtnText: {
    ...type.label,
    fontSize: 12,
    color: palette.text,
    fontWeight: '600',
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.sm,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: 'rgba(214, 40, 40, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(214, 40, 40, 0.5)',
  },
  reportBtnIcon: {
    fontSize: 14,
  },
  reportBtnText: {
    ...type.label,
    fontSize: 12,
    color: '#FF8A80',
    fontWeight: '600',
  },
});
