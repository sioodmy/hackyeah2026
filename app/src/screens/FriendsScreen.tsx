import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radii, spacing, type } from '@/theme';
import { useApi } from '@/lib/ApiContext';
import type { Friend } from '@/lib/api';

/**
 * Friends: connect by QR, or by typing six characters.
 */
export function FriendsScreen() {
  const api = useApi();
  const insets = useSafeAreaInsets();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<Friend[]>([]);
  const [invite, setInvite] = useState<{ payload: string; code: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, pending, mine] = await Promise.all([
        api.friends(),
        api.friendRequests(),
        api.myInvite(),
      ]);
      setFriends(list);
      setRequests(pending);
      setInvite(mine);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać znajomych.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accept = useCallback(
    async (id: string) => {
      try {
        await api.acceptFriend(id);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nie udało się zaakceptować.');
      }
    },
    [api, refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.removeFriend(id);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nie udało się usunąć.');
      }
    },
    [api, refresh],
  );

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <Header onBack={() => router.back()} />

        {requests.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Oczekujące prośby</Text>
            {requests.map((friend) => {
              const [emojiPart, auraPart] = (friend.avatarUrl ?? '').includes('|')
                ? (friend.avatarUrl ?? '').split('|')
                : [friend.avatarUrl, null];
              const emoji = emojiPart?.trim() || '🌸';
              const aura = auraPart?.trim() || palette.level1;
              return (
                <View key={friend.id} style={styles.row}>
                  <View style={[styles.friendAvatarBadge, { borderColor: aura }]}>
                    <Text style={styles.friendAvatarEmoji}>{emoji}</Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.rowLabel}>{friend.displayName ?? 'Znajoma'}</Text>
                    <Text style={styles.rowSub}>Zaproszenie oczekujące</Text>
                  </View>
                  <Pressable
                    style={styles.smallButton}
                    onPress={() => accept(friend.id)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.smallButtonText}>Akceptuj</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Twój kod QR</Text>
          <Text style={styles.note}>
            Znajoma może zeskanować ten kod lub wpisać sześć znaków ze swojego telefonu
          </Text>
          {invite ? (
            <View style={styles.qrBox}>
              <QRCode value={invite.payload} size={200} backgroundColor={palette.text} />
              <Text style={styles.code}>{invite.code}</Text>
            </View>
          ) : (
            <ActivityIndicator color={palette.textMuted} style={styles.spinner} />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Twoje kontakty</Text>
          {loading ? (
            <ActivityIndicator color={palette.textMuted} style={styles.spinner} />
          ) : friends.length === 0 ? (
            <Text style={styles.note}>Brak kontaktów. Pokaż swój kod znajomej.</Text>
          ) : (
            friends.map((friend) => {
              const [emojiPart, auraPart] = (friend.avatarUrl ?? '').includes('|')
                ? (friend.avatarUrl ?? '').split('|')
                : [friend.avatarUrl, null];
              const emoji = emojiPart?.trim() || '🌸';
              const aura = auraPart?.trim() || palette.level1;
              return (
                <View key={friend.id} style={styles.row}>
                  <View style={[styles.friendAvatarBadge, { borderColor: aura }]}>
                    <Text style={styles.friendAvatarEmoji}>{emoji}</Text>
                  </View>
                  <View style={styles.friendInfo}>
                    <Text style={styles.rowLabel}>{friend.displayName ?? 'Znajoma'}</Text>
                    <Text style={styles.rowSub}>Kontakt zaufania</Text>
                  </View>
                  <Pressable
                    onPress={() => remove(friend.id)}
                    accessibilityRole="button"
                    hitSlop={8}
                  >
                    <Text style={styles.remove}>Usuń</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        <Pressable
          style={styles.scanButton}
          onPress={() => router.push('/friends/scan')}
          accessibilityRole="button"
        >
          <Text style={styles.scanButtonText}>Skanuj kod znajomej</Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Wróć">
        <Text style={styles.back}>‹</Text>
      </Pressable>
      <Text style={styles.title}>Znajomi</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.surfaceSolid },
  content: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  back: { fontSize: 32, color: palette.text, lineHeight: 34 },
  title: { ...type.title },
  card: {
    borderRadius: radii.card,
    backgroundColor: palette.surfaceRaised,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardTitle: { ...type.label, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.8 },
  note: { ...type.caption, lineHeight: 18 },
  qrBox: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  code: {
    ...type.title,
    fontFamily: 'monospace',
    letterSpacing: 6,
    fontSize: 26,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  friendAvatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: palette.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendAvatarEmoji: {
    fontSize: 20,
    lineHeight: 24,
  },
  friendInfo: { flex: 1 },
  rowLabel: { ...type.body, fontSize: 15 },
  rowSub: { ...type.caption, fontSize: 12, color: palette.textMuted },
  smallButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: palette.level2,
  },
  smallButtonText: { ...type.caption, color: '#FFFFFF', fontWeight: '700' },
  remove: { ...type.caption, color: palette.level3 },
  scanButton: {
    paddingVertical: spacing.lg,
    borderRadius: radii.card,
    alignItems: 'center',
    backgroundColor: palette.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  scanButtonText: { ...type.body, fontWeight: '600' },
  spinner: { paddingVertical: spacing.lg },
  error: { ...type.caption, color: palette.level3 },
});
