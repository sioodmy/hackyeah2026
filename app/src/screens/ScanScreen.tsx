import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { palette, radii, spacing, type } from '@/theme';
import { useApi } from '@/lib/ApiContext';

/**
 * Scanning a friend's QR code, with a typed-code fallback.
 *
 * The camera is released the moment we get a payload that the server accepts,
 * so a rejected code does not leave the lens running in someone's pocket.
 */
export function ScanScreen() {
  const api = useApi();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [manual, setManual] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');
  const [busy, setBusy] = useState(false);
  const [handled, setHandled] = useState(false);

  const submit = useCallback(
    async (payload: string) => {
      if (busy) return;
      setBusy(true);
      setStatus('Łączenie ze znajomą…');
      setStatusType('info');
      try {
        const friend = await api.scanInvite(payload.trim());
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setStatusType('success');
        setStatus(
          friend.status === 'accepted'
            ? `Połączono z ${friend.displayName ?? 'znajomą'}!`
            : 'Zaproszenie wysłane, poczekaj na akceptację.',
        );
        setTimeout(() => router.back(), 1100);
      } catch (err) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setHandled(false);
        setStatusType('error');
        setStatus(err instanceof Error ? err.message : 'Nie udało się połączyć ze znajomą.');
      } finally {
        setBusy(false);
      }
    },
    [api, busy],
  );

  const onScan = useCallback(
    (result: BarcodeScanningResult) => {
      if (handled) return;
      setHandled(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      void submit(result.data);
    },
    [handled, submit],
  );

  if (!permission) {
    return (
      <View style={[styles.root, styles.loadingRoot]}>
        <ActivityIndicator size="large" color={palette.level2} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.root}>
        {/* Top Header */}
        <View style={[styles.navHeader, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.navBackButton}
            accessibilityRole="button"
            accessibilityLabel="Wróć"
          >
            <Text style={styles.navBackChevron}>‹</Text>
          </Pressable>
          <Text style={styles.navHeaderTitle}>Skanuj kod</Text>
          <View style={styles.navHeaderSpacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.avoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: insets.bottom + spacing.xl },
            ]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Main Permission Card */}
            <View style={styles.card}>
              <CameraGraphic />

              <Text style={styles.heroTitle}>Dostęp do aparatu</Text>
              <Text style={styles.heroSubtitle}>
                Aparat jest potrzebny, aby odczytać kod QR z telefonu znajomej i połączyć Wasze
                profile.
              </Text>

              {/* Trust feature points */}
              <View style={styles.trustList}>
                <View style={styles.trustItem}>
                  <View style={styles.trustIconBadge}>
                    <Text style={styles.trustEmoji}>📷</Text>
                  </View>
                  <View style={styles.trustTextCol}>
                    <Text style={styles.trustHeading}>Tylko odczyt kodu QR</Text>
                    <Text style={styles.trustSubtext}>
                      Kamera działa wyłącznie w tym oknie. Aplikacja nie rejestruje ani nie zapisuje
                      zdjęć ani filmów.
                    </Text>
                  </View>
                </View>

                <View style={styles.trustItem}>
                  <View style={styles.trustIconBadge}>
                    <Text style={styles.trustEmoji}>🔒</Text>
                  </View>
                  <View style={styles.trustTextCol}>
                    <Text style={styles.trustHeading}>Szybkie i bezpieczne parowanie</Text>
                    <Text style={styles.trustSubtext}>
                      Kod QR jest podpisywany cyfrowo. Po wykryciu kodu aparat od razu się zamyka.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Button: request or open settings */}
              {permission.canAskAgain ? (
                <Pressable
                  style={styles.primaryActionButton}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    void requestPermission();
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryActionButtonText}>Zezwól na dostęp do aparatu</Text>
                </Pressable>
              ) : (
                <View style={styles.settingsAlertBox}>
                  <Text style={styles.settingsAlertText}>
                    Dostęp do aparatu został zablokowany w ustawieniach telefonu. Odblokuj
                    uprawnienie, aby skanować kod QR.
                  </Text>
                  <Pressable
                    style={styles.primaryActionButton}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                      void Linking.openSettings().catch(() => {});
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryActionButtonText}>Otwórz Ustawienia telefonu</Text>
                  </Pressable>
                  <Pressable
                    style={styles.retryButton}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      void requestPermission();
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryButtonText}>Sprawdź ponownie</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* Manual Code Fallback Section */}
            <View style={styles.card}>
              <View style={styles.manualHeader}>
                <Text style={styles.manualCardTitle}>Nie chcesz włączać kamery?</Text>
                <Text style={styles.manualCardSubtitle}>
                  Wpisz 6-znakowy kod wyświetlany pod kodem QR na ekranie znajomej.
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <TextInput
                  value={manual}
                  onChangeText={(text) => {
                    setManual(text.toUpperCase());
                    if (status) setStatus(null);
                  }}
                  placeholder="ABC234"
                  placeholderTextColor={palette.textFaint}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  style={styles.manualInputField}
                  onSubmitEditing={() => void submit(manual)}
                  returnKeyType="done"
                  accessibilityLabel="Sześcioliterowy kod znajomej"
                />
                <Pressable
                  style={[
                    styles.connectButton,
                    (manual.trim().length !== 6 || busy) && styles.connectButtonDisabled,
                  ]}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    void submit(manual);
                  }}
                  disabled={manual.trim().length !== 6 || busy}
                  accessibilityRole="button"
                >
                  {busy ? (
                    <ActivityIndicator color={palette.surfaceSolid} size="small" />
                  ) : (
                    <Text style={styles.connectButtonText}>Połącz</Text>
                  )}
                </Pressable>
              </View>

              {status ? (
                <View
                  style={[
                    styles.statusBadge,
                    statusType === 'error' && styles.statusBadgeError,
                    statusType === 'success' && styles.statusBadgeSuccess,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      statusType === 'error' && styles.statusTextError,
                      statusType === 'success' && styles.statusTextSuccess,
                    ]}
                  >
                    {status}
                  </Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.cameraRoot}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handled ? undefined : onScan}
      />

      {/* Floating Header */}
      <View
        style={[styles.cameraOverlayHeader, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.cameraCloseButton}
          accessibilityRole="button"
          accessibilityLabel="Zamknij"
        >
          <Text style={styles.cameraCloseIcon}>✕</Text>
        </Pressable>
        <View style={styles.cameraTitlePill}>
          <Text style={styles.cameraTitleText}>Skanuj kod znajomej</Text>
        </View>
        <View style={styles.cameraHeaderPlaceholder} />
      </View>

      {/* 4-corner scanning reticle */}
      <View style={styles.reticleContainer} pointerEvents="none">
        <View style={styles.reticle}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          <View style={styles.scanLaser} />
        </View>
        <View style={styles.reticleHintPill}>
          <Text style={styles.reticleHintText}>Nakieruj aparat na kod QR</Text>
        </View>
      </View>

      {/* Bottom Sheet for manual fallback */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        <View style={[styles.cameraBottomSheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          {status ? (
            <View
              style={[
                styles.statusBadge,
                statusType === 'error' && styles.statusBadgeError,
                statusType === 'success' && styles.statusBadgeSuccess,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  statusType === 'error' && styles.statusTextError,
                  statusType === 'success' && styles.statusTextSuccess,
                ]}
              >
                {status}
              </Text>
            </View>
          ) : null}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Wpisz kod ręcznie</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.cameraInputRow}>
            <TextInput
              value={manual}
              onChangeText={(text) => {
                setManual(text.toUpperCase());
                if (status) setStatus(null);
              }}
              placeholder="ABC234"
              placeholderTextColor={palette.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              style={styles.cameraInputField}
              onSubmitEditing={() => void submit(manual)}
              returnKeyType="done"
              accessibilityLabel="Sześcioliterowy kod znajomej"
            />
            <Pressable
              style={[
                styles.connectButton,
                (manual.trim().length !== 6 || busy) && styles.connectButtonDisabled,
              ]}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                void submit(manual);
              }}
              disabled={manual.trim().length !== 6 || busy}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color={palette.surfaceSolid} size="small" />
              ) : (
                <Text style={styles.connectButtonText}>Połącz</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function CameraGraphic() {
  return (
    <View style={styles.graphicWrapper}>
      <Svg width={110} height={110} viewBox="0 0 110 110" fill="none">
        <Defs>
          <LinearGradient id="accentGrad" x1="0" y1="0" x2="110" y2="110">
            <Stop offset="0" stopColor={palette.level1} stopOpacity="1" />
            <Stop offset="1" stopColor={palette.level2} stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="glowGrad" x1="0" y1="0" x2="110" y2="110">
            <Stop offset="0" stopColor="rgba(242, 118, 27, 0.20)" stopOpacity="1" />
            <Stop offset="1" stopColor="rgba(239, 192, 43, 0.05)" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Ambient background container */}
        <Rect
          x="3"
          y="3"
          width="104"
          height="104"
          rx="28"
          fill="url(#glowGrad)"
          stroke="rgba(242, 118, 27, 0.28)"
          strokeWidth="1.5"
        />

        {/* 4 Viewfinder corner brackets */}
        <Path
          d="M18 32 V20 C18 18.9 18.9 18 20 18 H32"
          stroke="url(#accentGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M92 32 V20 C92 18.9 91.1 18 90 18 H78"
          stroke="url(#accentGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M18 78 V90 C18 91.1 18.9 92 20 92 H32"
          stroke="url(#accentGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M92 78 V90 C92 91.1 91.1 92 90 92 H78"
          stroke="url(#accentGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Camera body in center */}
        <Rect
          x="32"
          y="38"
          width="46"
          height="36"
          rx="8"
          fill="#1C1F26"
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="2.5"
        />

        {/* Camera top bump */}
        <Path
          d="M45 38 L47 33 C47.5 32 48.5 31.5 49.5 31.5 H60.5 C61.5 31.5 62.5 32 63 33 L65 38"
          fill="#1C1F26"
          stroke="rgba(255, 255, 255, 0.85)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Flash dot */}
        <Circle cx="69" cy="45" r="2" fill="url(#accentGrad)" />

        {/* Lens outer ring */}
        <Circle
          cx="55"
          cy="56"
          r="11.5"
          stroke="url(#accentGrad)"
          strokeWidth="2.5"
          fill="rgba(242, 118, 27, 0.15)"
        />

        {/* Lens inner pupil */}
        <Circle cx="55" cy="56" r="5" fill="url(#accentGrad)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.surfaceSolid,
  },
  loadingRoot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avoidingView: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  navBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: palette.border,
  },
  navBackChevron: {
    fontSize: 28,
    color: palette.text,
    lineHeight: 30,
    marginLeft: -2,
  },
  navHeaderTitle: {
    ...type.title,
    fontSize: 18,
    fontWeight: '700',
  },
  navHeaderSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  card: {
    borderRadius: radii.card,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  graphicWrapper: {
    alignSelf: 'center',
    marginVertical: spacing.xs,
  },
  heroTitle: {
    ...type.title,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    color: palette.text,
  },
  heroSubtitle: {
    ...type.body,
    fontSize: 14,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: -spacing.xs,
  },
  trustList: {
    gap: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radii.card - 4,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  trustIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(242, 118, 27, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1,
    borderColor: 'rgba(242, 118, 27, 0.25)',
  },
  trustEmoji: {
    fontSize: 17,
  },
  trustTextCol: {
    flex: 1,
    gap: 2,
  },
  trustHeading: {
    ...type.body,
    fontWeight: '600',
    fontSize: 14,
    color: palette.text,
  },
  trustSubtext: {
    ...type.caption,
    fontSize: 12,
    color: palette.textMuted,
    lineHeight: 16,
  },
  primaryActionButton: {
    paddingVertical: 14,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.text,
  },
  primaryActionButtonText: {
    ...type.body,
    fontWeight: '700',
    color: palette.surfaceSolid,
  },
  settingsAlertBox: {
    gap: spacing.sm,
  },
  settingsAlertText: {
    ...type.caption,
    color: palette.level1,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: spacing.xs,
  },
  retryButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  retryButtonText: {
    ...type.caption,
    color: palette.textMuted,
    textDecorationLine: 'underline',
  },
  manualHeader: {
    gap: spacing.xs,
  },
  manualCardTitle: {
    ...type.label,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
    color: palette.textMuted,
  },
  manualCardSubtitle: {
    ...type.caption,
    color: palette.textMuted,
    lineHeight: 17,
  },
  inputGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  manualInputField: {
    flex: 1,
    ...type.title,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    letterSpacing: 6,
    textAlign: 'center',
    color: palette.text,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: 14,
    paddingVertical: spacing.md,
    fontSize: 19,
  },
  connectButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 14,
    backgroundColor: palette.level2,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
    height: 52,
  },
  connectButtonDisabled: {
    opacity: 0.4,
  },
  connectButtonText: {
    ...type.body,
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 15,
  },
  statusBadge: {
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: palette.border,
    alignItems: 'center',
  },
  statusBadgeError: {
    backgroundColor: 'rgba(214, 40, 40, 0.15)',
    borderColor: 'rgba(214, 40, 40, 0.4)',
  },
  statusBadgeSuccess: {
    backgroundColor: 'rgba(76, 175, 125, 0.15)',
    borderColor: 'rgba(76, 175, 125, 0.4)',
  },
  statusText: {
    ...type.caption,
    color: palette.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  statusTextError: {
    color: palette.level3,
  },
  statusTextSuccess: {
    color: palette.success,
  },

  // Camera View
  cameraRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlayHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cameraCloseIcon: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cameraTitlePill: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cameraTitleText: {
    ...type.body,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cameraHeaderPlaceholder: {
    width: 40,
  },
  reticleContainer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  reticle: {
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: palette.level2,
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 18,
  },
  scanLaser: {
    width: '85%',
    height: 2,
    backgroundColor: palette.level2,
    opacity: 0.85,
    borderRadius: 1,
  },
  reticleHintPill: {
    marginTop: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  reticleHintText: {
    ...type.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  cameraBottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
    backgroundColor: 'rgba(20, 22, 26, 0.94)',
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    borderTopWidth: 1,
    borderColor: palette.borderStrong,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  dividerText: {
    ...type.caption,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  cameraInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  cameraInputField: {
    flex: 1,
    ...type.title,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    letterSpacing: 6,
    textAlign: 'center',
    color: palette.text,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: palette.borderStrong,
    borderRadius: 14,
    paddingVertical: spacing.md,
    fontSize: 19,
  },
});
