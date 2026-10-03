import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import * as Haptics from "expo-haptics"
import {
  THREAT_LEVEL_LABEL,
  type Alert,
  type Contact,
  type DispatchResponse,
  type GeoPoint,
  type ThreatLevel,
} from "@safecall/shared"

import { api } from "@/lib/api"
import { config } from "@/lib/env"
import { realtime } from "@/lib/realtime"
import { useLocationWatch } from "@/hooks/useLocationWatch"
import { usePushRegistration } from "@/hooks/usePushRegistration"

const DECOY_CALLER = "Mama"
const DECOY_NUMBER = "+48 600 100 200"
const DECOY_HINT = "mówi, że musisz zjeść obiad"

interface FriendAlert {
  alert: Alert
  contactId: string
  contactName: string
  dispatched: boolean
  callMe: boolean
  at: number
}

interface SafetyState {
  ready: boolean
  level: ThreatLevel
  alert: Alert | null
  contacts: Contact[]
  connected: boolean
  locationPermission: "unknown" | "granted" | "denied"
  busy: boolean
  lastError: string | null
  dispatchAck: DispatchResponse | null
  decoyCall: { visible: boolean; reason: "decoy" | "alert" } | null
  friendAlerts: FriendAlert[]
  countdown: number | null
  previewLevel: ThreatLevel
}

interface SafetyActions {
  commit: (level: ThreatLevel) => void
  standDown: () => void
  preview: (level: ThreatLevel) => void
  dismissDecoy: () => void
  acknowledgeFriendAlert: (alertId: string) => void
  refreshContacts: () => Promise<void>
}

type SafetyContextValue = SafetyState & SafetyActions

const SafetyContext = createContext<SafetyContextValue | null>(null)

interface Props {
  children: React.ReactNode
  /** Clerk session JWT, or null while signed out. */
  token: string | null
}

export function SafetyProvider({ children, token }: Props) {
  const [ready, setReady] = useState(false)
  const [level, setLevel] = useState<ThreatLevel>(0)
  const [alert, setAlert] = useState<Alert | null>(null)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)
  const [dispatchAck, setDispatchAck] = useState<DispatchResponse | null>(null)
  const [decoyCall, setDecoyCall] = useState<SafetyState["decoyCall"]>(null)
  const [friendAlerts, setFriendAlerts] = useState<FriendAlert[]>([])
  const [previewLevel, setPreviewLevel] = useState<ThreatLevel>(0)
  const [countdown, setCountdown] = useState<number | null>(null)

  const here = useRef<{ point: GeoPoint; accuracy: number | null } | null>(null)
  const decoyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const deadline = useRef<number | null>(null)
  const inFlight = useRef<Promise<void> | null>(null)

  const cancelDecoy = useCallback(() => {
    if (decoyTimer.current) clearTimeout(decoyTimer.current)
    if (tickTimer.current) clearInterval(tickTimer.current)
    decoyTimer.current = null
    tickTimer.current = null
    deadline.current = null
    setCountdown(null)
  }, [])

  const scheduleDecoy = useCallback(
    (reason: "decoy" | "alert", delayMs: number) => {
      cancelDecoy()
      deadline.current = Date.now() + delayMs
      setCountdown(Math.ceil(delayMs / 1000))

      tickTimer.current = setInterval(() => {
        if (deadline.current === null) return
        setCountdown(
          Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000))
        )
      }, 250)

      decoyTimer.current = setTimeout(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        setDecoyCall({ visible: true, reason })
        cancelDecoy()
      }, delayMs)
    },
    [cancelDecoy]
  )

  const standDown = useCallback(async () => {
    cancelDecoy()
    setDecoyCall(null)
    setLevel(0)
    setPreviewLevel(0)
    setDispatchAck(null)

    const current = alert
    setAlert(null)

    if (!current) return
    try {
      await api.updateAlert(current.id, { status: "resolved", level: 0 })
    } catch (error) {
      setLastError(describe(error))
      setAlert(current)
    }
  }, [alert, cancelDecoy])

  const commit = useCallback(
    (next: ThreatLevel) => {
      if (inFlight.current) return

      if (next === 0) {
        void standDown()
        return
      }

      const run = async () => {
        setBusy(true)
        setLastError(null)
        try {
          const response = await api.raiseAlert({
            level: next as 1 | 2 | 3,
            alertId: alert?.id,
            location: here.current?.point ?? null,
            accuracy: here.current?.accuracy ?? null,
            place: null,
          })

          setAlert(response.alert)
          setLevel(next)
          setPreviewLevel(next)

          if (next >= 1) {
            scheduleDecoy("alert", config.fakeCallDelayMs)
          } else {
            cancelDecoy()
          }
        } catch (error) {
          setLastError(describe(error))
          setLevel(alert ? alert.level : 0)
        } finally {
          setBusy(false)
          inFlight.current = null
        }
      }

      inFlight.current = run()
    },
    [alert, cancelDecoy, scheduleDecoy, standDown]
  )

  const refreshContacts = useCallback(async () => {
    try {
      setContacts(await api.contacts())
    } catch (error) {
      setLastError(describe(error))
    }
  }, [])

  const preview = useCallback((next: ThreatLevel) => setPreviewLevel(next), [])

  const dismissDecoy = useCallback(() => setDecoyCall(null), [])

  const acknowledgeFriendAlert = useCallback((alertId: string) => {
    setFriendAlerts((current) =>
      current.filter((item) => item.alert.id !== alertId)
    )
  }, [])

  useEffect(() => {
    realtime.setHandlers({
      onStatus: setConnected,
      onLocations: (next) => setContacts(next),
      onContactUpsert: (contact) =>
        setContacts((current) => {
          const rest = current.filter((item) => item.id !== contact.id)
          return [...rest, contact].sort((a, b) =>
            a.displayName.localeCompare(b.displayName)
          )
        }),
      onAlert: (payload) => {
        setFriendAlerts((current) => [
          {
            alert: payload.alert,
            contactId: payload.contact.id,
            contactName: payload.contact.displayName,
            dispatched: payload.dispatched,
            callMe: payload.callMe,
            at: Date.now(),
          },
          ...current.filter((item) => item.alert.id !== payload.alert.id),
        ])
      },
      onAlertCleared: (payload) =>
        setFriendAlerts((current) =>
          current.filter(
            (item) =>
              item.alert.id !== payload.alertId ||
              item.contactId !== payload.contactId
          )
        ),
      onDispatchAck: setDispatchAck,
      onDecoyCall: (payload) =>
        setDecoyCall({ visible: true, reason: payload.reason }),
    })
  }, [])

  useEffect(() => {
    if (!token) {
      realtime.disconnect()
      setReady(false)
      setLevel(0)
      setAlert(null)
      setContacts([])
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const [existing, list] = await Promise.all([
          api.activeAlert(),
          api.contacts(),
        ])
        if (cancelled) return
        setAlert(existing)
        setLevel(existing?.level ?? 0)
        setPreviewLevel(existing?.level ?? 0)
        setContacts(list)
      } catch (error) {
        if (!cancelled) setLastError(describe(error))
      } finally {
        if (!cancelled) setReady(true)
      }
    })()

    realtime.connect(token)

    return () => {
      cancelled = true
    }
  }, [token])

  const sendFix = useCallback(
    (point: GeoPoint, accuracy: number | null, heading: number | null) => {
      here.current = { point, accuracy }
      realtime.sendLocation({
        ...point,
        accuracy,
        heading,
        recordedAt: Date.now(),
      })
      void api
        .pushLocation({ ...point, accuracy, heading })
        .catch(() => undefined)
    },
    []
  )

  const { permission } = useLocationWatch({
    onFix: sendFix,
    enabled: Boolean(token),
  })

  usePushRegistration(Boolean(token))

  useEffect(() => cancelDecoy, [cancelDecoy])

  const value = useMemo<SafetyContextValue>(
    () => ({
      ready,
      level,
      alert,
      contacts,
      connected,
      locationPermission: permission,
      busy,
      lastError,
      dispatchAck,
      decoyCall,
      friendAlerts,
      countdown,
      previewLevel,
      commit,
      standDown,
      preview,
      dismissDecoy,
      acknowledgeFriendAlert,
      refreshContacts,
    }),
    [
      acknowledgeFriendAlert,
      alert,
      busy,
      commit,
      connected,
      contacts,
      countdown,
      decoyCall,
      dismissDecoy,
      dispatchAck,
      friendAlerts,
      lastError,
      level,
      permission,
      preview,
      previewLevel,
      ready,
      refreshContacts,
      standDown,
    ]
  )

  return (
    <SafetyContext.Provider value={value}>{children}</SafetyContext.Provider>
  )
}

export function useSafety(): SafetyContextValue {
  const value = useContext(SafetyContext)
  if (!value) throw new Error("useSafety must be used inside SafetyProvider")
  return value
}

export function describe(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Nieznany błąd"
}

export const levelLabel = (value: ThreatLevel): string =>
  THREAT_LEVEL_LABEL[value]
