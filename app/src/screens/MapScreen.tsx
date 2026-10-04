import { CameraRef } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

import { MapCanvas } from '@/components/MapCanvas';
import { ThreatSlider } from '@/components/ThreatSlider';
import { IncomingCallOverlay } from '@/components/IncomingCallOverlay';
import { EvidenceIndicator } from '@/components/EvidenceIndicator';
import { useThreatLevel } from '@/hooks/useThreatLevel';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useLiveLocations } from '@/hooks/useLiveLocations';
import { useSmoothedLocations } from '@/hooks/useSmoothedLocations';
import { useEvidenceRecorder } from '@/hooks/useEvidenceRecorder';
import { useApi } from '@/lib/ApiContext';
import { useAuthToken } from '@/lib/useAuthToken';
import { ApiError, type HeatmapGeoJSON } from '@/lib/api';
import { colorForLevel, floatingShadow, palette, radii, spacing, type } from '@/theme';
import { THREAT_FULL, THREAT_SAFE, fakeCallPreview, hint, type ThreatLevel } from '@/theme/levels';

/**
 * A short Polish reason, trafiający do bannera błędu.
 *
 * The raw message would be an English FastAPI `detail` or a `TypeError` from
 * `fetch`, which reads as noise w tekście pisanym po polsku.
 */
function heatmapErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'wymagane logowanie';
    if (err.status === 403) return 'brak dostępu';
    if (err.status >= 500) return 'błąd serwera';
    return `błąd ${err.status}`;
  }
  return 'brak połączenia z API';
}

/**
 * The only screen that matters.
 *
 * Everything else is reachable by tapping the small pill in the corner, because
 * the main surface has to stay unremarkable: a map, and a slider at the bottom.
 *
 * Includes Kraków danger heatmap based on street harassment, sexual assault,
 * and dangerous situations.
 */
export function MapScreen() {
  const api = useApi();
  const getToken = useAuthToken();
  const insets = useSafeAreaInsets();

  const cameraRef = useRef<CameraRef>(null);
  const centredRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [previewLevel, setPreviewLevel] = useState<ThreatLevel | null>(null);

  // Kraków danger heatmap state. Warstwa jest zawsze włączona — przełącznik
  // zdjęty z mapy razem z przyciskami, żeby główny ekran był czysty.
  const [heatmapData, setHeatmapData] = useState<HeatmapGeoJSON | null>(null);

  const evidence = useEvidenceRecorder({ api });
  const lastBroadcastRef = useRef(0);

  // Location watching is always on; broadcasting only happens from level 2 up.
  const { position, permission } = useUserLocation({
    enabled: true,
    broadcast: false,
    onFix: useCallback(() => {
      if (!centredRef.current) centredRef.current = true;
    }, []),
  });

  const threat = useThreatLevel({
    api,
    getPosition: () => position,
    onAlertChange: useCallback(() => {
      setError(null);
    }, []),
  });

  const { locations, publish } = useLiveLocations({
    enabled: threat.isLive,
    getToken,
    selfId: null,
    fallbackPing: useCallback((payload) => api.pingLocation({ ...payload }), [api]),
  });

  const { points, staleSeconds } = useSmoothedLocations(locations);

  // Fetch heatmap data for Kraków
  const heatmapRequestRef = useRef(0);

  const loadHeatmap = useCallback(async () => {
    // Reloads can overlap (mount, post-report, retry), so only the newest answer is
    // allowed to write state; a slow failure must not overwrite a fresh success.
    const request = (heatmapRequestRef.current += 1);
    try {
      const data = await api.incidentHeatmap();
      if (request !== heatmapRequestRef.current) return;
      setHeatmapData(data);
    } catch (err) {
      if (request !== heatmapRequestRef.current) return;
      // Deliberately not silent: an unpainted map reads as "nobody reported
      // anything here", which is the one thing this layer must never imply.
      // Legenda zniknęła z UI, więc powód wjeżdża w istniejący banner błędu.
      setError(`Mapa zagrożeń: ${heatmapErrorText(err)}`);
    }
  }, [api]);

  useEffect(() => {
    void loadHeatmap();
  }, [loadHeatmap]);

  // Push our own position on the alert interval, not on every GPS fix.
  useEffect(() => {
    if (!threat.isLive || !position) return undefined;

    const tick = () => {
      const now = Date.now();
      if (now - lastBroadcastRef.current < 1_500) return;
      lastBroadcastRef.current = now;
      publish(position);
    };

    tick();
    const id = setInterval(tick, 1_500);
    return () => clearInterval(id);
  }, [position, publish, threat.isLive]);

  // Centre the camera once, on the first fix we actually have.
  useEffect(() => {
    if (!position || centredRef.current) return;
    centredRef.current = true;
    cameraRef.current?.easeTo({ center: [position.lng, position.lat], zoom: 15, duration: 900 });
  }, [position]);

  const recenter = useCallback(() => {
    if (!position) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    cameraRef.current?.easeTo({ center: [position.lng, position.lat], duration: 350 });
  }, [position]);

  // Evidence recording is armed by the backend opening a session at level 3,
  // and finalized the moment the level drops back to safe.
  useEffect(() => {
    if (threat.level === THREAT_FULL && threat.evidenceSessionId) {
      evidence.begin(threat.evidenceSessionId, threat.alert?.id ?? threat.evidenceSessionId);
      return;
    }
    if (threat.level === THREAT_SAFE) {
      void (async () => {
        await evidence.finalize(position ?? undefined);
        await evidence.disarm();
      })();
    }
  }, [evidence, position, threat.alert?.id, threat.evidenceSessionId, threat.level]);

  const handleCommit = useCallback(
    (next: number) => {
      void threat.commit(next as 0 | 1 | 2 | 3);
    },
    [threat],
  );

  const statusText = useMemo(() => {
    if (previewLevel !== null) {
      switch (previewLevel) {
        case 0:
          return 'Puść, aby anulować';
        case 1:
          return 'Poziom 1 · Telefon zadzwoni za 10 s';
        case 2:
          return 'Poziom 2 · Znajomi dostaną lokalizację';
        case 3:
          return 'Poziom 3 · Pełny alarm SOS + nagrywanie';
      }
    }
    if (threat.callPhase === 'waiting' && threat.countdown !== null) {
      return `Telefon zadzwoni za ${threat.countdown} s`;
    }
    if (threat.callPhase === 'ringing') return 'Połączenie przychodzące';
    if (threat.dispatch) return `Wezwano służby · ${threat.dispatch.caseId}`;
    return hint(threat.level);
  }, [previewLevel, threat.callPhase, threat.countdown, threat.dispatch, threat.level]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <MapCanvas
        friends={points}
        staleSeconds={staleSeconds}
        level={threat.level}
        cameraRef={cameraRef}
        heatmapData={heatmapData}
      />

      <View
        style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <View style={styles.rightGroup} pointerEvents="box-none">
          <EvidenceIndicator active={evidence.isRecording} uploading={evidence.isUploading} />
          <Pressable
            style={[styles.iconPill, floatingShadow(6)]}
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Ustawienia"
            hitSlop={10}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M3 6H21" stroke={palette.text} strokeWidth={1.8} strokeLinecap="round" />
              <Path d="M3 12H21" stroke={palette.text} strokeWidth={1.8} strokeLinecap="round" />
              <Path d="M3 18H21" stroke={palette.text} strokeWidth={1.8} strokeLinecap="round" />
              <Circle
                cx={9}
                cy={6}
                r={2.4}
                fill={palette.surfaceSolid}
                stroke={palette.text}
                strokeWidth={1.8}
              />
              <Circle
                cx={15}
                cy={12}
                r={2.4}
                fill={palette.surfaceSolid}
                stroke={palette.text}
                strokeWidth={1.8}
              />
              <Circle
                cx={7}
                cy={18}
                r={2.4}
                fill={palette.surfaceSolid}
                stroke={palette.text}
                strokeWidth={1.8}
              />
            </Svg>
          </Pressable>
        </View>
      </View>

      {permission === 'denied' ? (
        <View style={[styles.banner, { top: insets.top + 70 }]}>
          <Text style={styles.bannerText}>
            Bez dostępu do lokalizacji znajomi nie zobaczą, gdzie jesteś.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.banner, { top: insets.top + 70 }]}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}
        pointerEvents="box-none"
      >
        {/* Jedyna informacja o poziomie to wypełniony slider — label wjeżdża
            do jego środka po commicie. Osobna linijka statusu i ack-linia
            zostały zdjęte: duplikowały to, co widać na samym sliderze. */}
        <ThreatSlider
          onCommit={handleCommit}
          onDragLevelChange={setPreviewLevel}
          activeLevel={threat.level}
          caption={statusText || undefined}
        />

        {/* Kotwica do góry panelu dolnego (top: -(44 + 12)), nie sztywny
            offset od dołu ekranu — po zmianie slidera wysokość panelu się
            zmieniła i przycisk pływał. */}
        <Pressable
          style={({ pressed }) => [
            styles.recenter,
            floatingShadow(8),
            pressed && styles.recenterPressed,
          ]}
          onPress={recenter}
          accessibilityRole="button"
          accessibilityLabel="Wyśrodkuj na mojej lokalizacji"
          hitSlop={8}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Circle cx={12} cy={12} r={7} stroke={palette.text} strokeWidth={1.8} />
            <Circle cx={12} cy={12} r={2.5} fill={palette.text} />
            <Path d="M12 2V5" stroke={palette.text} strokeWidth={1.8} strokeLinecap="round" />
            <Path d="M12 19V22" stroke={palette.text} strokeWidth={1.8} strokeLinecap="round" />
            <Path d="M2 12H5" stroke={palette.text} strokeWidth={1.8} strokeLinecap="round" />
            <Path d="M19 12H22" stroke={palette.text} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <IncomingCallOverlay
        visible={threat.callPhase === 'ringing' || threat.callPhase === 'active'}
        level={threat.level}
        onAnswer={threat.answerCall}
        onDecline={() => threat.endCall(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.surfaceSolid,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    zIndex: 50,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  iconPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  banner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: 'rgba(214, 40, 40, 0.92)',
    zIndex: 80,
  },
  bannerText: {
    ...type.caption,
    color: '#FFFFFF',
  },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: spacing.sm,
  },
  recenter: {
    position: 'absolute',
    right: spacing.lg,
    top: -(44 + spacing.md),
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  recenterPressed: {
    backgroundColor: palette.surfaceRaised,
    transform: [{ scale: 0.92 }],
    opacity: 0.9,
  },
});
