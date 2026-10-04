/**
 * Webowy odpowiednik app/src/components/MapCanvas (+ FriendMapMarker).
 * Ten sam styl rastrowy CARTO dark, ta sama rampa heatmapy co warstwa
 * `danger-heatmap-layer` w MapCanvas (stopy 0 / 0.08 / 0.25 / 0.5 / 0.75 / 1.0).
 */
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { DARK_VECTOR_STYLE_URL, DEFAULT_CENTER, DEFAULT_ZOOM, colorForLevel } from "../theme";
import type { HeatmapCell, MockFriend } from "../mock";
import type { ThreatLevel } from "../theme";

type Props = {
  friends: MockFriend[];
  level: ThreatLevel;
  showHeatmap: boolean;
  heatmap: HeatmapCell[];
  recenterTick: number;
};

function heatmapGeoJSON(cells: HeatmapCell[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: cells.map((c, i) => ({
      type: "Feature" as const,
      id: i,
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
      properties: {
        count: c.count,
        weight: c.weight,
        severity: c.severity,
        category: c.category,
        categoryLabel: c.categoryLabel,
      },
    })),
  };
}

export function MapView({ friends, level, showHeatmap, heatmap, recenterTick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const readyRef = useRef(false);

  // Init mapy raz.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Styl wektorowy z URL-a: kafelki wektorowe + glify + sprite ładuje sama
    // maplibre. Atrybucja: © OpenFreeMap © OpenMapTiles, dane © OpenStreetMap.
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_VECTOR_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on("load", () => {
      readyRef.current = true;
      map.addSource("danger-heatmap", { type: "geojson", data: heatmapGeoJSON(heatmap) });
      map.addLayer({
        id: "danger-heatmap-layer",
        type: "heatmap",
        source: "danger-heatmap",
        minzoom: 8,
        maxzoom: 19,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "weight"], 0, 0, 1, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 13, 1.5, 16, 2.8],
          // Tylko czerwień, bez żółtego: przy tej niskiej alphie żółty składał się
          // z szarości i wychodził brązowy. Zaczyna się przezroczysty pomarańcz.
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(0, 0, 0, 0)",
            0.15,
            "rgba(214, 87, 40, 0.16)",
            0.35,
            "rgba(206, 47, 32, 0.30)",
            0.6,
            "rgba(190, 26, 32, 0.46)",
            0.8,
            "rgba(160, 16, 30, 0.60)",
            1.0,
            "rgba(122, 8, 26, 0.72)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 9, 14, 12, 24, 15, 36, 17, 50],
          "heatmap-opacity": 0.34,
        },
      });
      map.addSource("friends-halo", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "friends-halo-layer",
        type: "circle",
        source: "friends-halo",
        paint: {
          "circle-radius": 18,
          "circle-color": colorForLevel(level),
          "circle-opacity": 0.35,
          "circle-blur": 0.45,
        },
      });
      // Własna pozycja — niebieski puck jak UserLocation w MapCanvas.
      const puck = document.createElement("div");
      puck.className = "user-puck";
      new maplibregl.Marker({ element: puck }).setLngLat(DEFAULT_CENTER).addTo(map);
      // Wymuś odświeżenie warstw po inicjalizacji.
      syncRef.current?.();
    });
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronizacja warstw + markerów — trzymana w refie, żeby listener 'load' mógł ją wywołać.
  const syncRef = useRef<(() => void) | null>(null);
  syncRef.current = () => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const heat = map.getSource("danger-heatmap") as maplibregl.GeoJSONSource | undefined;
    heat?.setData(heatmapGeoJSON(heatmap));
    map.setLayoutProperty("danger-heatmap-layer", "visibility", showHeatmap ? "visible" : "none");

    const halo = map.getSource("friends-halo") as maplibregl.GeoJSONSource | undefined;
    halo?.setData({
      type: "FeatureCollection",
      features: friends.map((f) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [f.lng, f.lat] },
        properties: { id: f.userId },
      })),
    });
    map.setPaintProperty("friends-halo-layer", "circle-color", colorForLevel(level));

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = friends.map((f) => {
      const el = document.createElement("div");
      el.className = "friend-marker" + (f.stale ? " is-stale" : "");
      el.style.setProperty("--aura", f.aura);
      el.innerHTML = `<span class="friend-marker-emoji">${f.emoji}</span><span class="friend-marker-name">${f.displayName}</span>`;
      return new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([f.lng, f.lat])
        .addTo(map);
    });
  };

  useEffect(() => {
    syncRef.current?.();
  }, [friends, level, showHeatmap, heatmap]);

  useEffect(() => {
    if (recenterTick === 0) return;
    mapRef.current?.easeTo({ center: DEFAULT_CENTER, duration: 350 });
  }, [recenterTick]);

  return <div ref={containerRef} className="mapview" />;
}
