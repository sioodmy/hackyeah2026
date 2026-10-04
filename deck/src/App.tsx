import React, { useEffect, useLayoutEffect, useState } from "react";
import { Title } from "./slides/Title";
import { Problem, Why } from "./slides/Story";
import { DemoAlarm, DemoCamo, DemoCircle, DemoHint } from "./slides/Demo";
import { Heatmap, Proof_ } from "./slides/Proof";
import { Closing } from "./slides/Close";

/**
 * Scena prezentacji.
 *
 * Wszystkie slajdy są w DOM naraz i pozycjonowane absolutnie — dzięki temu
 * przełączanie slajdów nie montuje ani nie odmontowuje treści, więc mapa
 * MapLibre w telefonie nie przeładowuje się przy każdym naciśnięciu strzałki.
 *
 * Tryb wydruku (`?print=1`) dokłada klasę `deck-print`, która zdejmuje
 * skalowanie do okna i układa slajdy w pion — z tego wariantu
 * `scripts/export-pdf.mjs` robi PDF przez `page.pdf()`.
 */
const STAGE_W = 1280;
const STAGE_H = 720;
/** Dziesięć slajdów: prezentacja ma być krótka, a każdy slajd musi coś wnosić. */
const TOTAL = 10;

const isPrint = (): boolean =>
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("print");

/**
 * `?print=1&only=N` renderuje **jeden** slajd.
 *
 * Eksport PDF-owy nie pagination całego dokumentu, tylko strona na slajd:
 * przy dziesięciu slajdach Chromium dzieli je po swojemu i gubi dolną krawędź
 * telefonu (ramka, pasek gestów, suwak). Jeden slajd na kartę eliminuje ten
 * problem w ogóle, a `scripts/export-pdf.mjs` skleja pliki `pdfunite`.
 */
const onlyIndex = (): number | null => {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("only");
  if (raw === null) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
};

export const App: React.FC = () => {
  const [i, setI] = useState(0);
  const print = isPrint();
  const only = onlyIndex();
  const [fit, setFit] = useState(1);

  const slides = [
    <Title key="title" />,
    <Problem key="problem" index={1} total={TOTAL} />,
    <Why key="why" index={2} total={TOTAL} />,
    <DemoCamo key="camo" index={3} total={TOTAL} />,
    <DemoHint key="hint" index={4} total={TOTAL} />,
    <DemoCircle key="circle" index={5} total={TOTAL} />,
    <DemoAlarm key="alarm" index={6} total={TOTAL} />,
    <Heatmap key="heatmap" index={7} total={TOTAL} />,
    <Proof_ key="proof" index={8} total={TOTAL} />,
    <Closing key="closing" index={9} total={TOTAL} />,
  ];

  // Skalowanie sceny do okna. `min` z dwóch osi, żeby slajd zawsze mieścił się
  // w całości i nic nie było przycięte.
  useLayoutEffect(() => {
    if (print) return;
    const measure = () => {
      const pad = 48;
      const w = (window.innerWidth - pad) / STAGE_W;
      const h = (window.innerHeight - pad) / STAGE_H;
      setFit(Math.max(0.3, Math.min(1.4, Math.min(w, h))));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [print]);

  useEffect(() => {
    if (print) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          e.preventDefault();
          setI((n) => Math.min(TOTAL - 1, n + 1));
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          setI((n) => Math.max(0, n - 1));
          break;
        case "Home":
          setI(0);
          break;
        case "End":
          setI(TOTAL - 1);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [print]);

  return (
    <div className={print ? "deck-print" : ""}>
      <div className="stage-wrap">
        <div
          className="stage"
          style={print ? undefined : { transform: `scale(${fit})` }}
        >
          {slides.map((slide, n) => {
            if (only !== null && n !== only) return null;
            return (
              <div
                key={n}
                className={`slide-host ${print ? "" : n === i ? "is-active" : ""}`}
                style={print ? undefined : { position: "absolute", inset: 0 }}
                aria-hidden={!print && n !== i}
              >
                {slide}
              </div>
            );
          })}
        </div>
      </div>

      {!print ? (
        <>
          <div className="deck-chrome">
            <div
              className="deck-chrome-fill"
              style={{ width: `${((i + 1) / TOTAL) * 100}%` }}
            />
          </div>
          <div className="deck-hint">
            {String(i + 1).padStart(2, "0")}/{TOTAL} · spacja / strzałki
          </div>
        </>
      ) : null}
    </div>
  );
};

export default App;
