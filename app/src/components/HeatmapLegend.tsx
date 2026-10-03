import { StyleSheet, Text, View, Pressable } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { floatingShadow, palette, radii, spacing, type } from '@/theme';

export type HeatmapLegendProps = {
  visible: boolean;
  totalIncidents?: number;
  /** Heaviest grid cells from the heatmap response, for the summary list. */
  hottestCells?: { lat: number; lng: number; count: number; severity: number }[];
  onClose: () => void;
  onOpenReport: () => void;
};

export function HeatmapLegend({
  visible,
  totalIncidents = 0,
  hottestCells = [],
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

      <Text style={styles.subtitle}>
        Gęstość zdarzeń na podstawie {totalIncidents} zgłoszeń (zaczepki, napaści, gwałty)
      </Text>

      {/* Gradient Bar: Yellow -> Amber -> Red -> Crimson */}
      <View style={styles.gradientContainer}>
        <Svg width="100%" height={10} style={styles.gradientSvg}>
          <Defs>
            <LinearGradient id="legendGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="rgba(255, 235, 59, 0.7)" />
              <Stop offset="0.35" stopColor="rgba(255, 152, 0, 0.85)" />
              <Stop offset="0.7" stopColor="rgba(244, 67, 54, 0.95)" />
              <Stop offset="1.0" stopColor="rgba(183, 28, 28, 1)" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="10" rx="5" fill="url(#legendGrad)" />
        </Svg>
        <View style={styles.scaleLabels}>
          <Text style={styles.scaleLeft}>Żółty: Mniej zdarzeń</Text>
          <Text style={styles.scaleRight}>Czerwony: Wysokie zagrożenie</Text>
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
  },
  scaleRight: {
    ...type.caption,
    fontSize: 11,
    color: '#FF5252',
    fontWeight: '600',
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
