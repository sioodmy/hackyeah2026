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
 */
export function applyIncomingPush(data: unknown): void {
  const payload = (data ?? {}) as PushPayload;
  const level = asNumber(payload.level) ?? 0;

  if (level <= 0 || payload.kind === 'resolved') {
    if (current) emit(null);
    return;
  }

  if (level < 2) return;

  const sentAt = asNumber(payload.at) ?? 0;
  const previous = getSnapshot();
  const alertId = asText(payload.alertId);

  // A resolved push that lost the race with its own alarm must not be re-opened by
  // a level-3 notification that was already on the wire.
  if (previous && alertId === previous.alertId && sentAt > 0 && sentAt < previous.sentAt) return;

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
