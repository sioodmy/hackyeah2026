/**
 * The threat-level state machine.
 *
 * This is where "what does level 2 actually mean" lives. It owns the escalation
 * (raising the level upgrades the live alert instead of starting a new one), the
 * 10-second delay before the fake call, and the cleanup that has to happen when
 * the user returns the slider to zero.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { AlertPayload, ApiClient, DispatchReceipt, Position } from '@/lib/api';
import {
  FAKE_CALL_DELAY_MS,
  THREAT_FULL,
  THREAT_HELP,
  THREAT_SAFE,
  type ThreatLevel,
} from '@/theme/levels';

export type CallPhase = 'idle' | 'waiting' | 'ringing' | 'active' | 'ending';

export type ThreatState = {
  level: ThreatLevel;
  alert: AlertPayload | null;
  dispatch: DispatchReceipt | null;
  /** Countdown to the fake incoming call, in seconds. */
  countdown: number | null;
  callPhase: CallPhase;
  /** Level-3 evidence session, once the backend hands one back. */
  evidenceSessionId: string | null;
  busy: boolean;
  error: string | null;
};

const INITIAL: ThreatState = {
  level: THREAT_SAFE,
  alert: null,
  dispatch: null,
  countdown: null,
  callPhase: 'idle',
  evidenceSessionId: null,
  busy: false,
  error: null,
};

export type UseThreatLevelArgs = {
  api: ApiClient;
  getPosition: () => Position | null;
  onAlertChange?: (alert: AlertPayload | null, level: ThreatLevel) => void;
  onEvidenceSession?: (sessionId: string, alertId: string) => void;
  onResolve?: () => void;
  onCallRing?: () => void;
  onCallEnd?: (declined: boolean) => void;
};

export function useThreatLevel({
  api,
  getPosition,
  onAlertChange,
  onEvidenceSession,
  onResolve,
  onCallRing,
  onCallEnd,
}: UseThreatLevelArgs) {
  const [state, setState] = useState<ThreatState>(INITIAL);

  const callTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearTimers = useCallback(() => {
    if (callTimer.current) {
      clearTimeout(callTimer.current);
      callTimer.current = null;
    }
    if (countdownTimer.current) {
      clearInterval(countdownTimer.current);
      countdownTimer.current = null;
    }
  }, []);

  // Restore an alert that was still running when the app was killed.
  useEffect(() => {
    let cancelled = false;

    api
      .activeAlert()
      .then((alert) => {
        if (cancelled || !alert) return;
        setState((prev) => ({
          ...prev,
          level: alert.level,
          alert,
          evidenceSessionId: alert.evidenceSessionId,
          callPhase: alert.level === THREAT_SAFE ? 'idle' : 'ringing',
        }));
        onAlertChange?.(alert, alert.level);
      })
      .catch(() => {
        /* the map still works without this */
      });

    return () => {
      cancelled = true;
    };
    // Runs once: deliberately not re-running when `api` identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const scheduleFakeCall = useCallback(
    (level: ThreatLevel) => {
      clearTimers();

      if (level === THREAT_SAFE) return;

      const remaining = Math.ceil(FAKE_CALL_DELAY_MS / 1000);
      setState((prev) => ({ ...prev, callPhase: 'waiting', countdown: remaining }));

      countdownTimer.current = setInterval(() => {
        const next = (stateRef.current.countdown ?? 1) - 1;
        if (next <= 0) {
          if (countdownTimer.current) clearInterval(countdownTimer.current);
          countdownTimer.current = null;
          setState((prev) => ({ ...prev, countdown: null, callPhase: 'ringing' }));
          onCallRing?.();
        } else {
          setState((prev) => ({ ...prev, countdown: next }));
        }
      }, 1000);

      callTimer.current = setTimeout(() => {
        callTimer.current = null;
        setState((prev) => ({ ...prev, countdown: null, callPhase: 'ringing' }));
        onCallRing?.();
      }, FAKE_CALL_DELAY_MS);
    },
    [clearTimers, onCallRing],
  );

  const commit = useCallback(
    async (level: ThreatLevel) => {
      const current = stateRef.current;

      // Dropping back to safe resolves whatever is running.
      if (level === THREAT_SAFE) {
        clearTimers();

        if (current.alert && current.alert.status === 'active') {
          try {
            await api.resolveAlert(current.alert.id);
          } catch {
            /* resolving locally is what matters for the user's safety */
          }
        }

        setState(INITIAL);
        onAlertChange?.(null, THREAT_SAFE);
        onResolve?.();
        return;
      }

      const position = getPosition();
      if (!position) {
        setState((prev) => ({
          ...prev,
          error: 'Brak lokalizacji — nie mogę powiadomić znajomych.',
        }));
        return;
      }

      setState((prev) => ({ ...prev, level, busy: true, error: null }));
      scheduleFakeCall(level);

      try {
        const response = await api.raiseAlert(level, position);

        setState((prev) => ({
          ...prev,
          level,
          busy: false,
          alert: response.alert,
          evidenceSessionId: response.evidenceSessionId ?? prev.evidenceSessionId,
        }));
        onAlertChange?.(response.alert, level);

        if (response.evidenceSessionId && response.alert) {
          onEvidenceSession?.(response.evidenceSessionId, response.alert.id);
        }

        // Level 3 also pages the (mock) authorities.
        if (level === THREAT_FULL) {
          try {
            const receipt = await api.dispatchAuthorities(
              response.alert.id,
              level,
              position,
              response.evidenceSessionId,
            );
            setState((prev) => ({ ...prev, dispatch: receipt }));
          } catch (err) {
            setState((prev) => ({
              ...prev,
              error: err instanceof Error ? err.message : 'Nie udało się powiadomić służb.',
            }));
          }
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          busy: false,
          error: err instanceof Error ? err.message : 'Nie udało się wysłać alertu.',
        }));
      }
    },
    [api, clearTimers, getPosition, onAlertChange, onEvidenceSession, onResolve, scheduleFakeCall],
  );

  const answerCall = useCallback(() => {
    setState((prev) => ({ ...prev, callPhase: 'active' }));
  }, []);

  const endCall = useCallback(
    (declined: boolean) => {
      clearTimers();
      setState((prev) => ({ ...prev, callPhase: 'idle', countdown: null }));
      onCallEnd?.(declined);
    },
    [clearTimers, onCallEnd],
  );

  // A fake call that is still ringing when the phone is backgrounded would be
  // missed entirely, so surface it as soon as we come back.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active' && stateRef.current.callPhase === 'ringing') {
        setState((prev) => ({ ...prev, callPhase: 'ringing' }));
      }
    });
    return () => sub.remove();
  }, []);

  return {
    ...state,
    /** True while the phone should be streaming its own location. */
    isLive: state.level >= THREAT_HELP,
    commit,
    answerCall,
    endCall,
    dismissError: useCallback(() => setState((prev) => ({ ...prev, error: null })), []),
  };
}

export type ThreatController = ReturnType<typeof useThreatLevel>;
