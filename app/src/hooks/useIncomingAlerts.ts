/**
 * Turning a push into something the friend's phone does.
 *
 * Push is the only delivery channel that reaches a phone whose app is dead, so
 * this is where the level becomes behaviour: level 2 is a call request and level 3
 * is an alarm. Level 1 needs nothing here — the notification is the delivery.
 *
 * Two listeners, because Android delivers the same notification through both:
 *
 * * `received` fires while the app is alive, whether it is in the foreground or
 *   backgrounded, and is what starts the siren.
 * * `response` fires when the notification is tapped, which is also what happens
 *   when a full-screen intent opens the app — the one path that works with the app
 *   killed.
 */

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import { applyIncomingPush } from '@/lib/friendAlarm';

function dataOf(notification: Notifications.Notification): unknown {
  return notification.request.content.data;
}

export function useIncomingAlerts(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const received = Notifications.addNotificationReceivedListener((notification) => {
      applyIncomingPush(dataOf(notification));
    });

    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      applyIncomingPush(dataOf(response.notification));
    });

    // Cold start: the app was launched *by* the notification (or by its full-screen
    // intent), and there is no live listener to catch the event that started it.
    let cancelled = false;
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled || !response) return;
        applyIncomingPush(dataOf(response.notification));
      })
      .catch(() => {
        /* a friend without push permission still gets the map */
      });

    return () => {
      cancelled = true;
      received.remove();
      responded.remove();
    };
  }, [enabled]);
}
