import { useEffect, useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { PrimaryButton, ScreenHeader } from "@/ui";
import { api } from "@/lib/api";
import { describe, useSafety } from "@/providers/SafetyProvider";
import { colors, radius, space, threatColor, type } from "@/theme";
import type { Alert as AlertRecord } from "@safecall/shared";

export default function AlertDetailScreen() {
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const safety = useSafety();

  const fromRealtime = useMemo(
    () => safety.friendAlerts.find((item) => item.alert.id === params.id),
    [params.id, safety.friendAlerts],
  );

  const [record, setRecord] = useState<AlertRecord | null>(
    fromRealtime?.alert ?? null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fromRealtime) setRecord(fromRealtime.alert);
  }, [fromRealtime]);

  useEffect(() => {
    if (!params.id || record) return;
    let cancelled = false;
    void api
      .alerts()
      .then((list) => {
        if (cancelled) return;
        setRecord(list.find((item) => item.id === params.id) ?? null);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describe(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, record]);

  const level = record?.level ?? 3;
  const accent = threatColor[level];

  return (
    <View style={[styles.root, { borderColor: accent }]}>
      <ScreenHeader
        title={params.name ?? fromRealtime?.contactName ?? "Alarm"}
        subtitle={`poziom ${level}`}
      />

      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: accent }]}>
          <Text style={styles.badgeText}>POZIOM {level}</Text>
        </View>

        <Text style={styles.headline}>
          {level === 3 ? "wymaga natychmiastowej reakcji" : "prosi o telefon"}
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>LOKALIZACJA</Text>
          <Text style={styles.cardValue}>
            {record?.location
              ? `${record.location.lat.toFixed(5)}, ${record.location.lng.toFixed(5)}`
              : "brak"}
          </Text>
          {record?.place ? (
            <Text style={styles.cardNote}>{record.place}</Text>
          ) : null}
          {record?.dispatchedAt ? (
            <Text style={[styles.cardNote, { color: colors.l3 }]}>
              służby powiadomione · {record.dispatchReference}
            </Text>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <PrimaryButton
            label="Zadzwoń"
            accent={colors.l3}
            onPress={() => {
              void Linking.openURL("tel:112");
            }}
          />
          <PrimaryButton
            label="Widzę alarm"
            tone="ghost"
            accent={colors.textDim}
            onPress={() => {
              if (params.id) safety.acknowledgeFriendAlert(params.id);
            }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
  body: { flex: 1, padding: space.xl, gap: space.lg },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  badgeText: { ...type.micro, fontSize: 9, color: colors.void },
  headline: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    lineHeight: 32,
  },
  card: {
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineSoft,
    gap: 4,
  },
  cardLabel: { ...type.micro, color: colors.textFaint },
  cardValue: { ...type.body, fontSize: 18, color: colors.text },
  cardNote: {
    ...type.micro,
    fontSize: 10,
    color: colors.textDim,
    marginTop: 2,
  },
  error: { ...type.micro, fontSize: 10, color: colors.l3 },
  actions: { marginTop: "auto", gap: space.md },
});
