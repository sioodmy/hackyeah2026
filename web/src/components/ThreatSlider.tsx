/**
 * Webowy odpowiednik app/src/components/ThreatSlider.
 * Ta sama semantyka: nic nie dzieje się dopóki palec jest w dole,
 * commit dopiero przy puszczeniu gałki na danym poziomie.
 *
 * Klimat iOS 6 "slide to unlock", rozbudowany o commmit:
 * - płytki bar (fill + stopy w środku) i gruba gałka, która go OKALA;
 * - po puszczeniu gałka dojeżdża do końca i znika, a bar wypełnia się
 *   w całości kolorem poziomu — dopiero wtedy w środku pojawia się
 *   label (`caption` przekazywany z ekranu, w RN identycznie).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  colorForLevel,
  detentFor,
  label,
  levelForProgress,
  palette,
  sliderTokens,
  STOP_LEVELS,
  THREAT_SAFE,
  type ThreatLevel,
} from "../theme";

const KNOB = 56;
const TRACK_H = 72;
/** Bar ma tę samą wysokość co średnica gałki, więc jego końce są tym samym
 *  kształtem co gałka — inaczej widać, że są dwiema różnymi rzeczami. */
const BAR_H = KNOB;
const BAR_TOP = (TRACK_H - BAR_H) / 2;
const KNOB_TOP = (TRACK_H - KNOB) / 2;
/** Ile trwa dojazd gałki do końca i wypełnienie baru — obie animacje naraz. */
const COMMIT_MS = 420;
/** Ile wypełniony bar czeka, zanim wróci do pustego. */
const HOLD_MS = 1600;
/** Powrót do pustego slidera — celowo wolny, żeby nie było wrażenia skoku. */
const RESET_MS = 900;
const STOP_LABELS = ["—", "1", "2", "SOS"];
/** Wysokość ticka per poziom — rośnie z poziomem, więc skala się czyta
 *  wzrokiem, zanim palec w ogóle dotrze do stopa. */
const TICK_HEIGHT: Record<ThreatLevel, number> = { 0: 5, 1: 7, 2: 9, 3: 11 };

/**
 * Promień magnesu wyrażony jako ułamek travelu: w tej odległości od detentu
 * przyciąganie jeszcze nie działa, w samym detencie jest najsilniejsze.
 */
const MAGNET_RANGE = 0.14;
/** Ile z odległości zjada magnes w swoim centrum. */
const MAGNET_STRENGTH = 0.7;

/**
 * Przyciąga wartość do najbliższego detentu.
 *
 * Dzięki temu knoba nie płynie gładko, tylko wciąga się w kolejne stopnie —
 * animacja jest etapowa, a przy puszczeniu palca jest już blisko detentu, więc
 * spring do końca wygląda naturalnie. Na zewnątrz zakresu to zwykły clamp.
 */
function magnetize(progress: number): number {
  let nearest = 0;
  let bestDistance = Infinity;
  for (const level of STOP_LEVELS) {
    const detent = detentFor(level);
    const distance = Math.abs(progress - detent);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = detent;
    }
  }
  if (bestDistance >= MAGNET_RANGE) return progress;

  // Kwadratowy ramp: magnes włącza się ostro przy detencie, a nie na całym
  // zakresie, więc nie ma efektu „przyklejonej gąbki".
  const falloff = 1 - bestDistance / MAGNET_RANGE;
  const pull = falloff * falloff * MAGNET_STRENGTH;
  return nearest + (progress - nearest) * (1 - pull);
}

type Props = {
  onCommit: (level: ThreatLevel) => void;
  activeLevel: ThreatLevel;
  onDragLevelChange?: (level: ThreatLevel | null) => void;
  disabled?: boolean;
  /** Tekst w środku wypełnionego slidera (ekran mapy). */
  caption?: string;
};

export function ThreatSlider({
  onCommit,
  activeLevel,
  onDragLevelChange,
  disabled,
  caption,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [travel, setTravel] = useState(0);
  const [progress, setProgress] = useState(0);
  const [zone, setZone] = useState<ThreatLevel>(0);
  const [dragging, setDragging] = useState(false);
  /** true = bar wypełniony po commicie, gałka zniknęła. */
  const [filled, setFilled] = useState<ThreatLevel | null>(null);
  /** true = bar wraca do pustego; label jeszcze widoczny, gaśnie z nim. */
  const [resetting, setResetting] = useState(false);
  const zoneRef = useRef<ThreatLevel>(0);
  const draggingRef = useRef(false);
  const filledRef = useRef<ThreatLevel | null>(null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTravel(Math.max(0, el.getBoundingClientRect().width - KNOB));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const progressFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const t = Math.max(1, rect.width - KNOB);
    const raw = Math.min(1, Math.max(0, (clientX - rect.left - KNOB / 2) / t));
    return magnetize(raw);
  }, []);

  const begin = useCallback(
    (clientX: number) => {
      if (disabled) return;
      draggingRef.current = true;
      setDragging(true);
      filledRef.current = null;
      setFilled(null);
      zoneRef.current = THREAT_SAFE;
      setZone(THREAT_SAFE);
      onDragLevelChange?.(THREAT_SAFE);
      const p = progressFromClientX(clientX);
      setProgress(p);
      const crossed = levelForProgress(p);
      if (crossed !== THREAT_SAFE) {
        zoneRef.current = crossed;
        setZone(crossed);
        onDragLevelChange?.(crossed);
      }
    },
    [disabled, onDragLevelChange, progressFromClientX],
  );

  const move = useCallback(
    (clientX: number) => {
      if (!draggingRef.current) return;
      const p = progressFromClientX(clientX);
      setProgress(p);
      const crossed = levelForProgress(p);
      if (crossed !== zoneRef.current) {
        zoneRef.current = crossed;
        setZone(crossed);
        onDragLevelChange?.(crossed);
        try {
          navigator.vibrate?.(8);
        } catch {
          /* brak wibracji na desktopie */
        }
      }
    },
    [onDragLevelChange, progressFromClientX],
  );

  const end = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    onDragLevelChange?.(null);
    const level = zoneRef.current;
    if (level === THREAT_SAFE) {
      setProgress(0);
      setZone(THREAT_SAFE);
      return;
    }
    try {
      navigator.vibrate?.(level === 3 ? [30, 40, 30] : 20);
    } catch {
      /* ignore */
    }
onCommit(level);
    // Gałka dojeżdża do końca i znika; bar wypełnia się w całości.
    filledRef.current = level;
    setFilled(level);
    setResetting(false);
    window.setTimeout(() => {
      setProgress(1);
      setZone(level);
    }, 30);
    // Potem bar wraca do pustego — wolno, bez wrażenia skoku. Label zostaje
    // do końca, żeby kolorowy bar nigdy nie był bez wyjaśnienia.
    window.setTimeout(() => {
      setResetting(true);
      setProgress(0);
    }, COMMIT_MS + HOLD_MS);
    window.setTimeout(() => {
      setFilled(null);
      filledRef.current = null;
      setResetting(false);
      setZone(THREAT_SAFE);
    }, COMMIT_MS + HOLD_MS + RESET_MS);
  }, [onCommit, onDragLevelChange]);

  // Powrót do zera (rozwiązanie alertu / reset w panelu) zgasza wypełnienie.
  useEffect(() => {
    if (activeLevel === THREAT_SAFE && !draggingRef.current) {
      setProgress(0);
      setZone(THREAT_SAFE);
    }
  }, [activeLevel]);

  const shownLevel: ThreatLevel = filled ?? (dragging ? zone : activeLevel);
  const fillColor = filled !== null
    ? colorForLevel(filled)
    : dragging
      ? colorForLevel(zone)
      : activeLevel > 0
        ? colorForLevel(activeLevel)
        : palette.level0;

  const full = filled !== null && !resetting;
  const fillWidth = full ? 100 : progress * 100;
  const showCaption = filled !== null && Boolean(caption);
  // Dojazd do pełna jest szybki, powrót do pustego celowo rozciągnięty.
  const fillTransition = full
    ? `width ${COMMIT_MS}ms cubic-bezier(.22,1,.36,1)`
    : resetting
      ? `width ${RESET_MS}ms cubic-bezier(.4,0,.2,1)`
      : undefined;
  // Ten sam rozświetlony wierzch, co ma gałka (tokeny), nałożony na kolor
  // poziomu — dlatego pasek i gałka wyglądają jak jeden materiał.
  const fillBackground = `linear-gradient(180deg, ${sliderTokens.fillSheenTop} 0%, ${sliderTokens.fillSheenMid} 45%, ${sliderTokens.fillSheenBottom} 100%), ${fillColor}`;

  return (
    <div
      className="tslider"
      role="slider"
      aria-valuemin={0}
      aria-valuemax={3}
      aria-valuenow={activeLevel}
      aria-valuetext={label(activeLevel) || 'Bezpiecznie'}
      aria-label="Poziom zagrożenia"
    >
      <div
        ref={trackRef}
        className="tslider-track"
        style={{ height: TRACK_H, opacity: disabled ? 0.5 : 1 }}
        onPointerDown={(e) => {
          // Może rzucić, gdy palec już nie jest aktywny (szybki tap) —
          // wtedy i tak nic nie ma do przeciągania.
          try {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          } catch {
            /* ignorujemy */
          }
          begin(e.clientX);
        }}
        onPointerMove={(e) => move(e.clientX)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="tslider-bar" style={{ height: BAR_H, top: BAR_TOP }}>
          <div
            className="tslider-fill"
            style={{
              width: fillWidth + "%",
              background: fillBackground,
              transition: fillTransition,
            }}
          />
          {/* Stopy w środku bara, pod gałką: tick + label. Sam tick jest
              magnesem — patrz `magnetize`. */}
          <div className="tslider-stops" aria-hidden style={{ opacity: filled !== null ? 0 : 1 }}>
            {STOP_LEVELS.map((level) => {
              const highlighted = level === shownLevel;
              const tint = level === THREAT_SAFE ? palette.text : colorForLevel(level);
              return (
                <div
                  key={level}
                  className="tslider-stop"
                  style={{ left: `calc(${KNOB / 2}px + ${detentFor(level)} * (100% - ${KNOB}px))` }}
                >
                  <span
                    className="tslider-tick"
                    style={{ height: TICK_HEIGHT[level], opacity: highlighted ? 0.5 : 0.22 }}
                  />
                  <span
                    className="tslider-stop-label"
                    style={highlighted ? { color: tint, opacity: 0.9 } : undefined}
                  >
                    {STOP_LABELS[level]}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Label w środku wypełnionego baru. */}
          {showCaption ? (
            <span
              className="tslider-caption"
              style={{ color: filled === 1 ? '#1A1405' : '#FFFFFF' }}
            >
              {caption}
            </span>
          ) : null}
        </div>
        {/* Gruba gałka okalająca bar — wypełnienie ją chowa. */}
        {filled === null ? (
          <div
            className="tslider-knob"
            style={{
              width: KNOB,
              height: KNOB,
              top: KNOB_TOP,
              transform: `translateX(${progress * travel}px)`,
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 5L12 12L6 19" stroke="rgba(0,0,0,0.38)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 5L18 12L12 19" stroke="rgba(0,0,0,0.38)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {activeLevel === 3 && !dragging ? <span className="tslider-ring" /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}