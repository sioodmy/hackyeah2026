import React, { useMemo, useRef } from "react";
import { DemoPhone, type DemoFrame, type DemoHandle } from "@demo";
import {
  DEVICE_SIZE,
  DeviceFrame,
  SAFE_BOTTOM,
  SAFE_TOP,
  type DeviceVariant,
} from "@landing/components/DeviceFrame";
import { colorForLevel } from "@app/theme/tokens";
import type { ThreatLevel } from "@app/theme/levels";

/**
 * Jedno gniazdo prezentacyjne: obudowa telefonu + ten sam `DemoPhone`, którego
 * używa landing i podgląd developerski. Nie ma tu żadnej kopii UI — klatkę
 * ustawiamy przez `DemoHandle`, czyli tym samym API, którym steruje prezentacja
 * na landingu.
 *
 * `script` opisuje *klatkę*, nie animację: eksport PDF nie ma czasu, więc każdy
 * scenariusz musi dać się ustawić i zostać w tym stanie.
 */
export type DemoScript =
  /** Samo mapowanie — poziom 0 albo wypełniony suwak bez żadnej nakładki. */
  | { kind: "map"; level?: 0 | 1 | 2 | 3; heatmap?: boolean }
  /** Fałszywe połączenie przychodzące na telefonie ofiary. */
  | { kind: "call"; level: 1 | 2 | 3 }
  /** Telefon znajomej: prośba o połączenie (poziom 2). */
  | { kind: "friendCall"; level: 2 }
  /** Telefon znajomej: alarm krytyczny (poziom 3). */
  | { kind: "friendAlarm"; level: 3 };

/** Wysokość zarezerwowana pod etykietę pod telefonem. */
const LABEL_H = 30;

/**
 * Scenariusz → klatka.
 *
 * `DemoPhone.frame` opisuje stan w jednej turze, bez żadnych timerów, więc
 * ten sam slajd wygląda identycznie przy każdym uruchomieniu — a to warunek
 * powtarzalnego wydruku. Timery demo (5 s odliczania, auto-odbieranie po
 * 1,2 s, reset 2 s później) przy klatce są wyłączone.
 */
const KASIA_ANSWERED = {
  userId: "kasia",
  displayName: "Kasia",
  action: "answered" as const,
};
const KASIA_ON_THE_WAY = {
  userId: "kasia",
  displayName: "Kasia",
  action: "on_the_way" as const,
};

export function frameFor(script: DemoScript): DemoFrame {
  switch (script.kind) {
    case "map": {
      const level = script.level ?? 0;
      return {
        level,
        phase: "idle",
        countdown: null,
        friendView: "none",
        showHeatmap: script.heatmap ?? true,
        dispatch: level >= 3,
        // Na najwyższym poziomie Kasia już idzie — i dokładnie to widać w
        // labelu suwaka, więc klatka pokazuje zapisany fakt, nie domysł.
        acks:
          level >= 3 ? [KASIA_ON_THE_WAY] : level >= 2 ? [KASIA_ANSWERED] : [],
      };
    }
    case "call":
      return {
        level: script.level,
        phase: "ringing",
        countdown: null,
        friendView: "none",
        showHeatmap: false,
        dispatch: false,
        // Mama jako kontakt — tak jak w opisie strefy 1 na landingu.
        contactIdx: 0,
        acks: script.level >= 2 ? [KASIA_ANSWERED] : [],
      };
    case "friendCall":
      return {
        level: 2,
        phase: "waiting",
        countdown: 5,
        friendView: "call",
        showHeatmap: false,
        dispatch: false,
        acks: [KASIA_ANSWERED],
      };
    case "friendAlarm":
      return {
        level: 3,
        phase: "active",
        countdown: null,
        friendView: "alarm",
        showHeatmap: false,
        dispatch: true,
        acks: [KASIA_ON_THE_WAY],
      };
  }
}

export const DemoStage: React.FC<{
  script: DemoScript;
  device?: DeviceVariant;
  scale?: number;
  /** Przycisk „wróć" w ramce — na slajdzie wygląda jak element prezentacji. */
  chrome?: boolean;
  /** Etykieta pod telefonem, np. „telefon Kasi". */
  label?: string;
  /** Zmiana licznika odgrywa scenariusz od nowa — przycisk „odtwórz”. */
  nonce?: number;
  className?: string;
}> = ({
  script,
  device = "iphone",
  scale = 0.58,
  chrome = false,
  label,
  nonce = 0,
  className = "",
}) => {
  const phone = useRef<DemoHandle>(null);
  // `nonce` w zależnościach = „odtwórz klatkę”. Scenariusz sam w sobie jest
  // nowym obiektem przy każdym renderze, a `useMemo` trzyma go stabilnym —
  // inaczej efekt klatki odpalałby się przy każdym przerysowaniu slajdu.
  const frame = useMemo(() => frameFor(script), [script, nonce]);

  const size = DEVICE_SIZE[device];
  const overlay = script.kind !== "map" && (script.level ?? 0) !== 0;

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{
        width: size.w * scale,
        height: size.h * scale + (label ? LABEL_H : 0),
      }}
    >
      <div
        className="absolute top-0 left-0"
        style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        <DeviceFrame
          variant={device}
          canGoBack={chrome && overlay}
          onBack={() => phone.current?.goBack()}
        >
          <DemoPhone
            ref={phone}
            frame={frame}
            safeAreaTop={SAFE_TOP}
            safeAreaBottom={SAFE_BOTTOM}
          />
        </DeviceFrame>
      </div>

      {label ? (
        <div
          className="absolute left-1/2 -translate-x-1/2 text-center whitespace-nowrap"
          style={{ top: size.h * scale + 12 }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
            {label}
          </span>
        </div>
      ) : null}
    </div>
  );
};

/** Znaczek poziomu. Nazwa wzięta z `theme/levels.ts`, czyli z tego, co
 *  użytkowniczka czyta w suwaku. Bez kropki: badge ma byc podpisem, nie ikona. */
export const LevelBadge: React.FC<{ level: ThreatLevel; name: string }> = ({
  level,
  name,
}) => {
  const color = colorForLevel(level);
  return (
    <span
      className="inline-flex items-center px-3 py-1.5 rounded-full font-mono text-[11px] font-semibold uppercase tracking-[0.14em] whitespace-nowrap"
      style={{
        background: `${color}1a`,
        border: `1px solid ${color}59`,
        color,
      }}
    >
      Poziom {level} · {name}
    </span>
  );
};
