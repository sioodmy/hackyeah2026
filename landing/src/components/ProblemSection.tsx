import React from "react";

/**
 * Sekcja „problem" — trzy statystyki FRA jako wizualna teza przed demo.
 *
 * Wspólny mianownik dla wszystkich trzech to **20 kropek**: jedna kropka
 * = 5%. Dzięki temu „1 na 20" to dosłownie jedna kropka, „co druga" to
 * dziesięć, a „co trzecia" to siedem — czytelnik nie musi przeliczać niczego
 * w głowie i od razu widzi, że skala jest wspólna, a nie dobrana pod każdą
 * liczbę osobno.
 */
const STATS = [
  {
    /** Ile kropek z 20. */
    filled: 7,
    value: "1/3",
    text: "Co trzecia kobieta w UE doświadczyła przemocy.",
  },
  {
    filled: 1,
    value: "1/20",
    text: "1 na 20 kobiet w Europie została zgwałcona po ukończeniu 15 lat.",
  },
  {
    filled: 10,
    value: "1/2",
    text: "Co druga kobieta w UE zetknęła się z przynajmniej jedną formą molestowania seksualnego.",
  },
] as const;

const DOTS = 20;

export const ProblemSection: React.FC = () => {
  return (
    <section
      id="problem"
      className="py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/20 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-4">
            skala problemu
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            To nie jest edge case.
          </h2>
          <p className="text-slate-400 text-base leading-relaxed">
            Skala przemocy wobec kobiet w Europie nie jest marginalna — jest
            statystycznie typowa. Poniżej trzy liczby z badań FRA, w których
            punkt odniesienia jest ten sam: dwadzieśia kobiet.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {STATS.map((s) => (
            <div
              key={s.value}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 flex flex-col"
            >
              {/*
                Kropki jako `grid` z jawnymi 20 kolumnami zamiast `flex-wrap`:
                zawijanie zależałoby od szerokości karty, więc przy innym
                viewportcie druga statystyka pokazałaby „1 na 19".
              */}
              <div
                className="grid gap-[5px] mb-6"
                style={{ gridTemplateColumns: `repeat(${DOTS}, minmax(0, 1fr))` }}
                aria-hidden
              >
                {Array.from({ length: DOTS }, (_, i) => (
                  <span
                    key={i}
                    className="aspect-square rounded-full"
                    style={
                      i < s.filled
                        ? { background: "#ff2a85" }
                        : { background: "rgba(255,255,255,0.10)" }
                    }
                  />
                ))}
              </div>
              <div className="text-5xl font-extrabold text-white tracking-tight tabular-nums mb-3">
                {s.value}
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>

        {/* Źródło w prawym dolnym rogu sekcji — nie w stopce, bo dotyczy
            wyłącznie liczb powyżej. */}
        <p className="mt-8 text-right text-xs text-slate-500">
          Źródło: FRA — Europejska Agencja Praw Człowieka, badanie o
          przemoci wobec kobiet w Unii Europejskiej
        </p>
      </div>
    </section>
  );
};