import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { UrlTile, type Region } from "react-native-maps";

import { config } from "@/lib/env";
import type { Contact } from "@safecall/shared";
import { FriendMarker } from "./FriendMarker";

/** Warsaw, used until the real fix arrives. */
export const FALLBACK_REGION: Region = {
  latitude: 52.2297,
  longitude: 21.0122,
  latitudeDelta: 0.012,
  longitudeDelta: 0.012,
};

interface Props {
  region: Region;
  onRegionChange: (region: Region) => void;
  contacts: Contact[];
  onSelectContact?: (contact: Contact) => void;
  /** Dim overlay strength, 0..1, so the map recedes while an alert is live. */
  dim?: number;
  children?: React.ReactNode;
}

/**
 * Full-bleed OSM raster map. `mapType="none"` blanks the platform basemap so the
 * only thing on screen is the OSM-derived tile layer, which keeps the app from
 * reading as a different kind of map and needs no Google Maps API key.
 */
function MapCanvasImpl({
  region,
  onRegionChange,
  contacts,
  onSelectContact,
  dim = 0,
  children,
}: Props) {
  const showsMyLocation = useMemo(() => true, []);

  return (
    <View style={styles.root}>
      <MapView
        initialRegion={region}
        region={region}
        onRegionChangeComplete={onRegionChange}
        mapType="none"
        showsMyLocationButton={false}
        showsUserLocation={showsMyLocation}
        showsCompass={false}
        showsScale={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        zoomControlEnabled={false}
        loadingEnabled
        loadingIndicatorColor="#98A1AC"
        loadingBackgroundColor="#0B0D10"
        moveOnMarkerPress={false}
      >
        <UrlTile
          urlTemplate={config.tileUrl}
          maximumZ={config.tileMaxZoom}
          maximumNativeZ={config.tileMaxZoom}
          flipY={false}
          doubleTileSize
          opacity={1}
        />

        {contacts.map((contact) => (
          <FriendMarker
            key={contact.id}
            contact={contact}
            onPress={onSelectContact}
          />
        ))}
      </MapView>

      {dim > 0 ? (
        <View pointerEvents="none" style={[styles.dim, { opacity: dim }]} />
      ) : null}

      {children}
    </View>
  );
}

export const MapCanvas = memo(MapCanvasImpl);

const FILL = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as const;

const styles = StyleSheet.create({
  root: { ...FILL, backgroundColor: "#0B0D10" },
  map: { flex: 1 },
  dim: { ...FILL, backgroundColor: "#05070A" },
});
