import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

import type { ApiClient } from '@/lib/api';

/**
 * Android channel and notification-category ids.
 *
 * They match what the backend sends: a level-2 push lands on `call-request` with
 * the `call` category, a level-3 push on `full-alert` with `alarm`. The two
 * category ids are Android's own `CATEGORY_CALL`/`CATEGORY_ALARM` values on
 * purpose — the OS only promotes a notification to a full-screen intent for those,
 * which is what opens this app straight onto the call screen or the alarm.
 */
const CALL_CHANNEL = 'call-request';
const CALL_CATEGORY = 'call';
const FULL_ALERT_CHANNEL = 'full-alert';
const FULL_ALERT_CATEGORY = 'alarm';
const DEFAULT_CHANNEL = 'default';

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
        if (Platform.OS === 'android') {
          // Level 3 needs this channel to be heads-up and to bypass Do Not
          // Disturb, which is what makes "FULL ALERT" feel different from an
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

        // Registering the categories is what makes a push with `categoryId` render
        // as a call or an alarm instead of an ordinary banner. The buttons are
        // handled by the app's own overlay, so they are deliberately absent.
        await Notifications.setNotificationCategoryAsync(CALL_CATEGORY, []);
        await Notifications.setNotificationCategoryAsync(FULL_ALERT_CATEGORY, []);

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

        const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
        const tokenResponse =
          projectId && Device.isDevice
            ? await Notifications.getExpoPushTokenAsync({ projectId })
            : await Notifications.getExpoPushTokenAsync();

        if (cancelled || !tokenResponse.data) return;
        setExpoPushToken(tokenResponse.data);

        await api.registerDevice(tokenResponse.data, Platform.OS === 'ios' ? 'ios' : 'android');
      } catch {
        // Push is an enhancement; the app must still work without it.
        setPermission('denied');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api, enabled, userId]);

  return { expoPushToken, permission };
}
