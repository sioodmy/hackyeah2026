/**
 * The fake incoming call.
 *
 * This is the escape hatch: at level 1 nothing leaves the device, so the phone
 * must be able to become "someone is calling me" on its own. The screen mimics
 * a real call UI, the ringtone loops quietly, and the haptics keep going — a
 * glance from across the room reads as an ordinary phone call.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { floatingShadow, palette, radii, spacing, type } from '@/theme';
import type { ThreatLevel } from '@/theme/levels';

// Assets live in the Expo-standard top-level `assets/` directory, so these are
// relative paths rather than `@/`-aliased ones.
const RINGTONE = require('../../assets/ringtone.wav');
const IN_CALL_AMBIENCE = require('../../assets/in-call.wav');

/** How long the "conversation" pretends to last. */
const IN_CALL_SECONDS = 5;
/** Ringtone volume: quiet enough not to leak into a level-3 recording. */
const RINGTONE_VOLUME = 0.15;

type Contact = { name: string; relation: string };

const CONTACTS: Contact[] = [
  { name: 'Mama', relation: 'komórka' },
  { name: 'Kasia', relation: 'komórka' },
  { name: 'Tata', relation: 'komórka' },
];

function pickContact(): Contact {
  const index = Math.floor(Math.random() * CONTACTS.length);
  return CONTACTS[index] ?? CONTACTS[0]!;
}

export type IncomingCallOverlayProps = {
  visible: boolean;
  level: ThreatLevel;
  onAnswer: () => void;
  onDecline: () => void;
};

export function IncomingCallOverlay({
  visible,
  level,
  onAnswer,
  onDecline,
}: IncomingCallOverlayProps) {
  const insets = useSafeAreaInsets();
  const contactRef = useRef<Contact>(pickContact());
  const [answered, setAnswered] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(IN_CALL_SECONDS);

  const ringtone = useAudioPlayer(RINGTONE);
  const ambience = useAudioPlayer(IN_CALL_AMBIENCE);

  // A repeating pattern rather than a continuous buzz: it reads as a phone
  // ringing through a pocket, and it does not mask what is being said nearby.
  useEffect(() => {
    if (!visible || answered) return undefined;

    ringtone.loop = true;
    // Quiet enough that it does not leak into a level-3 recording.
    ringtone.volume = RINGTONE_VOLUME;
    ringtone
      .seekTo(0)
      .then(() => ringtone.play())
      .catch(() => {});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const pulse = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 2_200);

    return () => {
      clearInterval(pulse);
      ringtone.pause();
    };
  }, [answered, ringtone, visible]);

  useEffect(() => {
    if (!answered) return undefined;
    ambience
      .seekTo(0)
      .then(() => ambience.play())
      .catch(() => {});

    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => clearInterval(id);
  }, [ambience, answered, onDecline]);

  const handleAnswer = useCallback(() => {
    ringtone.pause();
    setAnswered(true);
    onAnswer();
  }, [onAnswer, ringtone]);

  const handleDecline = useCallback(() => {
    ringtone.pause();
    onDecline();
  }, [onDecline, ringtone]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleDecline}
      transparent={false}
    >
      <View style={[styles.root, { paddingTop: insets.top + spacing.xl }]}>
        <View style={styles.header}>
          <Text style={styles.caller}>{contactRef.current.name}</Text>
          <Text style={styles.channel}>{contactRef.current.relation}</Text>
        </View>

        {answered ? (
          <View style={styles.body}>
            <View style={[styles.avatar, floatingShadow(10)]}>
              <Text style={styles.avatarText}>{contactRef.current.name.slice(0, 1)}</Text>
            </View>
            <Text style={styles.timer}>
              {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
            </Text>
            <Pressable style={styles.hangUp} onPress={handleDecline} accessibilityRole="button">
              <Text style={styles.hangUpText}>Zakończ</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.body}>
            <View style={[styles.avatar, floatingShadow(10)]}>
              <Text style={styles.avatarText}>{contactRef.current.name.slice(0, 1)}</Text>
            </View>
            {level >= 2 ? <Text style={styles.badge}>lokalizacja wysłana</Text> : null}
          </View>
        )}

        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.actionColumn}>
            <Pressable
              style={[styles.actionButton, styles.declineButton]}
              onPress={handleDecline}
              accessibilityRole="button"
              accessibilityLabel="Odrzuć połączenie"
            >
              <Text style={styles.actionGlyph}>✕</Text>
            </Pressable>
            <Text style={styles.actionLabel}>Odrzuć</Text>
          </View>

          <View style={styles.actionColumn}>
            <Pressable
              style={[styles.actionButton, styles.acceptButton]}
              onPress={handleAnswer}
              accessibilityRole="button"
              accessibilityLabel="Odbierz połączenie"
            >
              <Text style={styles.actionGlyph}>✓</Text>
            </Pressable>
            <Text style={styles.actionLabel}>Odbierz</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0C0E',
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
  },
  caller: { ...type.title, fontSize: 30, letterSpacing: 0.2 },
  channel: { ...type.caption, marginTop: spacing.xs },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  avatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 42,
    fontWeight: '600',
    color: palette.text,
  },
  badge: {
    ...type.caption,
    color: palette.level2,
  },
  timer: {
    ...type.body,
    color: palette.textMuted,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionColumn: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: { backgroundColor: palette.level3 },
  acceptButton: { backgroundColor: palette.success },
  actionGlyph: { color: '#FFFFFF', fontSize: 30, fontWeight: '600' },
  actionLabel: { ...type.caption },
  hangUp: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: palette.surfaceRaised,
  },
  hangUpText: { ...type.body, color: palette.text },
});
