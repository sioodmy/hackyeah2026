import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { SignOutButton } from "@clerk/clerk-react";

import { PrimaryButton, Row, ScreenHeader } from "@/ui";
import { config } from "@/lib/env";
import { useSafety } from "@/providers/SafetyProvider";
import { useSession } from "@/providers/SessionProvider";
import { colors, radius, space, threatColor, type } from "@/theme";
import { THREAT_LEVEL_LABEL, type ThreatLevel } from "@safecall/shared";

export default function SettingsScreen() {
  const router = useRouter();
  const session = useSession();
  const safety = useSafety();

  const [haptics, setHaptics] = useState(true);
  const [background, setBackground] = useState(true);
  const [shareBattery, setShareBattery] = useState(false);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Ustawienia"
        subtitle={session.displayName ?? "niezalogowany"}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.section}>AKTUALNY STOPIEŃ</Text>
        <View style={styles.levelCard}>
          <LinearGradient
            colors={[
              threatColor[0],
              threatColor[1],
              threatColor[2],
              threatColor[3],
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.levelBar}
          />
          <Text style={styles.levelValue}>{safety.level}</Text>
          <Text style={styles.levelLabel}>
            {THREAT_LEVEL_LABEL[safety.level as ThreatLevel]}
          </Text>
        </View>

        <Text style={styles.section}>ZAWARTOŚĆ ALARMU</Text>
        <View style={styles.stack}>
          {([1, 2, 3] as const).map((level) => (
            <Row
              key={level}
              accent={threatColor[level]}
              label={`Poziom ${level}`}
              detail={LEVEL_DETAIL[level]}
            />
          ))}
        </View>

        <Text style={styles.section}>POŁĄCZENIE</Text>
        <View style={styles.stack}>
          <Row
            accent={safety.connected ? colors.safe : colors.textFaint}
            label="Serwer"
            detail={safety.connected ? "połączono" : "rozłączono"}
            value={`${safety.contacts.length} znajomych`}
          />
          <Row label="API" detail={config.apiUrl} />
          <Row label="WebSocket" detail={config.wsUrl} />
          <Row
            accent={
              safety.locationPermission === "granted" ? colors.safe : colors.l2
            }
            label="Lokalizacja"
            detail={
              safety.locationPermission === "granted"
                ? "udostępniana znajomym"
                : safety.locationPermission === "denied"
                  ? "brak zgody — mapa nie działa"
                  : "sprawdzam…"
            }
          />
        </View>

        <Text style={styles.section}>APKA</Text>
        <View style={styles.stack}>
          <ToggleRow
            label="Wibracje"
            hint="potwierdzenie poziomów suwakiem"
            value={haptics}
            onChange={setHaptics}
          />
          <ToggleRow
            label="Lokalizacja w tle"
            hint="znajomi widzą Cię na mapie także po zablokowaniu"
            value={background}
            onChange={setBackground}
          />
          <ToggleRow
            label="Udostępniaj baterię"
            hint="dodatkowa informacja przy poziomie 3"
            value={shareBattery}
            onChange={setShareBattery}
          />
        </View>

        <Text style={styles.section}>KONTO</Text>
        <View style={styles.stack}>
          {session.isDev ? (
            <Row
              accent={colors.l2}
              label="Tryb demo"
              detail="Clask nie skonfigurowany — ustaw EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"
            />
          ) : (
            <PrimaryButton
              label="Wyloguj się"
              tone="ghost"
              accent={colors.l3}
              onPress={() => router.replace("/sign-in")}
            />
          )}
        </View>

        {session.isDev ? null : (
          <View style={styles.clerkSlot}>
            <SignOutButton />
          </View>
        )}

        <Text style={styles.footnote}>
          Safe Call · bezpieczeństwo, które wygląda jak mapa
        </Text>
      </ScrollView>
    </View>
  );
}

const LEVEL_DETAIL: Record<1 | 2 | 3, string> = {
  1: "fałszywe połączenie jako wymówka",
  2: "znajomi dostają lokalizację i prośbę o telefon",
  3: "pełny alarm + powiadomienie służb",
};

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.textDim, false: colors.hairline }}
        thumbColor={colors.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  section: { ...type.micro, color: colors.textFaint, marginTop: space.lg },
  stack: { gap: space.sm },

  levelCard: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineSoft,
    gap: space.xs,
  },
  levelBar: { height: 4, borderRadius: 2, marginBottom: space.md },
  levelValue: { fontSize: 34, fontWeight: "700", color: colors.text },
  levelLabel: { ...type.label, color: colors.textDim },

  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineSoft,
  },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { ...type.label, color: colors.text },
  toggleHint: {
    ...type.micro,
    fontSize: 9,
    color: colors.textFaint,
    lineHeight: 13,
  },

  clerkSlot: { marginTop: space.md, alignItems: "center" },
  footnote: {
    ...type.micro,
    fontSize: 9,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: space.xxl,
  },
});
