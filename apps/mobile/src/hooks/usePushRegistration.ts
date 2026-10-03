import { useEffect } from "react"
import { Platform } from "react-native"
import * as Device from "expo-device"
import * as Notifications from "expo-notifications"

import { api } from "@/lib/api"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/**
 * Registers the Expo push token with the server so a level 2 or 3 alert can
 * reach the phone even when the app is closed. Alerts are a safety net behind
 * the websocket channel, so a failure here is logged and ignored.
 */
export function usePushRegistration(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || !Device.isDevice) return

    let cancelled = false

    void (async () => {
      try {
        const existing = await Notifications.getPermissionsAsync()
        let granted = existing.granted

        if (!granted) {
          const requested = await Notifications.requestPermissionsAsync()
          granted = requested.granted
        }

        if (!granted) return

        await Notifications.setNotificationChannelAsync("alerts", {
          name: "Alerty bezpieczeństwa",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 400, 200, 400],
          lightColor: "#E01E37",
          lockscreenVisibility:
            Notifications.AndroidNotificationVisibility.PUBLIC,
        })

        const { data: token } = await Notifications.getExpoPushTokenAsync()
        if (cancelled) return

        await api.registerDevice({
          token,
          platform: Platform.OS === "ios" ? "ios" : "android",
          provider: "expo",
        })
      } catch {
        // Push is a nice-to-have; the websocket channel carries the same alert.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [enabled])
}
