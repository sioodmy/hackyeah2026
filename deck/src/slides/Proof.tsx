import React, { useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import {
  ClockCountdown,
  EnvelopeSimple,
  FileLock,
  MapTrifold,
} from "@phosphor-icons/react";
import { DemoStage } from "../DemoStage";
import { Bullet, Card, CardHead, Mono, Slide } from "../ui";

/**
 * Slajd demo w wariancie bez poziomu zagrożenia (heatmap) oraz slajdy
 * dowodowe. Układ ten sam co w `slides/Demo.tsx` — cienki nagłówek, bo telefon
 * jest wysoki.
 */
const DemoFrame: React.FC<{
  index: number;
  total: number;
  badge?: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
  phones: (nonce: number) => React.ReactNode;
  note?: React.ReactNode;
}> = ({ index, total, badge, title, children, phones, note }) => {
  const [nonce, setNonce] = useState(0);
  return (
    <section className="slide" data-slide={index}>
      <div
        className="slide-glow"
        style={
          {
            width: 600,
            height: 320,
            top: -110,
            right: -60,
          } as React.CSSProperties
        }
        aria-hidden
      />
      <div className="slide-inner" style={{ padding: "46px 64px 40px" }}>
        <header className="shrink-0 flex items-center gap-4">
          <span className="text-[10.5px] font-mono font-semibold uppercase tracking-[0.2em] text-slate-600 shrink-0">
            {String(index).padStart(2, "0")} · Demo
          </span>
          <h2 className="text-[27px] leading-tight font-extrabold tracking-tight text-white min-w-0">
            {title}
          </h2>
          <span className="ml-auto shrink-0">{badge}</span>
        </header>

        <div className="flex-1 min-h-0 mt-6 flex items-center gap-9">
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {children}
            {note ? (
              <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[12.5px] text-slate-300 leading-relaxed">
                {note}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setNonce((n) => n + 1)}
              className="deck-only mt-5 self-start inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11.5px] font-semibold text-slate-400 border border-white/10 hover:text-white hover:border-white/25 transition-colors"
            >
              <ArrowsClockwise size={13} weight="bold" />
              Odtwórz klatkę
            </button>
          </div>
          <div className="shrink-0 flex items-end gap-7">{phones(nonce)}</div>
        </div>

        <footer className="shrink-0 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.16em] text-slate-600 pt-3 mt-5 border-t border-white/[0.06]">
          <span>Mokosh · HackYeah 2026</span>
          <span className="tabular-nums">
            {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </footer>
      </div>
    </section>
  );
};

export const Heatmap: React.FC<{ index: number; total: number }> = ({
  index,
  total,
}) => (
  <DemoFrame
    index={index}
    total={total}
    badge={
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-mono text-[11px] font-semibold uppercase tracking-[0.14em] bg-[#ff2a85]/10 border border-[#ff2a85]/30 text-[#ff2a85]">
        <MapTrifold size={13} weight="bold" />
        Prywatność wymuszona przez backend
      </span>
    }
    title="Krakowska heatmapa bezpieczeństwa"
    phones={(nonce) => (
      <DemoStage
        nonce={nonce}
        script={{ kind: "map", level: 0, heatmap: true }}
        scale={0.58}
        label="Kraków · Tauron Arena"
      />
    )}
    note={
      <>
        Rampa heatmapy jest{" "}
        <strong className="text-white">tylko czerwona</strong>, celowo bez
        żółci. Żółty w tej aplikacji znaczy już coś innego: poziom zagrożenia na
        suwaku. Zmyślone dane demonstracyjne są domyślnie{" "}
        <strong className="text-white">wyłączone</strong>.
      </>
    }
  >
    <ul className="flex flex-col gap-3">
      <li className="text-[14px] leading-relaxed text-slate-300">
        Podczas gdy suwak odpowiada za bezpośrednie wsparcie użytkowniczki,
        heatmapa agreguje zgłoszenia agresji i niebezpiecznych miejsc w
        Krakowie. Dane są zrzutowane na komórki około 200 m, gwarantując pełną
        anonimowość zgłaszających.
      </li>
      <Bullet>
        <strong className="text-white">Odczyty zrzutowane na siatkę:</strong>{" "}
        <Mono>GET /api/v1/incidents/heatmap</Mono> zwraca wyłącznie komórki{" "}
        <Mono>~200 m</Mono> z zagregowaną liczbą zdarzeń. W odpowiedzi API nie
        ma ani jednego dokładnego punktu GPS ani identyfikatora użytkowniczki.
      </Bullet>
      <Bullet>
        <strong className="text-white">W pełni anonimowe zgłoszenia:</strong>{" "}
        Osoba śledzona na ulicy nie musi logować się ani zakładać konta, by
        oznaczyć niebezpieczny zaułek.
      </Bullet>
      <Bullet>
        <strong className="text-white">
          Wagi wyliczane po stronie serwera:
        </strong>{" "}
        Aplikacja klienta nie może manipulować wagą zdarzenia. Poważność wynika
        z kategorii i lokalizacji wewnątrz krakowskiego bounding-boxu.
      </Bullet>
    </ul>
  </DemoFrame>
);

/**
 * Dowód i niezawodność w jednym slajdzie.
 *
 * Oba tematy mówią to samo z drugiej strony: co się dzieje, kiedy telefon
 * milczy albo znika. Dowód trzymamy w chmurze, alert pilnujemy po stronie
 * serwera — a telefon jest tylko wygodnym pilociem, nie warunkiem powodzenia.
 */
const PROOF: ReadonlyArray<{
  icon: React.ReactNode;
  kicker: string;
  color: string;
  title: string;
  body: string;
}> = [
  {
    icon: <ClockCountdown size={21} weight="bold" />,
    color: "#FBBF24",
    kicker: "Kawałki, nie plik",
    title: "30 sekund, potem upload",
    body: "W Poziomie 3 telefon rejestruje dźwięk w 30-sekundowych paczkach i wrzuca je od razu na serwer. Nawet jeśli telefon zostanie zniszczony, tracisz najwyżej jeden kawałek, a nie całe nagranie.",
  },
  {
    icon: <FileLock size={21} weight="bold" />,
    color: "#FB7185",
    kicker: "Suma liczona po stronie serwera",
    title: "SHA-256 i idempotencja",
    body: "Serwer przelicza sumę każdego kawałka, zanim go przyjmie. Numer sekwencyjny jest unikalny w sesji, więc powtórna wysyłka jest no-op, a nie korupcja. Finalizacja zamyka to w manifest: pozycja start, koniec i jawne `contiguous: false`.",
  },
  {
    icon: <ClockCountdown size={21} weight="bold" />,
    color: "#D62828",
    kicker: "Worker eskalacji",
    title: "Serwer patrzy dalej, gdy telefon nie",
    body: "Osobny proces co 60 s podnosi alert, którego nikt nie potwierdził: poziom 2 → 3 po 15 minutach, 3 → 4 po 5. Poprzedni alert zostaje oznaczony jako `escalated`, a nowy dostaje świeżą oś czasu, historia nie jest nadpisywana.",
  },
  {
    icon: <EnvelopeSimple size={21} weight="bold" />,
    color: "#38BDF8",
    kicker: "Drugi kanał",
    title: "E-mail do alertów krytycznych",
    body: "Poziomy 3 i 4 wychodzą też e-mailem, bo push ginie przy wyłączonym telefonie, pustej baterii i w martwej strefie. E-mail czeka w skrzynce, aż telefon wróci do sieci.",
  },
];

const MANIFEST = `POST /api/v1/evidence/sessions/:id/chunks     seq=12  duration=30s  sha256=9f2c…
POST /api/v1/evidence/sessions/:id/finalize  →  manifest: sumy, czasy, pozycja, contiguous: false`;

export const Proof_: React.FC<{ index: number; total: number }> = ({
  index,
  total,
}) => (
  <Slide
    index={index}
    total={total}
    eyebrow="08 · Dowód i niezawodność"
    title="Nawet jeśli telefon zniknie"
    lead="Żadna komórka nie trzyma połączenia otwartego w tle, więc pilnowanie alertów jest po stronie serwera, a nagranie opuszcza telefon w kawałkach."
    glow="rgba(251,191,36,0.11)"
  >
    <div className="flex flex-col gap-4 h-full">
      <div className="grid grid-cols-2 gap-4 flex-1">
        {PROOF.map((e) => (
          <Card key={e.title} className="flex flex-col" accent={e.color}>
            <CardHead
              icon={e.icon}
              kicker={e.kicker}
              title={e.title}
              kickerColor={e.color}
            />
            <p className="text-[12.5px] leading-relaxed text-slate-400 flex-1">
              {e.body}
            </p>
          </Card>
        ))}
      </div>

      <div className="shrink-0 rounded-2xl border border-white/[0.07] bg-[#080a10] px-5 py-3.5 font-mono text-[11px] leading-[1.8] text-slate-400 whitespace-pre overflow-hidden">
        {MANIFEST}
      </div>
    </div>
  </Slide>
);
