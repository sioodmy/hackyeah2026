import { useUser } from '@clerk/expo';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radii, spacing, type } from '@/theme';
import { useApi } from '@/lib/ApiContext';
import { resolveApiBaseUrl } from '@/lib/api';

/**
 * Settings, reached from the pill in the corner.
 *
 * Kept deliberately plain: this is the one screen where it is fine to look like
 * an app, because nobody is supposed to be reading it under pressure.
 */
export function SettingsScreen() {
  const api = useApi();
  const { user } = useUser();
  const insets = useSafeAreaInsets();

  const [liveShare, setLiveShare] = useState(false);
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

        <Section title="Konto">
          <Row label="Zalogowano jako" value={user?.primaryEmailAddress?.emailAddress ?? '—'} />
          <Row label="ID" value={user?.id ?? '—'} mono />
        </Section>

        <Section title="Znajomi">
          <Pressable style={styles.action} onPress={goToFriends} accessibilityRole="button">
            <Text style={styles.actionText}>Zarządzaj znajomymi</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </Section>

        <Section title="Prywatność">
          <Toggle
            label="Udostępniaj lokalizację na żywo"
            hint="Znajomi widzą Twoją pozycję tylko przy poziomie 2 i 3."
            value={liveShare}
            onChange={setLiveShare}
          />
          <Toggle label="Wibracje" value={haptics} onChange={setHaptics} />
        </Section>

        <Section title="Nagrywanie dowodu">
          <Text style={styles.note}>
            Nagrywanie włącza się wyłącznie przy najwyższym poziomie zagrożenia. Telefon musi mieć
            wcześniej przyznane uprawnienie do mikrofonu — pytamy o nie w pierwszym uruchomieniu,
            nigdy w trakcie zagrożenia.
          </Text>
          <Text style={styles.noteMuted}>
            Android pokazuje wskaźnik używania mikrofonu, dopóki trwa nagranie. Ukryć go nie da się.
          </Text>
        </Section>

        <Section title="Serwer">
          <Row label="Adres API" value={resolveApiBaseUrl()} mono />
          <Row label="Dokumentacja" value="/docs" />
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

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

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
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: palette.level2, false: 'rgba(255,255,255,0.2)' }}
        thumbColor={palette.text}
      />
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
  rowValue: { ...type.caption, flexShrink: 1, textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: 11 },
  hint: { ...type.caption },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  actionText: { ...type.body },
  chevron: { color: palette.textFaint, fontSize: 22 },
  note: { ...type.caption, padding: spacing.lg, color: palette.textMuted, lineHeight: 18 },
  noteMuted: { ...type.caption, padding: spacing.lg, paddingTop: 0 },
});
