import { CameraRef } from '@maplibre/maplibre-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { MapCanvas } from '@/components/MapCanvas';
import { ThreatSlider } from '@/components/ThreatSlider';
import { IncomingCallOverlay } from '@/components/IncomingCallOverlay';
import { EvidenceIndicator } from '@/components/EvidenceIndicator';
import { HeatmapLegend } from '@/components/HeatmapLegend';
import { IncidentReportModal } from '@/components/IncidentReportModal';
import { useThreatLevel } from '@/hooks/useThreatLevel';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useLiveLocations } from '@/hooks/useLiveLocations';
import { useSmoothedLocations } from '@/hooks/useSmoothedLocations';
import { useEvidenceRecorder } from '@/hooks/useEvidenceRecorder';
import { useApi } from '@/lib/ApiContext';
import { useAuthToken } from '@/lib/useAuthToken';
import { avatarEmoji } from '@/lib/avatar';
import type { HeatmapGeoJSON, ReportIncidentInput } from '@/lib/api';
import { colorForLevel, floatingShadow, palette, radii, spacing, type } from '@/theme';
import { THREAT_FULL, THREAT_SAFE, hint, label, type ThreatLevel } from '@/theme/levels';

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
  const [profile, setProfile] = useState<{
    displayName: string | null;
    avatarUrl: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .myProfile()
      .then((p) => {
        if (!cancelled) setProfile({ displayName: p.displayName, avatarUrl: p.avatarUrl });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api]);

  // Kraków danger heatmap state
  const [heatmapData, setHeatmapData] = useState<HeatmapGeoJSON | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showLegend, setShowLegend] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

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

  // Fetch heatmap data for Kraków
  const loadHeatmap = useCallback(async () => {
    try {
      const data = await api.incidentHeatmap();
      setHeatmapData(data);
    } catch {
      // quiet fallback
    }
  }, [api]);

  useEffect(() => {
    void loadHeatmap();
  }, [loadHeatmap]);

  // The response is one feature per ~200 m grid cell, so counting features would
  // report the number of occupied cells as if it were the number of reports.
  const { totalReported, hottestCells } = useMemo(() => {
    const cells = heatmapData?.features ?? [];
    return {
      totalReported: cells.reduce((sum, feature) => sum + feature.properties.count, 0),
      hottestCells: cells.slice(0, 3).map((feature) => ({
        lat: feature.geometry.coordinates[1],
        lng: feature.geometry.coordinates[0],
        count: feature.properties.count,
        severity: feature.properties.severity,
      })),
    };
  }, [heatmapData]);

  const handleReportIncident = useCallback(
    async (data: ReportIncidentInput) => {
      await api.reportIncident(data);
      await loadHeatmap();
    },
    [api, loadHeatmap],
  );

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

  const statusColor = useMemo(() => {
    if (previewLevel !== null && previewLevel > 0) {
      return colorForLevel(previewLevel);
    }
    if (threat.level > 0) {
      return colorForLevel(threat.level);
    }
    return palette.textMuted;
  }, [previewLevel, threat.level]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <MapCanvas
        friends={points}
        staleSeconds={staleSeconds}
        level={threat.level}
        cameraRef={cameraRef}
        showHeatmap={showHeatmap}
        heatmapData={heatmapData}
      />

      <View
        style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <View style={styles.leftGroup} pointerEvents="box-none">
          {threat.level > THREAT_SAFE ? (
            <View style={[styles.statusPill, floatingShadow(6)]}>
              <View style={[styles.statusDot, { backgroundColor: colorForLevel(threat.level) }]} />
              <Text style={styles.statusText}>{label(threat.level)}</Text>
            </View>
          ) : (
            <Pressable
              style={[styles.profilePill, floatingShadow(6)]}
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Twój profil i awatar"
              hitSlop={8}
            >
              <View style={styles.profileAvatarDisc}>
                <Text style={styles.profileAvatarEmoji}>{avatarEmoji(profile?.avatarUrl)}</Text>
              </View>
              <Text style={styles.profileName} numberOfLines={1}>
                {profile?.displayName || 'Twój profil'}
              </Text>
            </Pressable>
          )}

          {/* Kraków Danger Heatmap Toggle Pill */}
          <Pressable
            style={[styles.heatmapPill, showHeatmap && styles.heatmapPillActive, floatingShadow(6)]}
            onPress={() => {
              setShowHeatmap((prev) => !prev);
              setShowLegend((prev) => !prev);
            }}
            accessibilityRole="button"
            accessibilityLabel="Strefy zagrożenia Kraków"
          >
            <Text style={styles.heatmapPillIcon}>🔥</Text>
            <Text style={[styles.heatmapPillText, showHeatmap && styles.heatmapPillTextActive]}>
              Zagrożenia
            </Text>
          </Pressable>

          {/* Quick Danger Report Button */}
          <Pressable
            style={[styles.reportPill, floatingShadow(6)]}
            onPress={() => setShowReportModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Zgłoś niebezpieczeństwo"
          >
            <Text style={styles.reportPillText}>+ Zgłoś</Text>
          </Pressable>
        </View>

        <View style={styles.rightGroup} pointerEvents="box-none">
          <EvidenceIndicator active={evidence.isRecording} uploading={evidence.isUploading} />
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
      </View>

      {/* Heatmap Legend Card */}
      <HeatmapLegend
        visible={showLegend}
        totalIncidents={totalReported}
        hottestCells={hottestCells}
        onClose={() => setShowLegend(false)}
        onOpenReport={() => {
          setShowLegend(false);
          setShowReportModal(true);
        }}
      />

      {/* Incident Reporting Sheet */}
      <IncidentReportModal
        visible={showReportModal}
        userCoords={position ? [position.lng, position.lat] : null}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportIncident}
      />

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

      <View
        style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}
        pointerEvents="box-none"
      >
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#111317" stopOpacity="0" />
              <Stop offset="0.45" stopColor="#111317" stopOpacity="0.8" />
              <Stop offset="1" stopColor="#111317" stopOpacity="0.98" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#bottomFade)" />
        </Svg>

        <View style={styles.statusRow}>
          <Text style={[styles.statusLine, { color: statusColor }]}>{statusText}</Text>
          {connected ? (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>live</Text>
            </View>
          ) : null}
        </View>

        <ThreatSlider
          onCommit={handleCommit}
          onDragLevelChange={setPreviewLevel}
          activeLevel={threat.level}
        />
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
    zIndex: 50,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 3,
    paddingLeft: 4,
    paddingRight: spacing.md,
    height: 42,
    borderRadius: radii.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  profileAvatarDisc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#161922',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: palette.level2,
  },
  profileAvatarEmoji: {
    fontSize: 17,
    lineHeight: 22,
  },
  profileName: {
    ...type.label,
    color: palette.text,
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 120,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
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
  heatmapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  heatmapPillActive: {
    backgroundColor: 'rgba(214, 40, 40, 0.16)',
    borderColor: 'rgba(214, 40, 40, 0.45)',
  },
  heatmapPillIcon: {
    fontSize: 14,
  },
  heatmapPillText: {
    ...type.label,
    fontSize: 12,
    color: palette.textMuted,
  },
  heatmapPillTextActive: {
    color: '#FF8A80',
    fontWeight: '600',
  },
  reportPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  reportPillText: {
    ...type.label,
    fontSize: 12,
    color: palette.text,
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
    paddingTop: spacing.xl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg + 2,
    paddingBottom: spacing.sm + 2,
  },
  statusLine: {
    ...type.caption,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.success,
  },
  liveText: {
    ...type.caption,
    color: palette.success,
    fontWeight: '600',
    fontSize: 12,
  },
  recenter: {
    position: 'absolute',
    right: spacing.lg,
    bottom: 154,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
  },
  recenterGlyph: {
    fontSize: 18,
    color: palette.text,
  },
});
