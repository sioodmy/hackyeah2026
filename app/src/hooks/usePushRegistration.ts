import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import type { ApiClient } from '@/lib/api';

/**
 * Android channel and notification-category ids.
 *
 * They match what the backend sends: a level-2 push lands on `call-request` with
 * the `call` category, a level-3 push on `full-alert` with `alarm`.
 */
const CALL_CHANNEL = 'call-request';
const CALL_CATEGORY = 'call';
const FULL_ALERT_CHANNEL = 'full-alert';
const FULL_ALERT_CATEGORY = 'alarm';
const DEFAULT_CHANNEL = 'default';

/**
 * The EAS project id, read from the app config the way `expo-notifications`
 * reads it. CI injects the real value into `extra.eas.projectId` before
 * prebuild, so a release never depends on a developer's local `.env`.
 */
function easProjectIdFromConfig(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: unknown } } | undefined;
  const id = extra?.eas?.projectId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/**
 * Register the two alarm categories, so a push that names one arrives with a
 * button that opens the app onto the right screen.
 *
 * Each category needs at least one action — Android's implementation rejects an
 * empty list outright — and the button is the only thing that reaches the app when
 * it is not running.
 */
async function registerAlarmCategories(): Promise<void> {
  await Notifications.setNotificationCategoryAsync(CALL_CATEGORY, [
    { identifier: 'answer', buttonTitle: 'Odbierz', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync(FULL_ALERT_CATEGORY, [
    {
      identifier: 'on_the_way',
      buttonTitle: 'Idę do niej',
      options: { opensAppToForeground: true },
    },
  ]);
}

/**
 * Push registration.
 *
 * Alert delivery goes over Expo push rather than the WebSocket on purpose: push
 * reaches a friend's phone when the app is killed or backgrounded, and the
 * socket does not. Only live *positions* use the socket.
 */
export function usePushRegistration({
  api,
  enabled,
  userId,
}: {
  api: ApiClient;
  enabled: boolean;
  userId: string | null;
}) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;

    void (async () => {
      try {
        // Deliberately outside the block below: a category that fails to register
        // costs the friend a button, while a failure anywhere in there costs the
        // phone its push token, and with it every alert this account ever sends.
        await registerAlarmCategories().catch(() => {});

        if (Platform.OS === 'android') {
          // Level 3 needs this channel to be heads-up and to bypass Do Not
          // Disturb, which is what makes a level-3 alarm feel different from an
          // ordinary notification.
          await Notifications.setNotificationChannelAsync(FULL_ALERT_CHANNEL, {
            name: 'Pełny alarm',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 600, 400, 600],
            sound: 'default',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
          });
          // Level 2 has to be able to interrupt, but not barge through Do Not
          // Disturb — a friend being asked to talk is not a life-or-death alarm.
          await Notifications.setNotificationChannelAsync(CALL_CHANNEL, {
            name: 'Prośba o telefon',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 400, 300, 400],
            sound: 'default',
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
          await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL, {
            name: 'Powiadomienia',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;

        if (status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync({
            ios: { allowAlert: true, allowSound: true, allowBadge: false },
          });
          status = requested.status;
        }

        if (cancelled) return;
        setPermission(status === 'granted' ? 'granted' : 'denied');
        if (status !== 'granted') return;

        // Android needs a physical device for a real push token.
        if (Platform.OS === 'android' && !Device.isDevice) return;

        // Without an EAS project id `getExpoPushTokenAsync` cannot mint a token on
        // a standalone Android build, and it throws rather than degrading — which
        // used to land in the `catch` below, set `permission` to `denied`, and
        // leave the account silently unable to alert anybody. Say so instead.
        const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? easProjectIdFromConfig();
        if (!projectId) {
          console.warn(
            '[push] no EAS project id (extra.eas.projectId in app.json, or ' +
              'EXPO_PUBLIC_EAS_PROJECT_ID locally). Push tokens will not be ' +
              'issued, so friends will not be alerted. Run `eas init`, or set ' +
              'the EAS_PROJECT_ID repository variable that release.yml injects.',
          );
          return;
        }

        const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });

        if (cancelled || !tokenResponse.data) return;
        setExpoPushToken(tokenResponse.data);

        await api.registerDevice(tokenResponse.data, Platform.OS === 'ios' ? 'ios' : 'android');
      } catch (error) {
        // Push is an enhancement; the app must still work without it. But a token
        // that silently never arrives means a friend never gets told, so this is
        // the one failure worth shouting about.
        console.warn('[push] token registration failed', error);
        setPermission('denied');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, enabled, userId]);

  return { expoPushToken, permission };
}
