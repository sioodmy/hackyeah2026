import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import * as Haptics from "expo-haptics";
import { inviteCodePayloadSchema } from "@safecall/shared";

import { ScreenHeader } from "@/ui";
import { api } from "@/lib/api";
import { describe, useSafety } from "@/providers/SafetyProvider";
import { colors, radius, space, type } from "@/theme";

export default function ScanScreen() {
  const router = useRouter();
  const safety = useSafety();
  const [permission, requestPermission] = useCameraPermissions();

  const [scanned, setScanned] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onBarcode = useCallback(
    async (result: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);
      setStatus("sprawdzam kod…");
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      try {
        const raw = result.data.trim();
        const parsed = inviteCodePayloadSchema.safeParse(JSON.parse(raw));
        const code = parsed.success
          ? parsed.data.code
          : raw.replace(/^safecall:\/\/invite\//, "").trim();

        if (!/^[A-Z0-9-]{6,64}$/.test(code)) {
          throw new Error("To nie jest kod Safe Call");
        }

        const response = await api.redeemInvite({ code });
        setStatus(`dodano: ${response.contact.displayName}`);
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        await safety.refreshContacts();

        setTimeout(() => router.back(), 650);
      } catch (cause) {
        setError(describe(cause));
        setStatus(null);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setTimeout(() => {
          setScanned(false);
          setError(null);
        }, 2200);
      }
    },
    [router, safety, scanned],
  );

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.root}>
        <ScreenHeader title="Skanuj kod" />
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>Potrzebuję dostępu do kamery</Text>
          <Text style={styles.gateBody}>
            Bez niej nie dodasz znajomego. Kamerę używamy tylko do odczytania
            kodu.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={requestPermission}
            style={({ pressed }) => [
              styles.gateBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={styles.gateBtnText}>Włącz kamerę</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Skanuj kod" subtitle={status ?? undefined} />

      <View style={styles.viewport}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanned ? undefined : onBarcode}
        />

        <View style={styles.reticle} pointerEvents="none">
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
      </View>

      <View style={styles.footer}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.hint}>
          Skieruj kamerę na znakówkę znajomej w sekcji Znajomi.
        </Text>
      </View>
    </View>
  );
}

const BOX = 236;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
  gate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.md,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  gateBody: { ...type.body, color: colors.textDim, textAlign: "center" },
  gateBtn: {
    marginTop: space.lg,
    paddingHorizontal: space.xl,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  gateBtnText: { ...type.label, fontSize: 15, color: colors.void },

  viewport: {
    flex: 1,
    margin: space.xl,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: "#05070A",
    alignItems: "center",
    justifyContent: "center",
  },
  reticle: { width: BOX, height: BOX },
  corner: {
    position: "absolute",
    width: 34,
    height: 34,
    borderColor: colors.text,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: radius.sm,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: radius.sm,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: radius.sm,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: radius.sm,
  },

  footer: { padding: space.xl, gap: space.sm, alignItems: "center" },
  hint: {
    ...type.micro,
    fontSize: 9,
    color: colors.textFaint,
    textAlign: "center",
  },
  error: { ...type.micro, fontSize: 10, color: colors.l3, textAlign: "center" },
});
