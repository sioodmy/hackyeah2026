import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [busy, setBusy] = useState(false);
  const [handled, setHandled] = useState(false);

  const submit = useCallback(
    async (payload: string) => {
      if (busy) return;
      setBusy(true);
      setStatus('Łączenie…');
      try {
        const friend = await api.scanInvite(payload.trim());
        setStatus(
          friend.status === 'accepted'
            ? `Połączono z ${friend.displayName ?? 'znajomą'}`
            : 'Zaproszenie wysłane — poczekaj na akceptację.',
        );
        setTimeout(() => router.back(), 900);
      } catch (err) {
        setHandled(false);
        setStatus(err instanceof Error ? err.message : 'Nie udało się połączyć.');
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
      void submit(result.data);
    },
    [handled, submit],
  );

  if (!permission) {
    return <View style={styles.root} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top + spacing.xl }]}>
        <Text style={styles.title}>Potrzebny dostęp do kamery</Text>
        <Text style={styles.note}>Aby zeskanować kod znajomej.</Text>
        <Pressable style={styles.primaryButton} onPress={() => void requestPermission()}>
          <Text style={styles.primaryButtonText}>Zezwól</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.link}>Wróć</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handled ? undefined : onScan}
      />

      <View
        style={[styles.overlay, { paddingTop: insets.top + spacing.lg }]}
        pointerEvents="box-none"
      >
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text style={styles.close}>×</Text>
        </Pressable>
        <Text style={styles.title}>Kod znajomej</Text>
      </View>

      <View style={styles.reticle} pointerEvents="none">
        <View style={styles.corner} />
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        {status ? <Text style={styles.status}>{status}</Text> : null}

        <Text style={styles.or}>albo wpisz kod</Text>
        <TextInput
          value={manual}
          onChangeText={(text) => setManual(text.toUpperCase())}
          placeholder="ABC234"
          placeholderTextColor={palette.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          style={styles.input}
          onSubmitEditing={() => void submit(manual)}
          returnKeyType="done"
          accessibilityLabel="Sześcioliterowy kod znajomej"
        />
        <Pressable
          style={styles.primaryButton}
          onPress={() => void submit(manual)}
          disabled={manual.length !== 6 || busy}
        >
          <Text style={styles.primaryButtonText}>Połącz</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  overlay: {
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  close: { fontSize: 34, color: '#FFFFFF', lineHeight: 36 },
  title: { ...type.title, color: '#FFFFFF' },
  reticle: {
    position: 'absolute',
    alignSelf: 'center',
    top: '38%',
    width: 220,
    height: 220,
    borderRadius: radii.card,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  corner: {
    position: 'absolute',
    left: -2,
    top: -2,
    width: 28,
    height: 28,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: palette.level2,
  },
  bottom: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  status: { ...type.body, color: '#FFFFFF' },
  or: { ...type.caption, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  input: {
    ...type.title,
    fontFamily: 'monospace',
    letterSpacing: 8,
    textAlign: 'center',
    color: palette.text,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radii.card,
    paddingVertical: spacing.md,
  },
  primaryButton: {
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    alignItems: 'center',
    backgroundColor: palette.text,
  },
  primaryButtonText: { ...type.body, fontWeight: '700', color: palette.surfaceSolid },
  linkButton: { paddingVertical: spacing.sm },
  link: { ...type.caption },
  note: { ...type.caption },
});
