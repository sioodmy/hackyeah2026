/**
 * What a friend's phone does when somebody they know raises an alarm.
 *
 * Two screens, one per level that takes over the phone:
 *
 * * **level 2 — the call request.** The push's `call` category makes Android open
 *   the app full-screen, so this reads as a phone ringing with the person in danger
 *   on the other end: ringtone, haptics, answer and decline. Answering is the thing
 *   the victim asked for, so answering reports `answered` back to her.
 * * **level 3 — the alarm.** A looping siren at full volume that only stops when the
 *   friend says what they are doing about it, and the answer lands on the victim's
 *   screen as "Kasia wie" / "Kasia idzie".
 *
 * Both are mounted above the router rather than inside a screen, because the phone
 * has to do this whatever the friend was looking at — the map, settings, anywhere.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import { useApi } from '@/lib/ApiContext';
import { clearIncomingAlert, useIncomingAlert, type IncomingAlert } from '@/lib/friendAlarm';
import type { ApiClient } from '@/lib/api';
import { floatingShadow, palette, radii, spacing, type } from '@/theme';

// Assets live in the Expo-standard top-level `assets/` directory, so these are
// relative paths rather than `@/`-aliased ones.
const RINGTONE = require('../../assets/ringtone.wav');
const IN_CALL_AMBIENCE = require('../../assets/in-call.wav');
const ALARM = require('../../assets/alarm.wav');

/** How long the answered call pretends to last. */
const IN_CALL_SECONDS = 20;

/** A call is meant to be answered, so it is louder than the victim's own fake one. */
const RINGTONE_VOLUME = 0.6;

export type AckAction = 'seen' | 'answered' | 'on_the_way';

function coordinates(lat: number | null, lng: number | null): string | null {
  if (lat === null || lng === null) return null;
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export function FriendAlarmOverlay() {
  const alert = useIncomingAlert();
  const api = useApi();

  if (!alert) return null;
  // Level 1 never reaches the overlay, so anything that does is a call or an alarm.
  return <AlertScreen key={`${alert.alertId}:${alert.level}`} alert={alert} api={api} />;
}

function AlertScreen({ alert, api }: { alert: IncomingAlert; api: ApiClient }) {
  const insets = useSafeAreaInsets();
  const [answered, setAnswered] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(IN_CALL_SECONDS);

  const ringtone = useAudioPlayer(RINGTONE);
  const ambience = useAudioPlayer(IN_CALL_AMBIENCE);
  const siren = useAudioPlayer(ALARM);

  const isAlarm = alert.level >= 3;
  const coords = coordinates(alert.lat, alert.lng);

  // The alarm has to be heard on a phone that is on silent and locked in a pocket,
  // which is exactly when an alarm that obeys the ringer switch is worthless.
  useEffect(() => {
    if (!isAlarm) return;
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    }).catch(() => {});
    return () => {
      void setAudioModeAsync({
        playsInSilentMode: false,
        shouldPlayInBackground: false,
        interruptionMode: 'mixWithOthers',
      }).catch(() => {});
    };
  }, [isAlarm]);

  const acknowledge = useCallback(
    (action: AckAction) => {
      clearIncomingAlert();
      if (!alert.alertId) return;
      void api.ackAlert(alert.alertId, action).catch(() => {
        // The friend has done the right thing on their phone; a failed report must
        // not put the screen or the siren back.
      });
    },
    [alert.alertId, api],
  );

  // Ringing: a repeating impact rather than one long buzz, which is what a phone in
  // a pocket actually feels like. Answering replaces the ringtone with the call.
  useEffect(() => {
    if (isAlarm || answered) return undefined;
    ringtone.loop = true;
    ringtone.volume = RINGTONE_VOLUME;
    ringtone
      .seekTo(0)
      .then(() => ringtone.play())
      .catch(() => {});
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    const pulse = setInterval(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }, 2_000);

    return () => {
      clearInterval(pulse);
      ringtone.pause();
    };
  }, [answered, isAlarm, ringtone]);

  useEffect(() => {
    if (!isAlarm) return undefined;
    siren.loop = true;
    siren.volume = 1;
    siren
      .seekTo(0)
      .then(() => siren.play())
      .catch(() => {});
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

    const thump = setInterval(() => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }, 4_000);

    return () => {
      clearInterval(thump);
      siren.pause();
    };
  }, [isAlarm, siren]);

  useEffect(() => {
    if (!answered) return undefined;
    ringtone.pause();
    ambience
      .seekTo(0)
      .then(() => ambience.play())
      .catch(() => {});

    const tick = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(tick);
          acknowledge('answered');
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => {
      clearInterval(tick);
      ambience.pause();
    };
  }, [acknowledge, ambience, answered, ringtone]);

  const handleAnswer = useCallback(() => {
    ringtone.pause();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setAnswered(true);
  }, [ringtone]);

  const handleDecline = useCallback(() => {
    acknowledge('seen');
  }, [acknowledge]);

  if (isAlarm) {
    return (
      <AlarmScreen
        name={alert.from}
        coords={coords}
        onOnTheWay={() => acknowledge('on_the_way')}
        onSeen={() => acknowledge('seen')}
        topInset={insets.top}
        bottomInset={insets.bottom}
      />
    );
  }

  return (
    <CallRequestScreen
      name={alert.from}
      coords={coords}
      answered={answered}
      secondsLeft={secondsLeft}
      onAnswer={handleAnswer}
      onDecline={handleDecline}
      topInset={insets.top}
      bottomInset={insets.bottom}
    />
  );
}

/** Level 3: the alarm. Nothing on it is subtle, on purpose. */
function AlarmScreen({
  name,
  coords,
  onOnTheWay,
  onSeen,
  topInset,
  bottomInset,
}: {
  name: string;
  coords: string | null;
  onOnTheWay: () => void;
  onSeen: () => void;
  topInset: number;
  bottomInset: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 620, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 620, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const glow = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(214, 40, 40, 0.10)', 'rgba(214, 40, 40, 0.42)'],
  });

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <View style={styles.alarmRoot}>
        <Animated.View style={[styles.alarmGlow, { backgroundColor: glow }]} pointerEvents="none" />

        <View style={[styles.alarmBody, { paddingTop: topInset + spacing.xl }]}>
          <Text style={styles.alarmKicker}>Pełny alarm</Text>
          <Text style={styles.alarmName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.alarmBodyText}>potrzebuje pomocy. Zadzwoń do niej teraz.</Text>
          {coords ? <Text style={styles.alarmCoords}>{coords}</Text> : null}
          <View style={[styles.alarmBadge, floatingShadow(10)]}>
            <Text style={styles.alarmBadgeText}>lokalizacja wysyłana na żywo</Text>
          </View>
        </View>

        <View style={[styles.alarmActions, { paddingBottom: bottomInset + spacing.xl }]}>
          <Pressable
            style={[styles.alarmPrimary, floatingShadow(12)]}
            onPress={onOnTheWay}
            accessibilityRole="button"
            accessibilityLabel="Idę do niej"
          >
            <Text style={styles.alarmPrimaryText}>Idę do niej</Text>
          </Pressable>
          <Pressable
            style={styles.alarmSecondary}
            onPress={onSeen}
            accessibilityRole="button"
            accessibilityLabel="Zobaczyłam, ale nie mogę teraz"
          >
            <Text style={styles.alarmSecondaryText}>Nie mogę teraz — sprawdzę na mapie</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Level 2: the call request, styled as an ordinary incoming call. */
function CallRequestScreen({
  name,
  coords,
  answered,
  secondsLeft,
  onAnswer,
  onDecline,
  topInset,
  bottomInset,
}: {
  name: string;
  coords: string | null;
  answered: boolean;
  secondsLeft: number;
  onAnswer: () => void;
  onDecline: () => void;
  topInset: number;
  bottomInset: number;
}) {
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <Modal visible animationType="slide" onRequestClose={onDecline} transparent={false}>
      <View style={[styles.callRoot, { paddingTop: topInset + spacing.xl }]}>
        <View style={styles.callHeader}>
          <Text style={styles.callCaller} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.callReason}>prosi o telefon</Text>
        </View>

        <View style={styles.callBody}>
          <View style={[styles.callAvatar, floatingShadow(10)]}>
            <Text style={styles.callAvatarText}>{initial}</Text>
          </View>
          {answered ? (
            <>
              <Text style={styles.callTimer}>
                {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
              </Text>
              <Pressable
                style={styles.callHangUp}
                onPress={onDecline}
                accessibilityRole="button"
                accessibilityLabel="Zakończ połączenie"
              >
                <Text style={styles.callHangUpText}>Zakończ</Text>
              </Pressable>
            </>
          ) : coords ? (
            <Text style={styles.callCoords}>lokalizacja: {coords}</Text>
          ) : null}
        </View>

        <View style={[styles.callActions, { paddingBottom: bottomInset + spacing.xl }]}>
          <View style={styles.callActionColumn}>
            <Pressable
              style={[styles.callButton, styles.callDeclineButton]}
              onPress={onDecline}
              accessibilityRole="button"
              accessibilityLabel="Odrzuć połączenie"
            >
              <Text style={styles.callGlyph}>✕</Text>
            </Pressable>
            <Text style={styles.callActionLabel}>Nie teraz</Text>
          </View>

          <View style={styles.callActionColumn}>
            <Pressable
              style={[styles.callButton, styles.callAcceptButton]}
              onPress={onAnswer}
              accessibilityRole="button"
              accessibilityLabel="Odbierz połączenie"
            >
              <Text style={styles.callGlyph}>✓</Text>
            </Pressable>
            <Text style={styles.callActionLabel}>Odbierz</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  alarmRoot: {
    flex: 1,
    backgroundColor: '#12060A',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  alarmGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  alarmBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  alarmKicker: {
    ...type.label,
    color: '#FF8A80',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  alarmName: {
    ...type.title,
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
  },
  alarmBodyText: {
    ...type.body,
    fontSize: 17,
    color: '#FFD9D6',
    textAlign: 'center',
  },
  alarmCoords: {
    ...type.label,
    color: palette.textMuted,
    fontVariant: ['tabular-nums'],
  },
  alarmBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: palette.surfaceRaised,
    borderWidth: 1,
    borderColor: 'rgba(255, 138, 128, 0.45)',
  },
  alarmBadgeText: {
    ...type.caption,
    color: '#FF8A80',
  },
  alarmActions: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  alarmPrimary: {
    paddingVertical: spacing.xl - spacing.xs,
    borderRadius: radii.pill,
    alignItems: 'center',
    backgroundColor: palette.level3,
  },
  alarmPrimaryText: {
    ...type.title,
    fontSize: 19,
    color: '#FFFFFF',
  },
  alarmSecondary: {
    paddingVertical: spacing.lg,
    borderRadius: radii.pill,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  alarmSecondaryText: {
    ...type.label,
    color: palette.text,
  },
  callRoot: {
    flex: 1,
    backgroundColor: '#0B0C0E',
    justifyContent: 'space-between',
  },
  callHeader: {
    alignItems: 'center',
  },
  callCaller: {
    ...type.title,
    fontSize: 30,
    letterSpacing: 0.2,
  },
  callReason: {
    ...type.caption,
    marginTop: spacing.xs,
    color: palette.level2,
  },
  callBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  callAvatar: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: palette.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callAvatarText: {
    fontSize: 42,
    fontWeight: '600',
    color: palette.text,
  },
  callCoords: {
    ...type.caption,
    color: palette.textMuted,
    fontVariant: ['tabular-nums'],
  },
  callTimer: {
    ...type.body,
    color: palette.textMuted,
    fontVariant: ['tabular-nums'],
  },
  callHangUp: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: palette.surfaceRaised,
  },
  callHangUpText: {
    ...type.body,
    color: palette.text,
  },
  callActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  callActionColumn: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  callButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callDeclineButton: { backgroundColor: palette.level3 },
  callAcceptButton: { backgroundColor: palette.success },
  callGlyph: { color: '#FFFFFF', fontSize: 30, fontWeight: '600' },
  callActionLabel: { ...type.caption },
});
