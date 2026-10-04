/**
 * Webowy odpowiednik app/src/components/ThreatSlider.
 * Ta sama semantyka: nic nie dzieje się dopóki palec jest w dole,
 * commit dopiero przy puszczeniu gałki na danym poziomie.
 *
 * Klimat iOS 6 "slide to unlock", rozbudowany o commit:
 * - przydymiony bar (ten sam materiał co pigułki na mapie) z wklęsłym
 *   cieniem i szklaną gałką, której średnica = wysokość baru;
 * - wypełnienie zawsze sięga prawej krawędzi gałki, więc gałka leży NA
 *   kolorze, a nie przecina go w połowie;
 * - póki palec jest w dole, nad sliderem wisi dymek z tym, co się stanie po
 *   puszczeniu — kciuk zasłania stopy, więc bez niego leci się na ślepo;
 * - po puszczeniu gałka dojeżdża do końca i rozpływa się, bar wypełnia się
 *   kolorem poziomu, przejeżdża po nim odblask, a w środku pojawia się label
 *   (`caption` przekazywany z ekranu, w RN identycznie);
 * - potem wszystko wraca: gałka odjeżdża na start, ciągnąc wypełnienie.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  colorForLevel,
  detentFor,
  label,
  levelForProgress,
  MAX_LEVEL,
  palette,
  sliderTokens as T,
  STOP_LEVELS,
  textOnLevel,
  THREAT_SAFE,
  type ThreatLevel,
} from "../theme";

const KNOB = T.knob;
const TRACK_H = T.track;
/** Bar ma tę samą wysokość co średnica gałki, więc jego końce są tym samym
 *  kształtem co gałka — inaczej widać, że są dwiema różnymi rzeczami. */
const BAR_H = T.bar;
const BAR_TOP = (TRACK_H - BAR_H) / 2;
const KNOB_TOP = (TRACK_H - KNOB) / 2;
const STOP_LABELS = ["—", "1", "2", "SOS"];

/** Krzywe — te same charaktery co springi/easingi w RN. */
const EASE_OUT = "cubic-bezier(.22,1,.36,1)";
const EASE_IN_OUT = "cubic-bezier(.65,0,.35,1)";
/** Lekki overshoot przy powrocie gałki, gdy puszczono ją przed stopem 1. */
const EASE_SPRING = "cubic-bezier(.34,1.56,.64,1)";
const SPRING_BACK_MS = 420;
/** Minimalne wygładzenie ruchu za palcem — tłumi drganie, nie daje laga. */
const FOLLOW_MS = 70;
/**
 * Czas jednego automatycznego przeciągnięcia.
 *
 * Wystarczająco wolno, żeby widz zobaczył ruch gałki, i wystarczająco krótko,
 * żeby cały scenariusz poziomu 3 (przeciągnięcie → 5 s odliczania → fake call
 * → telefon znajomej) nie ciągnął się pół minuty.
 */
const AUTO_DRAG_MS = 900;

/**
 * Przyciąga wartość do najbliższego detentu.
 *
 * Dzięki temu gałka nie płynie gładko, tylko wciąga się w kolejne stopnie —
 * animacja jest etapowa, a przy puszczeniu palca jest już blisko detentu, więc
 * dojazd do końca wygląda naturalnie. Na zewnątrz zakresu to zwykły clamp.
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
  if (bestDistance >= T.magnetRange) return progress;

  // Kwadratowy ramp: magnes włącza się ostro przy detencie, a nie na całym
  // zakresie, więc nie ma efektu „przyklejonej gąbki".
  const falloff = 1 - bestDistance / T.magnetRange;
  const pull = falloff * falloff * T.magnetStrength;
  return nearest + (progress - nearest) * (1 - pull);
}

/** `#RRGGBB` + alfa 0..1 → `#RRGGBBAA`. */
function withAlpha(hex: string, alpha: number): string {
  return (
    hex +
    Math.round(alpha * 255)
      .toString(16)
      .padStart(2, "0")
  );
}

/**
 * idle   — spoczynek, gałka na starcie (albo właśnie tam wraca po anulowaniu)
 * drag   — palec w dole
 * filled — po commicie: dojazd do końca + przytrzymanie z labelem
 * reset  — gałka wraca na start, ciągnąc wypełnienie
 */
type Phase = "idle" | "drag" | "filled" | "reset";

type Props = {
  onCommit: (level: ThreatLevel) => void;
  activeLevel: ThreatLevel;
  onDragLevelChange?: (level: ThreatLevel | null) => void;
  disabled?: boolean;
  /**
   * Tekst od ekranu: podczas przeciągania trafia do dymka nad sliderem,
   * po commicie do środka wypełnionego baru.
   */
  caption?: string;
  /**
   * Automatyczne przeciągnięcie — prezentacja „klika" suwak za widza, gdy ten
   * nie zorientuje się, że telefon w ogóle jest klikalny.
   *
   * `nonce` rośnie przy każdym kliknięciu, bo sam `level` jako zależność
   * efektu nie odpaliłby go drugi raz dla tego samego poziomu.
   */
  autoDrag?: { level: ThreatLevel; nonce: number } | null;
};

/**
 * Wymiary tracka w jego własnej, nieskalowanej przestrzeni.
 *
 * `getBoundingClientRect()` zwraca piksele **po** transformacjach przodków, a
 * `translateX` liczymy w pikselach layoutu. W landingu telefon jest
 * przeskalowany (`transform: scale(0.72)`), więc wymiar z recta byłby 0.72×
 * za mały — gałka nie dochodziłaby do końca i magnet ciągnąłby ją w złym
 * miejscu. `offsetWidth` nie zależy od transformacji, a skalę wyliczamy, żeby
 * poprawnie przeliczyć współrzędne wskaźnika.
 */
function localMetrics(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const layoutWidth = el.offsetWidth || rect.width || 1;
  const scale = rect.width / layoutWidth || 1;
  return { rect, layoutWidth, scale };
}

export function ThreatSlider({
  onCommit,
  activeLevel,
  onDragLevelChange,
  disabled,
  caption,
  autoDrag,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [travel, setTravel] = useState(0);
  const [progress, setProgress] = useState(0);
  const [zone, setZone] = useState<ThreatLevel>(THREAT_SAFE);
  const [phase, setPhase] = useState<Phase>("idle");
  /** Poziom, którym wypełnia się bar po commicie. */
  const [filledLevel, setFilledLevel] = useState<ThreatLevel | null>(null);
  /** Trwa automatyczne przeciągnięcie — wtedy `motion` to długa tranzycja. */
  const [autoMoving, setAutoMoving] = useState(false);
  /** Ostatni tekst dymka — zostaje na czas gaśnięcia, żeby nie mrugnął. */
  const [bubbleText, setBubbleText] = useState("");
  /** Licznik commitów — restartuje animację odblasku. */
  const [commitId, setCommitId] = useState(0);
  const zoneRef = useRef<ThreatLevel>(THREAT_SAFE);
  const draggingRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () =>
      setTravel(Math.max(0, localMetrics(el).layoutWidth - KNOB));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Dymek pokazuje to, co ekran mówi o strefie pod palcem.
  const dragging = phase === "drag";
  useEffect(() => {
    if (dragging && caption) setBubbleText(caption);
  }, [dragging, caption]);

  const progressFromClientX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const { rect, layoutWidth, scale } = localMetrics(el);
    // Współrzędna wskaźnika w pikselach layoutu, nie w pikselach ekranu.
    const local = (clientX - rect.left) / scale;
    const t = Math.max(1, layoutWidth - KNOB);
    const raw = Math.min(1, Math.max(0, (local - KNOB / 2) / t));
    return magnetize(raw);
  }, []);

  const setZoneTo = useCallback(
    (level: ThreatLevel, buzz: boolean) => {
      if (level === zoneRef.current) return;
      zoneRef.current = level;
      setZone(level);
      onDragLevelChange?.(level);
      if (buzz) {
        try {
          navigator.vibrate?.(8);
        } catch {
          /* brak wibracji na desktopie */
        }
      }
    },
    [onDragLevelChange],
  );

  const begin = useCallback(
    (clientX: number) => {
      if (disabled) return;
      // Nowy gest przerywa wszystko, co zostało po poprzednim commicie —
      // inaczej zaległy timer resetu ściągnąłby gałkę spod palca.
      clearTimers();
      draggingRef.current = true;
      setPhase("drag");
      setFilledLevel(null);
      zoneRef.current = THREAT_SAFE;
      setZone(THREAT_SAFE);
      onDragLevelChange?.(THREAT_SAFE);
      const p = progressFromClientX(clientX);
      setProgress(p);
      setZoneTo(levelForProgress(p), false);
    },
    [clearTimers, disabled, onDragLevelChange, progressFromClientX, setZoneTo],
  );

  const move = useCallback(
    (clientX: number) => {
      if (!draggingRef.current) return;
      const p = progressFromClientX(clientX);
      setProgress(p);
      setZoneTo(levelForProgress(p), true);
    },
    [progressFromClientX, setZoneTo],
  );

  /** Commit z animacją: dojazd, przytrzymanie, powrót. */
  const fire = useCallback(
    (level: ThreatLevel) => {
      clearTimers();
      try {
        navigator.vibrate?.(level === MAX_LEVEL ? [30, 40, 30] : 20);
      } catch {
        /* ignore */
      }
      onCommit(level);
      zoneRef.current = level;
      setZone(level);
      setFilledLevel(level);
      setCommitId((n) => n + 1);
      setPhase("filled");
      setProgress(1);
      // Label zostaje aż do końca powrotu, żeby kolorowy bar nigdy nie był
      // bez wyjaśnienia; gaśnie razem z nim.
      later(() => {
        setPhase("reset");
        setProgress(0);
      }, T.commitMs + T.holdMs);
      later(
        () => {
          setPhase("idle");
          setFilledLevel(null);
          zoneRef.current = THREAT_SAFE;
          setZone(THREAT_SAFE);
        },
        T.commitMs + T.holdMs + T.resetMs,
      );
    },
    [clearTimers, later, onCommit],
  );

  /**
   * Auto-przeciągnięcie: wolny dojazd gałki do detentu wybranego poziomu,
   * potem zwykły commit. Idzie tym samym `setZoneTo` co palec, więc bąbelek,
   * podpisy przystanków zachowują się jak przy prawdziwym przeciągnięciu —
   * prezentacja nie udaje czegoś, czego nie ma w apce.
   *
   * Ruch jest **jednym** skokiem postępu plus długą tranzycją CSS, a nie
   * animacją po `requestAnimationFrame`. Powód: klatki rAF bywają głodzone
   * (w podglądzie pierwsza klatka przychodziła ~900 ms po effekcie), więc
   * przy liczeniu postępu z zegara gałka stała nieruchomo, a potem przeskakiwała
   * z 0 na koniec — wyglądało to jak ucieczka poza pasek. Tranzycję liczy
   * compositor, więc jest płynna niezależnie od obciążenia głównego wątku,
   * a pojedynczy skok postępu nie może przekroczyć detentu.
   */
  const autoNonce = autoDrag?.nonce;
  useEffect(() => {
    const target = autoDrag?.level;
    // `!target` odsiewa też `THREAT_SAFE` (0) — nie ma poziomu do odtwarzania.
    if (autoNonce === undefined || !target) return;
    if (disabled) return;

    clearTimers();
    draggingRef.current = true;
    setPhase("drag");
    setFilledLevel(null);
    zoneRef.current = target;
    setZone(target);
    onDragLevelChange?.(target);

    // Postęp od razu na detent; długa tranzycja w `motion` go tam dowieździe.
    setAutoMoving(true);
    setProgress(detentFor(target));

    later(() => {
      setAutoMoving(false);
      draggingRef.current = false;
      fire(target);
    }, AUTO_DRAG_MS);

    return () => setAutoMoving(false);
  }, [autoNonce]);

  const end = useCallback(() => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    onDragLevelChange?.(null);
    const level = zoneRef.current;
    if (level === THREAT_SAFE) {
      // Puszczone przed pierwszym stopem — nic się nie dzieje, gałka wraca.
      setPhase("idle");
      setProgress(0);
      return;
    }
    fire(level);
  }, [fire, onDragLevelChange]);

  // Klawiatura = akcje dostępności w RN (increment / decrement).
  const onKeyDown = (e: KeyboardEvent) => {
    if (disabled || draggingRef.current) return;
    const step =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = Math.min(
      MAX_LEVEL,
      Math.max(THREAT_SAFE, activeLevel + step),
    ) as ThreatLevel;
    if (next === activeLevel) return;
    if (next === THREAT_SAFE) onCommit(THREAT_SAFE);
    else fire(next);
  };

  // Powrót do zera z zewnątrz (rozwiązanie alertu / reset w panelu) gasi
  // wypełnienie od razu, bez czekania na timery.
  useEffect(() => {
    if (activeLevel === THREAT_SAFE && !draggingRef.current) {
      clearTimers();
      setPhase((p) => (p === "idle" ? p : "reset"));
      setProgress(0);
      later(() => {
        setPhase("idle");
        setFilledLevel(null);
        zoneRef.current = THREAT_SAFE;
        setZone(THREAT_SAFE);
      }, T.resetMs);
    }
  }, [activeLevel, clearTimers, later]);

  // ---- wygląd ---------------------------------------------------------
  const fillLevel: ThreatLevel = filledLevel ?? zone;
  const fillColor = colorForLevel(fillLevel);
  const p = Math.min(1, Math.max(0, progress));
  const full = phase === "filled";
  const fillVisible = phase !== "idle";
  /**
   * Palec jest na maksie i jeszcze go nie puszczono — najpoważniejszy moment
   * interakcji, więc pasek musi to komunikować pulsowaniem, zanim cokolwiek
   * się wydarzy. Sam commit jest wtedy już za późno, żeby zbudować napięcie.
   */
  const atMaxDragging = phase === "drag" && zone === MAX_LEVEL && !filledLevel;

  const motion = autoMoving
    ? `${AUTO_DRAG_MS}ms ${EASE_IN_OUT}`
    : phase === "drag"
      ? `${FOLLOW_MS}ms linear`
      : phase === "filled"
        ? `${T.commitMs}ms ${EASE_OUT}`
        : phase === "reset"
          ? `${T.resetMs}ms ${EASE_IN_OUT}`
          : `${SPRING_BACK_MS}ms ${EASE_SPRING}`;

  const fillStyle: CSSProperties = {
    // Wypełnienie kończy się na prawej krawędzi gałki — gałka leży na
    // kolorze, a przy p = 1 bar jest pełny.
    width: `calc(${KNOB}px + ${p} * (100% - ${KNOB}px))`,
    backgroundColor: fillColor,
    // Ten sam rozświetlony wierzch, co ma gałka (tokeny), nałożony na kolor
    // poziomu — dlatego pasek i gałka wyglądają jak jeden materiał.
    backgroundImage: `linear-gradient(180deg, ${T.fillSheenTop} 0%, ${T.fillSheenMid} 45%, ${T.fillSheenBottom} 100%)`,
    opacity: fillVisible ? 1 : 0,
    transition: `width ${motion}, background-color ${T.zoneBlendMs}ms ease, opacity ${T.fadeMs}ms ease`,
  };

  // puls nakładany na wypełnienie — nie mieszam go z gradientem materiału,
  // bo puls musi wracać do zera przy puszczeniu, a gradient ma zostać.
  const fillPulseStyle: CSSProperties = atMaxDragging
    ? {
        opacity: 1,
        animation: `tsliderPulse ${T.maxPulseMs}ms ease-in-out infinite`,
      }
    : { opacity: 0 };

  const barStyle: CSSProperties = {
    height: BAR_H,
    top: BAR_TOP,
    background: T.barFill,
    borderColor: T.barBorder,
    // Po commicie bar delikatnie świeci kolorem poziomu.
    boxShadow:
      full && filledLevel !== null
        ? `${T.barShadow}, 0 0 0 1px ${withAlpha(fillColor, 0.35)}, 0 6px 26px ${withAlpha(fillColor, 0.45)}`
        : atMaxDragging
          ? `${T.barShadow}, 0 0 22px ${withAlpha(fillColor, 0.55)}`
          : `${T.barShadow}, ${T.barInset}`,
  };

  const knobStyle: CSSProperties = {
    width: KNOB,
    height: KNOB,
    top: KNOB_TOP,
    background: `linear-gradient(180deg, ${T.knobGradient[0]}, ${T.knobGradient[1]})`,
    borderColor: T.knobBorder,
    backdropFilter: `blur(${T.knobBlur}px) saturate(${T.knobSaturate})`,
    WebkitBackdropFilter: `blur(${T.knobBlur}px) saturate(${T.knobSaturate})`,
    boxShadow: `${T.knobShadow}, inset 0 1px 0 rgba(255,255,255,.6)`,
    transform: `translateX(${p * travel}px) scale(${dragging ? T.knobPressedScale : 1})`,
    // Przy commicie gałka rozpływa się dopiero pod koniec dojazdu.
    opacity: full ? 0 : 1,
    transition: `transform ${motion}, opacity ${full ? `${T.fadeMs}ms ease ${Math.round(T.commitMs * 0.6)}ms` : `${T.fadeMs + 60}ms ease`}`,
  };

  const textOnFill = textOnLevel(fillLevel);
  const showStops = !full;

  return (
    <div
      className="tslider"
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={0}
      aria-valuemax={3}
      aria-valuenow={activeLevel}
      aria-valuetext={label(activeLevel) || "Bezpiecznie"}
      aria-label="Poziom zagrożenia"
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
    >
      {/* Dymek nad sliderem — tylko póki palec jest w dole. */}
      <div
        className={
          dragging && bubbleText ? "tslider-bubble is-on" : "tslider-bubble"
        }
        aria-hidden
      >
        <span
          className="tslider-bubble-dot"
          style={{
            background:
              zone === THREAT_SAFE ? palette.textMuted : colorForLevel(zone),
          }}
        />
        {bubbleText}
      </div>

      <div
        ref={trackRef}
        className="tslider-track"
        style={{ height: TRACK_H, opacity: disabled ? 0.5 : 1 }}
        onPointerDown={(e) => {
          // Może rzucić, gdy palec już nie jest aktywny (szybki tap) —
          // wtedy i tak nic nie ma do przeciągania.
          try {
            e.currentTarget.setPointerCapture?.(e.pointerId);
          } catch {
            /* ignorujemy */
          }
          begin(e.clientX);
        }}
        onPointerMove={(e) => move(e.clientX)}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <div className="tslider-bar" style={barStyle}>
          <div className="tslider-fill" style={fillStyle} />
          {/* Puls siedzi NAD wypełnieniem, bo ma rozjaśniać kolor, a nie go
              zastępować — dlatego nie miesza się go z gradientem materiału. */}
          <div className="tslider-pulse" style={fillPulseStyle} />

          {/* Odblask przejeżdża raz, gdy bar się wypełni. */}
          {full ? (
            <span
              key={commitId}
              className="tslider-shine"
              style={{
                background: `linear-gradient(100deg, transparent 20%, ${T.shine} 50%, transparent 80%)`,
                animationDuration: `${T.shineMs}ms`,
                animationDelay: `${Math.round(T.commitMs * 0.75)}ms`,
              }}
            />
          ) : null}

          {/* Stopy w środku bara, pod gałką: tick + label. Sam tick jest
              magnesem — patrz `magnetize`. */}
          <div
            className="tslider-stops"
            aria-hidden
            style={{ opacity: showStops ? 1 : 0 }}
          >
            {STOP_LEVELS.map((level) => {
              const d = detentFor(level);
              // Stop leży na wypełnieniu, gdy jego środek jest przed prawą
              // krawędzią gałki — wtedy potrzebuje kontrastu z kolorem.
              const covered =
                fillVisible && d * travel <= KNOB / 2 + p * travel;
              const live =
                !covered &&
                phase === "idle" &&
                level !== THREAT_SAFE &&
                level === activeLevel;
              const color = covered
                ? textOnFill
                : live
                  ? colorForLevel(level)
                  : T.stopLabelIdle;
              const tickOpacity = covered
                ? 0.5
                : live
                  ? T.tickOpacityActive
                  : T.tickOpacityIdle;
              return (
                <div
                  key={level}
                  className="tslider-stop"
                  style={{
                    left: `calc(${KNOB / 2}px + ${d} * (100% - ${KNOB}px))`,
                    width: T.stopWidth,
                    marginLeft: -T.stopWidth / 2,
                  }}
                >
                  <span
                    className="tslider-tick"
                    style={{
                      width: T.tickWidth,
                      height: T.tickHeight[level],
                      background: covered ? textOnFill : palette.text,
                      opacity: tickOpacity,
                    }}
                  />
                  <span
                    className="tslider-stop-label"
                    style={{
                      color,
                      opacity: covered ? 0.7 : 1,
                      fontSize: T.stopLabelSize,
                    }}
                  >
                    {STOP_LABELS[level]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Label w środku wypełnionego baru. */}
          {filledLevel !== null && caption ? (
            <span
              className={full ? "tslider-caption is-on" : "tslider-caption"}
              style={{
                color: textOnLevel(filledLevel),
                transitionDelay: full
                  ? `${Math.round(T.commitMs * 0.55)}ms`
                  : "0ms",
              }}
            >
              {/* Na najwyższym poziomie za labelem jeżdżą dwa rozmyte
                  światła — czerwone i niebieskie. To komunikat wizualny
                  („to się dzieje"), bo licznik sekund celowo zniknął. */}
              {filledLevel === MAX_LEVEL ? (
                <span className="tslider-siren" aria-hidden>
                  <span className="tslider-siren-lamp is-red" />
                  <span className="tslider-siren-lamp is-blue" />
                </span>
              ) : null}
              <span className="tslider-caption-text">{caption}</span>
            </span>
          ) : null}
        </div>

        {/* Szklana gałka — przy commicie dojeżdża do końca i się rozpływa. */}
        <div className="tslider-knob" style={knobStyle}>
          <svg
            className={
              phase === "idle" ? "tslider-grip is-hinting" : "tslider-grip"
            }
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            style={{ animationDuration: `${T.gripHintMs}ms` }}
          >
            <path
              d="M6 5L12 12L6 19"
              stroke={T.knobGrip}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 5L18 12L12 19"
              stroke={T.knobGrip}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {activeLevel === MAX_LEVEL && phase === "idle" ? (
            <span className="tslider-ring" />
          ) : null}
        </div>
      </div>
    </div>
  );
}
