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
 * * `response` fires when the notification is tapped or one of its buttons is
 *   pressed — the path that works with the app killed, since the tap is what opens
 *   it.
 */

import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';

import { applyIncomingPush } from '@/lib/friendAlarm';

function dataOf(notification: Notifications.Notification): unknown {
  return notification.request.content.data;
}

/**
 * `getLastNotificationResponseAsync` keeps answering with the same notification,
 * so it is worth reading exactly once per process: re-reading it after a sign-out
 * and back would ring a friend about an alert that ended hours ago.
 */
let coldStartRead = false;

export function useIncomingAlerts(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return undefined;

    const received = Notifications.addNotificationReceivedListener((notification) => {
      applyIncomingPush(dataOf(notification));
    });

    const responded = Notifications.addNotificationResponseReceivedListener((response) => {
      applyIncomingPush(dataOf(response.notification));
    });

    // Cold start: the app was launched *by* the notification, and there is no live
    // listener to catch the event that started it.
    let cancelled = false;
    if (!coldStartRead) {
      coldStartRead = true;
      void Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          if (cancelled || !response) return;
          applyIncomingPush(dataOf(response.notification));
        })
        .catch(() => {
          /* a friend without push permission still gets the map */
        });
    }

    return () => {
      cancelled = true;
      received.remove();
      responded.remove();
    };
  }, [enabled]);
}
