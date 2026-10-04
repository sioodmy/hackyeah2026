import React, { useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react";
import { DemoStage, LevelBadge } from "../DemoStage";
import { Bullet, Mono } from "../ui";
import type { ThreatLevel } from "@app/theme/levels";

/**
 * Slajdy demo.
 *
 * Układ jest inny niż w `Slide`, bo telefon jest wysoki: nagłówek schodzi do
 * jednego wiersza, a stopka do jednej linii — dzięki temu klatka telefonu
 * mieści się w 720 px i w podglądzie, i na wydruku.
 *
 * Każdy slajd to **jedna ustalona klatka** (`DemoPhone.frame`), a nie żywy przebieg.
 * W PDF-ie i tak nie ma czasu odtworzyć animacji, a prezentacja ma być
 * powtarzalna: to samo ujęcie za pierwszym i pięćdziesiątym razem.
 * Interaktywne demo jest na landingu i w podglądzie webowym.
 */
const DemoSlide: React.FC<{
  index: number;
  total: number;
  /** Znaczek poziomu. Slajdy bez poziomu (heatmap) podają własny `badge`. */
  level?: ThreatLevel;
  name?: string;
  badge?: React.ReactNode;
  title: React.ReactNode;
  children: React.ReactNode;
  /** Klatki demo dostają licznik odtworzeń, więc „Odtwórz” gra scenariusz
   *  od nowa zamiast tylko przestawiać przycisk. */
  phones: (nonce: number) => React.ReactNode;
  note?: React.ReactNode;
}> = ({ index, total, level, name, badge, title, children, phones, note }) => {
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
          <span className="ml-auto shrink-0">
            {badge ??
              (level != null && name ? (
                <LevelBadge level={level} name={name} />
              ) : null)}
          </span>
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

/** Wspólny zestaw klatek dla slajdów demo — patrz `DemoSlide`. */
export const DemoCamo: React.FC<{ index: number; total: number }> = ({
  index,
  total,
}) => (
  <DemoSlide
    index={index}
    total={total}
    level={0}
    name="Bezpiecznie"
    title="Poziom 0: mapa, suwak, nic więcej"
    phones={(nonce) => (
      <DemoStage
        nonce={nonce}
        script={{ kind: "map", level: 0, heatmap: false }}
        scale={0.55}
        label="Twoja komórka"
      />
    )}
    note="Dyskretna obrona na nocne powroty. Otwarty projekt przygotowany na HackYeah 2026 w Krakowie."
  >
    <ul className="flex flex-col gap-3">
      <li className="text-[14px] leading-relaxed text-slate-300">
        Mokosh zachowuje dyskrecje wyglądając jak aplikacja Map. Nie rzuca się w
        oczy oprawcom, nie wzbudza podejrzeń.
      </li>
      <Bullet>
        Wektorowa, ciemna baza OpenFreeMap, bez klucza API. Gdy wpadnie raster,
        dostaje <Mono>raster-saturation: 0</Mono> i <Mono>-0.92</Mono> na
        OpenStreetMap. Nie ma czerwonych pasków ani napisu ALARM.
      </Bullet>
      <Bullet>
        Suwak to jedyny nasycony element ekranu i nabiera koloru dopiero po
        zatwierdzeniu poziomu. W spoczynku jest szary.
      </Bullet>
      <Bullet color="#38BDF8">
        Fałszywy telefon wymusza przyłożenie aparatu do ucha, dzięki czemu
        wskaźnik użycia mikrofonu w systemie wygląda w 100% naturalnie.
      </Bullet>
    </ul>
  </DemoSlide>
);

export const DemoHint: React.FC<{ index: number; total: number }> = ({
  index,
  total,
}) => (
  <DemoSlide
    index={index}
    total={total}
    level={1}
    name="Potrzebuję chwili"
    title="Poziom 1: telefon dzwoni sam"
    phones={(nonce) => (
      <DemoStage
        nonce={nonce}
        script={{ kind: "call", level: 1 }}
        scale={0.55}
        label="Twoja komórka"
      />
    )}
  >
    <ul className="flex flex-col gap-3">
      <li className="text-[14px] leading-relaxed text-slate-300">
        Po 10 sekundach od puszczenia suwaka telefon sam dzwoni (jako Mama lub
        inny wybrany kontakt). Cichy dzwonek i wibracja. Po odebraniu leci
        ambientowa rozmowa tła, dająca powód do szybkiego odejścia.
      </li>
      <Bullet color="#EFC02B">
        Przyjaciółki dostają ciche powiadomienie systemowe, że uruchomiłaś
        pretekst wyjścia. Ekran ich telefonów nie zostaje zablokowany.
      </Bullet>
      <Bullet color="#EFC02B">
        10-sekundowy bufor na ewentualne cofnięcie suwaka do zera.
      </Bullet>
      <Bullet color="#EFC02B">
        Dźwięk odtwarzany jest na <Mono>volume 0.15</Mono>, z uwagi na specyfikę
        routingu audio w urządzeniu.
      </Bullet>
    </ul>
  </DemoSlide>
);

export const DemoCircle: React.FC<{ index: number; total: number }> = ({
  index,
  total,
}) => (
  <DemoSlide
    index={index}
    total={total}
    level={2}
    name="Potrzebuję pomocy"
    title="Poziom 2: znajoma odbiera i widzi, gdzie jesteś"
    phones={(nonce) => (
      <>
        <DemoStage
          nonce={nonce}
          script={{ kind: "map", level: 2, heatmap: false }}
          scale={0.5}
          label="Twoja komórka"
        />
        <DemoStage
          nonce={nonce}
          script={{ kind: "friendCall", level: 2 }}
          device="iphone"
          scale={0.5}
          label="Telefon znajomej"
        />
      </>
    )}
    note={
      <>
        Niskolatencyjny strumień współrzędnych <Mono>/ws/locations</Mono>,
        przyjaciółka widzi poruszający się punkt na swojej mapie w czasie
        rzeczywistym, a kolejka pozycji ma długość 1, więc telefon na złym
        sygnale odrzuca nieaktualne współrzędne zamiast odtwarzać sprzed minut.
      </>
    }
  >
    <ul className="flex flex-col gap-3">
      <li className="text-[14px] leading-relaxed text-slate-300">
        Wszystko z poziomu 1, plus natychmiastowe uruchomienie transmisji
        pozycji GPS przez kanał WebSocket do uprawnionych odbiorców.
      </li>
      <Bullet color="#F2761B">
        Na telefonach w kręgu pojawia się pełnoekranowe wywołanie z przyciskiem{" "}
        <strong className="text-white">Odbierz</strong>. Po odebraniu
        rozmawiacie, a u Ciebie pojawia się status: <Mono>Kasia rozmawia</Mono>.
      </Bullet>
      <Bullet color="#F2761B">
        Zamiast współrzędnych znajoma dostaje adres, po którym da się trafić:{" "}
        <Mono>Tauron Arena, ul. Unii Lubelskiej 1</Mono>.
      </Bullet>
    </ul>
  </DemoSlide>
);

export const DemoAlarm: React.FC<{ index: number; total: number }> = ({
  index,
  total,
}) => (
  <DemoSlide
    index={index}
    total={total}
    level={3}
    name="Pełny alarm"
    title="Poziom 3: alarm, syrena i numer sprawy"
    phones={(nonce) => (
      <>
        <DemoStage
          nonce={nonce}
          script={{ kind: "map", level: 3, heatmap: false }}
          scale={0.5}
          label="Twoja komórka"
        />
        <DemoStage
          nonce={nonce}
          script={{ kind: "friendAlarm", level: 3 }}
          device="iphone"
          scale={0.5}
          label="Telefon znajomej"
        />
      </>
    )}
    note={
      <>
        Pakiety audio zabezpieczone sumą SHA-256, stemplami czasu i
        współrzędnymi start/stop. Zniszczenie lub odebranie telefonu oznacza
        utratę maksymalnie ułamka ostatniego segmentu. Mock 112 zwraca numer
        sprawy <Mono>112/2026/0420</Mono>.
      </>
    }
  >
    <ul className="flex flex-col gap-3">
      <li className="text-[14px] leading-relaxed text-slate-300">
        Niewidoczne nagrywanie dźwięku w 30-sekundowych segmentach SHA-256
        wysyłanych na serwer natychmiast po zamknięciu paczki. Równolegle
        wyzwalane zgłoszenie 112 zwracające numer sprawy.
      </li>
      <Bullet color="#D62828">
        U wszystkich w kręgu włącza się głośna syrena omijająca tryb wyciszenia
        (bypassDnd). Dźwięk milknie dopiero wtedy, gdy przyjaciółka kliknie{" "}
        <strong className="text-white">Idę do niej</strong>.
      </Bullet>
      <Bullet color="#D62828">
        Odpowiedź wraca do Ciebie jako status na suwaku:{" "}
        <Mono>Kasia, idzie do ciebie</Mono>. Zapisany fakt cofa się tylko w
        przód, więc spóźniony push go nie unieważni.
      </Bullet>
    </ul>
  </DemoSlide>
);
