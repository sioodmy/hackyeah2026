import React from "react";
import {
  EyeSlash,
  HandPointing,
  QrCode,
  FileLock,
} from "@phosphor-icons/react";
import { Bullet, Card, CardHead, Slide } from "../ui";

/**
 * Slajd problemu — trzy statystyki FRA jako jeden wspólny mianownik.
 *
 * Wszystkie trzy liczone są w tej samej skali: dwadzieścia ikon sylwetki,
 * jedna ikona = 5%. „1 na 20” to dosłownie jedna ikona, „co trzecia” to
 * siedem. Czytelnik nie musi nic przeliczać i od razu widzi, że skala jest
 * wspólna, a nie dobrana osobno pod każdą liczbę.
 */
const ICONS = 20;

const STATS = [
  {
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

export const Problem: React.FC<{ index: number; total: number }> = ({
  index,
  total,
}) => (
  <Slide
    index={index}
    total={total}
    eyebrow="01 · Problem"
    title="Nasza codzienność, to nie „jednostkowy przypadek”"
    lead="Poniższe liczby pochodzą z badań FRA i mają wspólny mianownik: dwadzieścia kobiet. W tej skali przemoc nie jest marginesem ryzyka, który da się pominąć. Jest częstym doświadczeniem, o którym rzadko się mówi."
    glow="rgba(255,42,133,0.13)"
  >
    <div className="grid grid-cols-[minmax(0,30rem)_1fr] gap-12 h-full items-stretch">
      <div className="flex flex-col justify-center gap-4">
        {STATS.map((s) => (
          <div
            key={s.value}
            className="flex items-center gap-6 border-b border-white/[0.06] pb-4 last:border-0 last:pb-0"
          >
            <div
              className="flex-1 grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${ICONS / 2}, 1fr)` }}
              aria-hidden
            >
              {Array.from({ length: ICONS }, (_, i) => (
                <span
                  key={i}
                  className="material-symbols-rounded text-center"
                  style={{
                    fontSize: 15,
                    lineHeight: 1,
                    color: i < s.filled ? "#ff2a85" : "rgba(255,255,255,0.15)",
                    fontVariationSettings:
                      i < s.filled ? '"FILL" 1' : '"FILL" 0',
                  }}
                >
                  person_2
                </span>
              ))}
            </div>
            <div className="w-[19rem] shrink-0">
              <div className="text-[24px] font-extrabold text-white tracking-tight leading-tight">
                {s.value}
              </div>
              <p className="text-[12.5px] leading-snug text-slate-400 mt-1">
                {s.text}
              </p>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-slate-600 leading-snug">
          Źródło: FRA (Europejska Agencja Praw Człowieka), badanie o przemocy
          wobec kobiet w Unii Europejskiej
        </p>
      </div>

      <div className="relative rounded-3xl bg-[#10111a] border border-white/[0.07] p-9 flex flex-col justify-center">
        <div
          className="slide-glow"
          style={
            {
              width: 460,
              height: 280,
              top: -40,
              left: 80,
              "--glow": "rgba(255,42,133,0.20)",
            } as React.CSSProperties
          }
          aria-hidden
        />
        <p className="text-[22px] leading-[1.4] font-bold text-white relative">
          Aplikacja SOS prosi o coś, czego w tej sytuacji nie da się mieć: czas
          na odblokowanie telefonu, spokojne przejście przez menu i odwagę, żeby
          nacisnąć czerwony przycisk przy obcym człowieku.
        </p>
        <p className="text-[22px] leading-[1.4] font-bold text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-[#ff2a85] to-pink-300 relative mt-5">
          Jeden ruch kciukiem i puszczenie. Pomoc rusza w tle, bez
          odblokowywania, bez menu, bez czerwonego przycisku.
        </p>
      </div>
    </div>
  </Slide>
);

/** Cztery powody, dla których czerwony przycisk SOS nie działa w terenie.
 *  Nagłówki i treść z `FeatureBento.tsx` — bez skracania argumentu. */
const WHY: ReadonlyArray<{
  icon: React.ReactNode;
  kicker: string;
  kickerColor: string;
  title: string;
  body: string;
  mono: string;
}> = [
  {
    icon: <EyeSlash size={22} weight="bold" />,
    kicker: "Koncepcja wizualna",
    kickerColor: "#38BDF8",
    title: "Niewidzialność z dystansu: mapa, która wygląda jak mapa",
    body: "Rastrowa mapa bazowa jest celowo odbarwiona i przyciemniona (raster-saturation: 0 na kaflach CARTO, -0.92 na OpenStreetMap). Nie ma tu żadnych czerwonych pasków ani napisu ALARM. Osoba idąca obok widzi jedynie zwykłą mapę uliczną.",
    mono: "desaturacja na GPU, nie filtr na zdjęciu",
  },
  {
    icon: <HandPointing size={22} weight="bold" />,
    kicker: "Obsługa kciukiem",
    kickerColor: "#EFC02B",
    title: "Alarm startuje na puszczeniu",
    body: "Przesuwasz suwak i puszczasz: dopóki palec dotyka ekranu, alert się nie odpala. Przypadkowe otarcie w torebce lub kieszeni nie wywoła fałszywego alarmu.",
    mono: "Cofnięcie do zera odwołuje alert natychmiast",
  },
  {
    icon: <QrCode size={22} weight="bold" />,
    kicker: "Szybkie parowanie",
    kickerColor: "#A78BFA",
    title: "Dołączenie do kręgu kodem QR w 3 sekundy",
    body: "Wychodzicie razem z klubu, koncertu czy biblioteki? Wystarczy jeden skan kodu QR aparatem, by dodać znajomą do kręgu czuwania na czas nocnego powrotu. Bez wymieniania się numerami i bez zbędnych kont.",
    mono: "1. Pokaż kod QR  2. Zeskanuj aparatem  3. Bezpieczny powrót",
  },
  {
    icon: <FileLock size={22} weight="bold" />,
    kicker: "Bezpieczeństwo danych",
    kickerColor: "#FB7185",
    title: "Kawałki audio po 30 sekund",
    body: "W Poziomie 3 telefon rejestruje dźwięk w 30-sekundowych paczkach i wrzuca je od razu na serwer. Nawet jeśli telefon zostanie zniszczony, dowód jest już bezpiecznie zapisany w chmurze.",
    mono: "Suma SHA-256 dla każdej paczki, timestampy i pozycja GPS",
  },
];

export const Why: React.FC<{ index: number; total: number }> = ({
  index,
  total,
}) => (
  <Slide
    index={index}
    total={total}
    eyebrow="02 · Dlaczego nie zwykły SOS"
    title="Dlaczego typowe aplikacje SOS nie sprawdzają się na ulicy"
    lead="Większość aplikacji ratunkowych zakłada, że w sytuacji zagrożenia odblokujesz telefon, przeklikasz się przez menu i naciśniesz jaskrawy czerwony przycisk. Mokosh stawia na kamuflaż: telefon wygląda jak zwykła mapa, a pomoc rusza w tle."
    glow="rgba(56,189,248,0.12)"
  >
    <div className="grid grid-cols-2 gap-4 h-full">
      {WHY.map((w) => (
        <Card key={w.title} className="flex flex-col">
          <CardHead
            icon={w.icon}
            kicker={w.kicker}
            title={w.title}
            kickerColor={w.kickerColor}
          />
          <p className="text-[13px] leading-relaxed text-slate-400 flex-1">
            {w.body}
          </p>
          <div className="mt-4 pt-3.5 border-t border-white/[0.07]">
            <span className="font-mono text-[11px] text-slate-500">
              {w.mono}
            </span>
          </div>
        </Card>
      ))}
    </div>
  </Slide>
);
