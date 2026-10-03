import { CameraRef } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

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
import { colorForLevel, floatingShadow, palette, radii, spacing, type } from '@/theme';
import { THREAT_FULL, THREAT_SAFE, hint, label } from '@/theme/levels';

/**
 * The only screen that matters.
 *
 * Everything else is reachable by tapping the small pill in the corner, because
 * the main surface has to stay unremarkable: a map, and a slider at the bottom.
 */
export function MapScreen() {
  const api = useApi();
  const getToken = useAuthToken();
  const insets = useSafeAreaInsets();

  const cameraRef = useRef<CameraRef>(null);
  const centredRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

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

  const { locations, connected, publish } = useLiveLocations({
    enabled: threat.isLive,
    getToken,
    selfId: null,
    fallbackPing: useCallback((payload) => api.pingLocation({ ...payload }), [api]),
  });

  const { points, staleSeconds } = useSmoothedLocations(locations);

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
    if (threat.callPhase === 'waiting' && threat.countdown !== null) {
      return `Telefon zadzwoni za ${threat.countdown} s`;
    }
    if (threat.callPhase === 'ringing') return 'Połączenie przychodzące';
    if (threat.dispatch) return `Wezwano służby · ${threat.dispatch.caseId}`;
    return hint(threat.level);
  }, [threat.callPhase, threat.countdown, threat.dispatch, threat.level]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <MapCanvas friends={points} level={threat.level} cameraRef={cameraRef} />

      <View
        style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <View style={styles.pillGroup} pointerEvents="box-none">
          {threat.level > THREAT_SAFE ? (
            <View style={[styles.statusPill, floatingShadow(6)]}>
              <View style={[styles.statusDot, { backgroundColor: colorForLevel(threat.level) }]} />
              <Text style={styles.statusText}>{label(threat.level)}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.iconPill, floatingShadow(6)]}
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Ustawienia"
            hitSlop={10}
          >
            <Text style={styles.iconGlyph}>⚙</Text>
          </Pressable>
        </View>

        <EvidenceIndicator active={evidence.isRecording} uploading={evidence.isUploading} />
      </View>

      {permission === 'denied' ? (
        <View style={[styles.banner, { top: insets.top + 70 }]}>
          <Text style={styles.bannerText}>
            Bez dostępu do lokalizacji znajomi nie zobaczą gdzie jesteś.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.banner, { top: insets.top + 70 }]}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLine}>{statusText}</Text>
          {connected ? <Text style={styles.connected}>● live</Text> : null}
        </View>

        <ThreatSlider onCommit={handleCommit} activeLevel={threat.level} />
      </View>

      <Pressable style={styles.recenter} onPress={recenter} accessibilityRole="button">
        <Text style={styles.recenterGlyph}>◎</Text>
      </Pressable>

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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: palette.surface,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...type.label,
    color: palette.text,
  },
  iconPill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  iconGlyph: {
    fontSize: 19,
    color: palette.text,
  },
  banner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: 'rgba(214, 40, 40, 0.92)',
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
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  statusLine: {
    ...type.caption,
    color: palette.textMuted,
  },
  connected: {
    ...type.caption,
    color: palette.success,
  },
  recenter: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 150,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
  },
  recenterGlyph: {
    fontSize: 18,
    color: palette.text,
  },
});
