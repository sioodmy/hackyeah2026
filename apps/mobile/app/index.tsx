import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Region } from "react-native-maps";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";

import {
  DangerSlider,
  DecoyCallOverlay,
  FALLBACK_REGION,
  FullAlertOverlay,
  MapCanvas,
  SettingsPill,
} from "@/components";
import { useSafety } from "@/providers/SafetyProvider";
import { useSession } from "@/providers/SessionProvider";
import { colors, radius, shadow, space, threatColor, type } from "@/theme";
import { THREAT_LEVEL_LABEL, type Contact } from "@safecall/shared";

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const safety = useSafety();

  const [region, setRegion] = useState<Region>(FALLBACK_REGION);
  const [selected, setSelected] = useState<Contact | null>(null);

  const accent =
    threatColor[safety.level > 0 ? safety.level : safety.previewLevel];

  const onRegionChange = useCallback((next: Region) => {
    setRegion((current) => {
      const moved =
        Math.abs(next.latitude - current.latitude) > 1e-6 ||
        Math.abs(next.longitude - current.longitude) > 1e-6;
      return moved ? next : current;
    });
  }, []);

  const hero = safety.friendAlerts[0];

  const dim = useMemo(() => {
    if (safety.level >= 3) return 0.45;
    if (safety.level === 2) return 0.28;
    return 0;
  }, [safety.level]);

  if (!session.isSignedIn) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.gateTitle}>Safe Call</Text>
        <Text style={styles.gateBody}>
          Zaloguj się, żeby Twoje znajomi widzieli, gdzie jesteś.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/sign-in")}
          style={({ pressed }) => [styles.gateBtn, pressed && { opacity: 0.8 }]}
        >
          <Text style={styles.gateBtnText}>Zaloguj się</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapCanvas
        region={region}
        onRegionChange={onRegionChange}
        contacts={safety.contacts}
        onSelectContact={setSelected}
        dim={dim}
      />

      <View
        style={[styles.topLeft, { top: insets.top + space.sm }]}
        pointerEvents="box-none"
      >
        <StatusStrip
          level={safety.level}
          connected={safety.connected}
          countdown={safety.countdown}
          friendCount={safety.contacts.length}
          accent={accent}
          busy={safety.busy}
        />

        {safety.contacts.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dodaj znajomego"
            onPress={() => {
              void Haptics.selectionAsync();
              router.push("/scan");
            }}
            style={({ pressed }) => [
              styles.addCard,
              pressed && { opacity: 0.8 },
            ]}
          >
            <MaterialCommunityIcons
              name="qrcode"
              size={16}
              color={colors.text}
            />
            <Text style={styles.addText}>Dodaj znajomego</Text>
          </Pressable>
        ) : null}

        {safety.friendAlerts
          .filter((item) => item.alert.level < 3)
          .slice(0, 1)
          .map((item) => (
            <Animated.View
              key={item.alert.id}
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(140)}
              style={styles.bannerWrap}
            >
              <FriendBanner
                name={item.contactName}
                level={item.alert.level}
                onPress={() =>
                  router.push({
                    pathname: "/alert/[id]",
                    params: { id: item.alert.id, name: item.contactName },
                  })
                }
                onDismiss={() => safety.acknowledgeFriendAlert(item.alert.id)}
              />
            </Animated.View>
          ))}
      </View>

      <SettingsPill
        badge={safety.contacts.length > 0 ? safety.contacts.length : undefined}
        alertAccent={safety.level > 0 ? accent : undefined}
      />

      {selected ? (
        <View style={[styles.sheet, { bottom: 236 }]}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setSelected(null)}
            style={styles.sheetClose}
          >
            <Text style={styles.sheetCloseText}>×</Text>
          </Pressable>
          <Text style={styles.sheetName}>{selected.displayName}</Text>
          <Text style={styles.sheetMeta}>
            {selected.location
              ? `${selected.location.lat.toFixed(4)}, ${selected.location.lng.toFixed(4)}`
              : "brak lokalizacji"}
          </Text>
        </View>
      ) : null}

      <DangerSlider
        level={safety.level}
        disabled={!safety.ready || safety.busy}
        onCommit={safety.commit}
        onPreview={safety.preview}
        onStandDown={() => void safety.standDown()}
      />

      <DecoyCallOverlay
        visible={safety.decoyCall?.visible ?? false}
        callerName="Mama"
        callerNumber="+48 600 100 200"
        hint="mówi, że musisz zjeść obiad — pretekst, żeby wyjść"
        onAccept={safety.dismissDecoy}
        onDecline={safety.dismissDecoy}
      />

      <FullAlertOverlay
        visible={hero?.alert.level === 3}
        contactName={hero?.contactName ?? ""}
        level={hero?.alert.level ?? 3}
        dispatched={hero?.dispatched ?? false}
        callMe={hero?.callMe ?? true}
        locationLabel={
          hero?.alert.location
            ? `${hero.alert.location.lat.toFixed(5)}, ${hero.alert.location.lng.toFixed(5)}`
            : "lokalizacja niedostępna"
        }
        dispatchedReference={hero?.alert.dispatchReference}
        onAcknowledge={() => {
          if (hero) safety.acknowledgeFriendAlert(hero.alert.id);
        }}
        onCall={() => {
          if (hero) safety.acknowledgeFriendAlert(hero.alert.id);
        }}
      />
    </View>
  );
}

function StatusStrip({
  level,
  connected,
  countdown,
  friendCount,
  accent,
  busy,
}: {
  level: number;
  connected: boolean;
  countdown: number | null;
  friendCount: number;
  accent: string;
  busy: boolean;
}) {
  return (
    <View style={styles.strip}>
      <View style={styles.stripRow}>
        <View style={[styles.stripDot, { backgroundColor: accent }]} />
        <Text style={styles.stripLabel} numberOfLines={1}>
          {busy ? "wysyłam…" : THREAT_LEVEL_LABEL[level as 0 | 1 | 2 | 3]}
        </Text>
      </View>

      {countdown !== null && level > 0 ? (
        <Text style={styles.stripCount}>połączenie za {countdown}s</Text>
      ) : null}

      <Text style={styles.stripMeta}>
        {friendCount > 0
          ? `${friendCount} znajomych · ${connected ? "live" : "offline"}`
          : connected
            ? "live"
            : "brak kontaktu z serwerem"}
      </Text>
    </View>
  );
}

function FriendBanner({
  name,
  level,
  onPress,
  onDismiss,
}: {
  name: string;
  level: number;
  onPress: () => void;
  onDismiss: () => void;
}) {
  const accent = threatColor[level === 2 ? 2 : 1];
  return (
    <View style={[styles.banner, { borderColor: accent }]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={styles.bannerHit}
      >
        <Text style={[styles.bannerTitle, { color: accent }]}>
          {name} potrzebuje pomocy
        </Text>
        <Text style={styles.bannerBody}>
          dotknij, aby zobaczyć szczegóły i zadzwonić
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ukryj"
        onPress={onDismiss}
        style={styles.bannerClose}
      >
        <Text style={styles.bannerCloseText}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.void },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: space.xl,
    gap: space.md,
  },

  gateTitle: { fontSize: 30, fontWeight: "700", color: colors.text },
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

  topLeft: {
    position: "absolute",
    left: space.lg,
    right: 78,
    zIndex: 15,
    gap: space.sm,
  },
  strip: {
    alignSelf: "flex-start",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    backgroundColor: "rgba(13,16,20,0.74)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 2,
    ...shadow.soft,
  },
  stripRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  stripDot: { width: 8, height: 8, borderRadius: 4 },
  stripLabel: { ...type.label, color: colors.text, fontSize: 12 },
  stripCount: { ...type.micro, color: colors.textDim },
  stripMeta: { ...type.micro, color: colors.textFaint },

  addCard: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.void,
    ...shadow.soft,
  },
  addText: { ...type.micro, color: colors.text },

  bannerWrap: { marginTop: space.xs },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    backgroundColor: "rgba(13,16,20,0.86)",
    paddingLeft: space.md,
    ...shadow.soft,
  },
  bannerHit: { flex: 1, paddingVertical: space.md },
  bannerTitle: { ...type.label, fontSize: 13 },
  bannerBody: { ...type.micro, color: colors.textDim, marginTop: 2 },
  bannerClose: { paddingHorizontal: space.md, paddingVertical: space.md },
  bannerCloseText: { color: colors.textFaint, fontSize: 18 },

  sheet: {
    position: "absolute",
    left: space.lg,
    right: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: "rgba(18,22,27,0.94)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    ...shadow.lift,
  },
  sheetClose: { position: "absolute", top: space.sm, right: space.md },
  sheetCloseText: { color: colors.textFaint, fontSize: 22 },
  sheetName: { ...type.label, fontSize: 16, color: colors.text },
  sheetMeta: { ...type.micro, color: colors.textFaint, marginTop: 4 },
});
