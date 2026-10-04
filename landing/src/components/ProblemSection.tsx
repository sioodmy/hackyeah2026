import React from "react";

/**
 * Sekcja „problem" — trzy statystyki FRA jako wizualna teza przed demo.
 *
 * Wspólny mianownik dla wszystkich trzech to **20 ikon sylwetki**, ułożonych
 * w dwa rzędy po dziesięć: jedna ikona = 5% populacji. Dzięki temu „1 na 20"
 * to dosłownie jedna ikona, „co druga" to dziesięć, a „co trzecia" to siedem.
 * Czytelnik nie musi przeliczać niczego w głowie i od razu widzi, że skala jest
 * wspólna, a nie dobrana pod każdą liczbę osobno.
 *
 * Ikonki są wypełnione (`FILL 1`) dokładnie wtedy, gdy dotyczą udziału z
 * tekstu, a konturowe (`FILL 0`) to reszta populacji — nie dekoracja, tylko
 * liczenie.
 */
const STATS = [
  {
    /** Ile ikon z 20. */
    filled: 7,
    value: "Co trzecia",
    text: "kobieta w UE doświadczyła przemocy.",
  },
  {
    filled: 1,
    value: "1 na 20",
    text: "kobiet w Europie została zgwałcona po ukończeniu 15 lat.",
  },
  {
    filled: 10,
    value: "Co druga",
    text: "kobieta w UE zetknęła się z przynajmniej jedną formą molestowania seksualnego.",
  },
] as const;

const ICONS = 20;

export const ProblemSection: React.FC = () => {
  return (
    <section
      id="problem"
      className="py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-800/80"
    >
      <div className="max-w-7xl mx-auto">
        <div className="max-w-3xl mb-14">
<h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Nasza codzienność,
            <br />
            to nie „jednostkowy przypadek"
          </h2>
          <p className="text-slate-400 text-base leading-relaxed">
            Poniższe liczby pochodzą z badań FRA i mają wspólny mianownik:
            dwadzieścia kobiet. W tej skali przemoc nie jest marginesem ryzyka,
            który da się pominąć. Jest częstym doświadczeniem, o którym rzadko
            się mówi.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {STATS.map((s) => (
            <div
              key={s.value}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 flex flex-col"
            >
              {/*
                Dwa rzędy po 10 ikon, nie jeden długi. W jednym rzędzie
                dwadzieścia glifów musiały być średnicą 11 px, czyli ledwie
                czytelne; przy dziesięciu kolumnach mają 20 px i widać, że to
                sylwetki. Nadal liczą te same 20 pozycji, więc „1 na 20" to
                wciąż dosłownie jedna ikona.
              */}
              <div
                className="grid gap-1 mb-6"
                style={{ gridTemplateColumns: `repeat(${ICONS / 2}, minmax(0, 1fr))` }}
                aria-hidden
              >
                {Array.from({ length: ICONS }, (_, i) => (
                  <span
                    key={i}
                    className="material-symbols-rounded text-center"
                    style={{
                      fontSize: 20,
                      color: i < s.filled ? "#ff2a85" : "rgba(255,255,255,0.16)",
                      fontVariationSettings: i < s.filled ? '"FILL" 1' : '"FILL" 0',
                    }}
                  >
                    person_2
                  </span>
                ))}
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight mb-3">
                {s.value}
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>

        {/* Źródło w prawym dolnym rogu sekcji — nie w stopce, bo dotyczy
            wyłącznie liczb powyżej. */}
        <p className="mt-8 text-right text-xs text-slate-500">
          Źródło: FRA (Europejska Agencja Praw Człowieka), badanie o
          przemoci wobec kobiet w Unii Europejskiej
        </p>
      </div>
    </section>
  );
};