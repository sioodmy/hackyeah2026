/**
 * Webowe odpowiedniki:
 * - app/src/components/IncomingCallOverlay (fake incoming call ofiary)
 * - app/src/components/FriendAlarmOverlay (CallRequestScreen + AlarmScreen znajomej)
 */
import { useEffect, useState } from "react";
import type { ThreatLevel } from "../theme";

export function IncomingCallOverlay({
  level,
  contact,
  onAnswer,
  onDecline,
}: {
  level: ThreatLevel;
  contact: { name: string; relation: string };
  onAnswer: () => void;
  onDecline: () => void;
}) {
  const [answered, setAnswered] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    setAnswered(false);
    setSecondsLeft(5);
  }, [contact]);

  useEffect(() => {
    if (!answered) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          onDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [answered, onDecline]);

  const mm = Math.floor(secondsLeft / 60);
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="phone-modal">
      <div className="call-head">
        <div className="call-caller">{contact.name}</div>
        <div className="call-channel">{contact.relation}</div>
      </div>
      <div className="call-body">
        <div className="call-avatar">{contact.name.slice(0, 1)}</div>
        {answered ? (
          <>
            <div className="call-timer">
              {mm}:{ss}
            </div>
            <button
              className="pill-btn"
              onClick={() => {
                setAnswered(false);
                onDecline();
              }}
            >
              Zakończ
            </button>
          </>
        ) : (
          level >= 2 && <div className="call-badge">lokalizacja wysłana</div>
        )}
      </div>
      {!answered && (
        <div className="call-actions">
          <div className="call-action-col">
            <button
              className="call-btn decline"
              onClick={onDecline}
              aria-label="Odrzuć połączenie"
            >
              ✕
            </button>
            <span>Odrzuć</span>
          </div>
          <div className="call-action-col">
            <button
              className="call-btn accept"
              onClick={() => {
                setAnswered(true);
                onAnswer();
              }}
              aria-label="Odbierz połączenie"
            >
              ✓
            </button>
            <span>Odbierz</span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Ulica i orientacyjna odległość — człowiek szuka miejsca, nie współrzędnych.
 * Trzyma się Tauron Arena, bo mapa demo jest wyśrodkowana na hali.
 */
const MOCK_ADDRESS = "Tauron Arena, ul. Unii Lubelskiej 1";

export function FriendCallScreen({
  name,
  onAnswer,
  onDecline,
}: {
  name: string;
  onAnswer: () => void;
  onDecline: () => void;
}) {
  const [answered, setAnswered] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    if (!answered) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          onAnswer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [answered, onAnswer]);

  return (
    <div className="phone-modal">
      <div className="call-head">
        <div className="call-caller">{name}</div>
      </div>
      <div className="call-body">
        <div className="call-avatar">{name.slice(0, 1).toUpperCase()}</div>
        {answered ? (
          <>
            <div className="call-timer">
              {Math.floor(secondsLeft / 60)}:
              {String(secondsLeft % 60).padStart(2, "0")}
            </div>
            <button className="pill-btn" onClick={onDecline}>
              Zakończ
            </button>
          </>
        ) : (
          <div className="call-coords">{MOCK_ADDRESS}</div>
        )}
      </div>
      {!answered && (
        <div className="call-actions">
          <div className="call-action-col">
            <button
              className="call-btn decline"
              onClick={onDecline}
              aria-label="Odrzuć połączenie"
            >
              ✕
            </button>
            <span>Nie teraz</span>
          </div>
          <div className="call-action-col">
            <button
              className="call-btn accept"
              onClick={() => {
                setAnswered(true);
              }}
              aria-label="Odbierz połączenie"
            >
              ✓
            </button>
            <span>Odbierz</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function FriendAlarmScreen({
  name,
  onOnTheWay,
  onSeen,
}: {
  name: string;
  onOnTheWay: () => void;
  onSeen: () => void;
}) {
  return (
    <div className="phone-modal alarm">
      <div className="alarm-glow" />
      <div className="alarm-body">
        <div className="alarm-kicker">Pełny alarm</div>
        <div className="alarm-name">{name}</div>
        <div className="alarm-text">
          Pilnie potrzebuje pomocy. Powiadomimy Cię o aktualizacjach
        </div>
        <div className="alarm-coords">{MOCK_ADDRESS}</div>
      </div>
      <div className="alarm-actions">
        <button className="alarm-primary" onClick={onOnTheWay}>
          Zadzwoń
        </button>
        <button className="alarm-secondary" onClick={onSeen}>
          Zamknij
        </button>
      </div>
    </div>
  );
}
