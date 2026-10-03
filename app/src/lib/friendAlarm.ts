/**
 * What a friend's phone currently has to do about somebody else's alarm.
 *
 * The push that arrives on a friend's phone is the only channel that works when
 * their app is killed, so everything about the escalation lives in one module
 * store rather than in a screen: the notification listener writes here, and the
 * overlay rendered above the router reads it. Level 1 never gets this far — a
 * notification is the whole delivery. Level 2 is a call request, level 3 an alarm.
 *
 * Module state (rather than a hook) because the listener is registered at the root
 * layout while the overlay that renders it is a sibling of the router.
 */

import { useSyncExternalStore } from 'react';

export type IncomingAlert = {
  alertId: string;
  /** 2 = call request, 3 = alarm. Level 1 is a notification and never gets here. */
  level: 2 | 3;
  /** Display name of the person in danger, as their friend knows them. */
  from: string;
  lat: number | null;
  lng: number | null;
  /** Server clock when the push was built, in seconds. */
  sentAt: number;
};

type PushPayload = {
  level?: unknown;
  kind?: unknown;
  alertId?: unknown;
  from?: unknown;
  lat?: unknown;
  lng?: unknown;
  at?: unknown;
};

export const UNKNOWN_SENDER = 'Ktoś z bliskich';

let current: IncomingAlert | null = null;
const listeners = new Set<() => void>();

/**
 * What each alert has already done on this phone.
 *
 * Two jobs. `seen` swallows a notification that Expo or FCM delivers twice, so a
 * friend does not get a second siren for the same push. `resolved` outlives the
 * overlay on purpose: once an alert has been resolved, a level-2 or level-3 push
 * that was already on the wire must not be able to re-open a call screen for it,
 * and that has to hold even after the overlay has been dismissed.
 */
const seen = new Map<string, { sentAt: number; level: number }>();
const resolved = new Map<string, number>();

/** Keep the bookkeeping bounded on a phone that never restarts. */
const REMEMBERED_ALERTS = 8;

function remember<T>(store: Map<string, T>, key: string, value: T): void {
  if (!store.has(key) && store.size >= REMEMBERED_ALERTS) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, value);
}

/**
 * Whether a push is worth acting on.
 *
 * Rejects anything older than what this alert has already done, and the exact same
 * push arriving again. An escalation that lands in the same second as the push
 * before it still counts, because the level is higher.
 */
function isFresh(alertId: string, sentAt: number, level: number): boolean {
  const resolvedAt = resolved.get(alertId);
  if (resolvedAt !== undefined && sentAt <= resolvedAt) return false;

  const previous = seen.get(alertId);
  if (previous) {
    if (sentAt < previous.sentAt) return false;
    if (sentAt === previous.sentAt && level <= previous.level) return false;
  }

  remember(seen, alertId, { sentAt, level });
  return true;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): IncomingAlert | null {
  return current;
}

function emit(next: IncomingAlert | null): void {
  current = next;
  listeners.forEach((listener) => listener());
}

/** The alarm or call the friend's phone is currently showing, if any. */
export function useIncomingAlert(): IncomingAlert | null {
  return useSyncExternalStore(subscribe, getSnapshot);
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

/**
 * Act on a push payload.
 *
 * Anything below level 2 is deliberately dropped: the system notification already
 * said it, and taking over a friend's screen for it would train them to swipe
 * PanicMap away without reading. Level 0 is the opposite — it silences whatever is
 * ringing, because the person in danger is safe again and a friend still looking
 * at an alarm for an episode that ended is worse than no alarm at all.
 *
 * Both are scoped to one alert: a friend can be alarmed by more than one person at
 * a time, so resolving one of them must never silence the other.
 */
export function applyIncomingPush(data: unknown): void {
  const payload = (data ?? {}) as PushPayload;
  const level = asNumber(payload.level) ?? 0;
  const alertId = asText(payload.alertId);
  const sentAt = asNumber(payload.at) ?? 0;

  if (level <= 0 || payload.kind === 'resolved') {
    // A resolution we cannot attribute is ignored rather than applied: silencing a
    // live alarm from someone else is worse than leaving a stale one ringing, and
    // the backend always sends `alertId` with a resolve.
    if (!alertId) return;
    const alreadyResolved = resolved.get(alertId);
    if (alreadyResolved === undefined || sentAt > alreadyResolved) {
      remember(resolved, alertId, sentAt);
    }
    if (current?.alertId === alertId) emit(null);
    return;
  }

  if (level < 2 || !alertId) return;

  if (!isFresh(alertId, sentAt, level)) return;

  emit({
    alertId,
    level: level >= 3 ? 3 : 2,
    from: asText(payload.from) || UNKNOWN_SENDER,
    lat: asNumber(payload.lat),
    lng: asNumber(payload.lng),
    sentAt,
  });
}

/** Drop the current alarm. Called when the overlay's user deals with it. */
export function clearIncomingAlert(): void {
  if (current) emit(null);
}
