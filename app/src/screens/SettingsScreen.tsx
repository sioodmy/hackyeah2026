import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radii, spacing, switchTokens, type } from '@/theme';
import { ProfileSettingsCard } from '@/components/ProfileSettingsCard';

/**
 * Settings, reached from the pill in the corner.
 */
export function SettingsScreen() {
  const insets = useSafeAreaInsets();

  const [liveShare, setLiveShare] = useState(true);
  const [haptics, setHaptics] = useState(true);

  const goToFriends = useCallback(() => router.push('/friends'), []);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <Header onBack={() => router.back()} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Twój profil</Text>
          <ProfileSettingsCard />
        </View>

        <Section title="Znajomi">
          <Pressable style={styles.action} onPress={goToFriends} accessibilityRole="button">
            <Text style={styles.actionText}>Zarządzaj znajomymi</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Section>

        <Section title="Prywatność">
          <Toggle
            label="Udostępnianie lokalizacji"
            hint="Znajomi widzą Twoją pozycję przy podwyższonym poziomie zagrożenia"
            value={liveShare}
            onChange={setLiveShare}
          />
          <Toggle label="Wibracje" value={haptics} onChange={setHaptics} />
        </Section>
      </ScrollView>
    </View>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Wróć">
        <Text style={styles.back}>‹</Text>
      </Pressable>
      <Text style={styles.title}>Ustawienia</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/**
 * Przełącznik z własnym trackiem i kciukiem, a nie natywny `Switch`.
 *
 * Natywny wygląda inaczej na każdym systemie, a webowy podgląd pokazuje
 * konkretny pillek — żeby było 1:1, obie strony rysują go same i czytają
 * geometrię z `switchTokens`.
 */
function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.toggleText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Pressable
        style={[
          styles.switchTrack,
          { backgroundColor: value ? switchTokens.on : switchTokens.off },
        ]}
        onPress={() => onChange(!value)}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={label}
        hitSlop={6}
      >
        <View
          style={[
            styles.switchThumb,
            value && {
              backgroundColor: switchTokens.thumbColor,
              left: switchTokens.width - switchTokens.thumb - switchTokens.padding,
            },
          ]}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.surfaceSolid },
  content: { paddingHorizontal: spacing.lg, gap: spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  back: { fontSize: 32, color: palette.text, lineHeight: 34 },
  title: { ...type.title },
  section: { gap: spacing.sm },
  sectionTitle: { ...type.label, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8 },
  card: {
    borderRadius: radii.card,
    backgroundColor: palette.surfaceRaised,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.border,
  },
  toggleText: { flex: 1, gap: 2 },
  rowLabel: { ...type.body, fontSize: 14 },
  hint: { ...type.caption },
  switchTrack: {
    width: switchTokens.width,
    height: switchTokens.height,
    borderRadius: switchTokens.height / 2,
    padding: switchTokens.padding,
    justifyContent: 'center',
  },
  switchThumb: {
    position: 'absolute',
    left: switchTokens.padding,
    width: switchTokens.thumb,
    height: switchTokens.thumb,
    borderRadius: switchTokens.thumb / 2,
    backgroundColor: switchTokens.thumbColor,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  actionText: { ...type.body },
  chevron: { color: palette.textFaint, fontSize: 22 },
});
