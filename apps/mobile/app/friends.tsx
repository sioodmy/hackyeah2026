import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useIsFocused } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import type { CreateInviteResponse } from "@safecall/shared";

import { PrimaryButton, Row, ScreenHeader } from "@/ui";
import { api } from "@/lib/api";
import { describe, useSafety } from "@/providers/SafetyProvider";
import { colors, radius, space, type } from "@/theme";

const QR_BOX = 208;

export default function FriendsScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const safety = useSafety();

  const [invite, setInvite] = useState<CreateInviteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvite = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInvite(await api.createInvite());
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (focused) void loadInvite();
  }, [focused, loadInvite]);

  const remove = useCallback(
    (contactId: string, name: string) => {
      Alert.alert("Usunąć znajomego?", name, [
        { text: "Anuluj", style: "cancel" },
        {
          text: "Usuń",
          style: "destructive",
          onPress: () => {
            void api
              .removeContact(contactId)
              .then(() => {
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
                void safety.refreshContacts();
              })
              .catch((cause: unknown) => setError(describe(cause)));
          },
        },
      ]);
    },
    [safety],
  );

  const copyCode = useCallback(() => {
    if (!invite) return;
    void Clipboard.setStringAsync(`${invite.code}`).then(
      () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    );
  }, [invite]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Znajomi" subtitle="sparuj się przez QR" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.section}>TWOJA ZNAKÓWKA</Text>
        <View style={styles.qrCard}>
          {invite ? (
            <QRCode
              value={JSON.stringify(invite.payload)}
              size={QR_BOX}
              backgroundColor="#FFFFFF"
              color="#0B0D10"
            />
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text style={styles.qrPlaceholderText}>
                {loading ? "generuję…" : "brak kodu"}
              </Text>
            </View>
          )}

          <Text style={styles.code}>{invite?.code ?? "————"}</Text>
          <Text style={styles.qrHint}>
            Każdy kód jest jednorazowy i wygasa po godzinie.
          </Text>

          <View style={styles.qrActions}>
            <PrimaryButton
              label="Odśwież kod"
              tone="ghost"
              accent={colors.text}
              onPress={() => void loadInvite()}
              style={styles.qrBtn}
            />
          </View>
        </View>

        <PrimaryButton
          label="Skanuj kod znajomego"
          accent={colors.text}
          onPress={() => router.push("/scan")}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.section}>ZNAJOMI · {safety.contacts.length}</Text>
        <View style={styles.stack}>
          {safety.contacts.length === 0 ? (
            <Text style={styles.empty}>
              Nikogo jeszcze nie ma. Zeskanuj kod znajomej albo pokaż swój.
            </Text>
          ) : (
            safety.contacts.map((contact) => (
              <Row
                key={contact.id}
                accent={colors.safe}
                label={contact.displayName}
                detail={
                  contact.location
                    ? `live · ${contact.location.lat.toFixed(3)}, ${contact.location.lng.toFixed(3)}`
                    : "brak lokalizacji"
                }
              />
            ))
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skopiuj kod zaproszenia"
          onPress={copyCode}
          disabled={!invite}
          style={styles.copy}
        >
          <MaterialCommunityIcons
            name="qrcode"
            size={14}
            color={colors.textFaint}
          />
          <Text style={styles.copyText}>Skopiuj kod zaproszenia</Text>
        </Pressable>
      </ScrollView>
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

  qrCard: {
    alignItems: "center",
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineSoft,
  },
  qrPlaceholder: {
    width: QR_BOX,
    height: QR_BOX,
    borderRadius: radius.md,
    backgroundColor: colors.hairlineSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  qrPlaceholderText: { ...type.micro, color: colors.textFaint },
  code: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 5,
    fontVariant: ["tabular-nums"],
  },
  qrHint: {
    ...type.micro,
    fontSize: 9,
    color: colors.textFaint,
    textAlign: "center",
  },
  qrActions: { alignSelf: "stretch" },
  qrBtn: { height: 46 },

  stack: { gap: space.sm },
  empty: { ...type.body, color: colors.textFaint, lineHeight: 21 },

  error: { ...type.micro, fontSize: 10, color: colors.l3, textAlign: "center" },

  copy: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingVertical: space.lg,
    marginTop: space.lg,
  },
  copyText: { ...type.micro, color: colors.textFaint },
});
