import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Marker } from "react-native-maps";

import { colors, radius, type } from "@/theme";
import type { Contact } from "@safecall/shared";

interface Props {
  contact: Contact;
  onPress?: (contact: Contact) => void;
}

const STALE_MS = 45_000;

/** Friend pin: a soft disc that stays readable over a light OSM basemap. */
function FriendMarkerImpl({ contact, onPress }: Props) {
  const { location, displayName, avatarUrl } = contact;
  if (!location) return null;

  const stale =
    !location.updatedAt ||
    Date.now() - new Date(location.updatedAt).getTime() > STALE_MS;

  return (
    <Marker
      coordinate={{ latitude: location.lat, longitude: location.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={onPress ? () => onPress(contact) : undefined}
      tracksViewChanges={false}
      zIndex={9}
    >
      <View style={styles.wrap}>
        <View style={[styles.halo, stale && styles.haloStale]} />
        <View style={[styles.pin, stale && styles.pinStale]}>
          <Text style={styles.initial}>
            {avatarUrl ? "·" : (displayName.trim()[0] ?? "?").toUpperCase()}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

export const FriendMarker = memo(FriendMarkerImpl);

const PIN = 34;

const styles = StyleSheet.create({
  wrap: {
    width: PIN,
    height: PIN,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: PIN + 16,
    height: PIN + 16,
    borderRadius: (PIN + 16) / 2,
    backgroundColor: "rgba(23,28,34,0.22)",
    borderWidth: 1,
    borderColor: "rgba(23,28,34,0.28)",
  },
  haloStale: { backgroundColor: "rgba(120,128,138,0.14)" },
  pin: {
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  pinStale: { borderColor: colors.textFaint, opacity: 0.7 },
  initial: { ...type.label, color: colors.text, fontSize: 14 },
  chip: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    backgroundColor: "rgba(11,13,16,0.78)",
  },
});
