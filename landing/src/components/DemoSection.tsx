import React, { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  DemoPhone,
  FAKE_CALL_COUNTDOWN_S,
  type DemoHandle,
  type DemoState,
} from "@demo";
import { DEVICE_SIZE, DeviceFrame, SAFE_BOTTOM, SAFE_TOP } from "./DeviceFrame";
// Paleta poziomów prosto z apki — kropki przy przyciskach muszą pokazywać
// dokładnie te kolory, które widz potem zobaczy na suwaku.
import { colorForLevel } from "@app/theme/tokens";

/**
 * Skalowanie telefonu w sekcji — jedna wartość, bo rezerwka miejsca w siatce,
 * rozmiar kontenera i pozycja adnotacji muszą znać tę samą liczbę.
 */
const SCALE = 0.72;

/**
 * Pozycja adnotacji liczona w CSS-px kontenera (telefon jest przeskalowany
 * przez `SCALE`, a adnotacja leży obok warstwy skalującej, więc nie dzieli
 * się z nią skalowania i tekst zostaje ostry).
 *
 * Cel: środek karty na 2/3 wysokości ekranu. Ekran zaczyna się ~8 px niżej
 * kontenera i ma ~598 px, więc 2/3 to ~406 px od
 * góry kontenera. Karta ma 145 px (z paskiem fake call), stąd `406 - 72 = 334 px`,
 * czyli 0,545 wysokości kontenera (852 × 0.72 = 613 px).
 *
 * Współczynnik jest zależny od wysokości karty — po zmianie tekstu albo po
 * dodaniu elementu trzeba go przeliczyć, inaczej środek adnotacji zejdzie z 2/3.
 */
/**
 * Trzy poziomy jako przyciski-piloci.
 *
 * Prezentacja często zakłada, że widz sam zrozumie, że telefon obok jest
 * klikalny. Każdy przycisk więc **odgrywa** poziom: `demoLevel` cofa stan do
 * początku, a potem suwak sam jedzie do wybranego detentu i się zatwierdza.
 *
 * `bullets` to dosłowna lista tego, co poziom robi — widz ma widzieć skutki,
 * a nie marketing. `strong` to fragment do pogrubienia: sam wątek jest
 * argumentem za tym poziomem, ale kolor zostaje jak w reszcie listy, żeby
 * wyróżnienie nie rozjechało się wizualnie z innymi punktami.
 */
const LEVEL_DEMO: ReadonlyArray<{
  level: 1 | 2 | 3;
  name: string;
  bullets: ReadonlyArray<{ text: string; strong?: string }>;
}> = [
  {
    level: 1,
    name: "Potrzebuję chwili",
    bullets: [{ text: "Fałszywe połączenie" }],
  },
  {
    level: 2,
    name: "Potrzebuję pomocy",
    bullets: [
      { text: "Fałszywe połączenie" },
      { text: "Znajomi dostają powiadomienie o zmianie stanu" },
      { text: "Znajomi widzą twoją lokalizacje" },
    ],
  },
  {
    level: 3,
    name: "Pełny alarm",
    bullets: [
      { text: "Fałszywe połączenie" },
      { text: "Znajomi otrzymują głośny alarm", strong: "głośny alarm" },
      { text: "Znajomi widzą twoją lokalizacje" },
      { text: "Policja otrzymuje zawiadomienie wraz z Twoją lokalizacją" },
    ],
  },
];

const ANNOTATION_TOP = `${DEVICE_SIZE.iphone.h * SCALE * 0.545}px`;

/**
 * Sekcja demo na landingu.
 *
 * Osadza dokładnie ten sam `DemoPhone`, którego używa podgląd developerski
 * (`web/`), więc landing nie ma własnej kopii UI — poprawka w podglądzie
 * widać tu natychmiast.
 *
 * Skalowanie: telefon ma natywne 393 × 852 px (punkty CSS urządzenia), a
 * sekcja jest węższa, więc całość jest przeskalowana przez `transform`.
 * Skalowanie zostawia layout w urządzeniowych pikselach, więc tekst nie
 * zawija się inaczej niż w apce.
 */
export const DemoSection: React.FC = () => {
  const phone = useRef<DemoHandle>(null);
  const [state, setState] = useState<DemoState | null>(null);

  {
    /**
     * Zamiana urządzeń, jedna instancja demo.
     *
     * `DemoPhone` renderujemy **raz** — dwie instancje ze wspólnym `ref`
     * nadpisywałyby stan nawzajem. Animacja jest dwuetapowa: najpierw
     * telefon ofiary (z jego obudową i treścią) ucieka w prawo, w połowie
     * drogi obudowa zmienia się na Pixela i całość wjeżdża z lewej.
     * Treść nie jest montowana ponownie, więc stan alertu przetrwa zamianę.
     */
  }
  // Uwaga na `!= null`: samo `state?.friendView !== "none"` byłoby prawdą już
  // przed pierwszym raportem stanu, bo `undefined !== "none"` — i zamiana
  // odpaliłaby się przy starcie, zanim cokolwiek się wydarzyło.
  const onFriendPhone = state != null && state.friendView !== "none";
  const [device, setDevice] = useState<"iphone" | "pixel">("iphone");
  const [slid, setSlid] = useState(true);
  /**
   * Kierunek animacji trzymany w state.
   *
   * Wcześniej liczony był na renderze z `onFriendPhone`, czyli już z *nowej*
   * wartości — przy powrocie do telefonu ofiary `onFriendPhone` było `false`
   * i telefon uciekał o `-118%`, czyli w lewo, prosto na kolumnę z tekstem.
   * Teraz kierunek ustawiamy przy samym przełączeniu, więc obie fazy (wyjście
   * i wejście) zawsze idą w stronę `+1`, czyli w prawo — tam nie ma tekstu.
   */
  const [dir, setDir] = useState<1 | -1>(1);

  useEffect(() => {
    const toPixel = onFriendPhone && device === "iphone";
    const toIphone = !onFriendPhone && device === "pixel";
    // Nic się nie dzieje, gdy nie ma dokąd zamieniać — bez tego warunku
    // `setSlid(false)` leciałby przy samym montowaniu i telefon uciekałby
    // z ekranu zanim cokolwiek się wydarzyło.
    if (!toPixel && !toIphone) return;

    setDir(1);
    setSlid(false); // wychodzi z ekranu
    const timer = setTimeout(() => {
      setDevice(toPixel ? "pixel" : "iphone");
      // `slid` w następnej klatce, żeby transition zobaczył zmianę z 118% na 0.
      requestAnimationFrame(() => setSlid(true));
    }, 210);
    return () => clearTimeout(timer);
  }, [onFriendPhone, device]);

  const canGoBack =
    state?.tab !== "map" ||
    onFriendPhone ||
    state?.callPhase === "ringing" ||
    state?.callPhase === "active";

  const phoneScreen = (
    <DemoPhone
      ref={phone}
      onState={setState}
      safeAreaTop={SAFE_TOP}
      safeAreaBottom={SAFE_BOTTOM}
    />
  );

  return (
    <section id="demo" className="py-24 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-7xl mx-auto">
        {/*
          `justify-center` zamiast toru `1fr`. Przy `lg:grid-cols-[1fr_auto]`
          pierwszy tor rozciągał się na całą szerokość kontenera, więc na
          szerokim monitorze tekst przyklejał się do lewej krawędzi, telefon do
          prawej, a między nimi zostawała dziura (421 px przy 2560 px
          viewportu). Stałe toru `minmax(0, 36rem)` + `auto` trzymają obie
          kolumny obok siebie, a `justify-center` środkuje parę w kontenerze.
        */}
        <div className="grid lg:grid-cols-[minmax(0,36rem)_auto] lg:justify-center gap-12 items-center">
          <div className="max-w-xl">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Nawet, gdy ktoś patrzy Ci przez ramię.
            </h2>
            <p className="text-slate-400 text-base leading-relaxed mb-8">
              Mokosh zachowuje dyskrecje wyglądając jak aplikacja Map. Nie
              rzuca się w oczy oprawcom, nie wzbudza podejrzeń.
            </p>

            <div className="flex flex-col gap-3">
              {LEVEL_DEMO.map((l) => (
                <LevelDemoButton
                  key={l.level}
                  {...l}
                  onPlay={() => phone.current?.demoLevel(l.level)}
                />
              ))}
            </div>
          </div>

          {/* Telefon + sterowanie. Skalowanie z origin na górze, żeby
              zarezerwowane miejsce w siatce odpowiadało pozycji wizualnej.

              `clip-path` z ujemnym `inset` po lewej, a nie `overflow-x-clip`:
              przycisk „wróć do mapy" wystaje 46 px przed obudowę telefonu i
              `overflow-x` ucinałby go w połowie. Ujemny lewy inset rozszerza
              strefę cięcia o 60 px w lewo, a prawa nadal obcina uciekający
              telefon, żeby wyskakujący pasek przewijania poziomego nie
              przesuwał strony. */}
          <div className="flex flex-col items-center gap-6 [clip-path:inset(0_0_0_-60px)]">
            {/* Rezerwa miejsca na najszerszą z obu obudów (iPhone jest wyższy
                o 2 px), żeby nic nie skakało przy zamianie. */}
            <div
              style={{
                width: DEVICE_SIZE.iphone.w * SCALE,
                height: DEVICE_SIZE.iphone.h * SCALE,
              }}
              className="relative"
            >
              {/* Jedna warstwa: obudowa i treść przesuwają się razem. */}
              <div
                className="absolute top-0 left-0 transition-transform duration-[210ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{
                  transform: `scale(${SCALE}) translateX(${slid ? 0 : dir * 118}%)`,
                  transformOrigin: "top left",
                }}
              >
                <DeviceFrame
                  variant={device}
                  canGoBack={canGoBack}
                  onBack={() => phone.current?.goBack()}
                >
                  {phoneScreen}
                </DeviceFrame>
              </div>

              {/*
                Adnotacja leży NA telefonie, a nie nad nim w przepływie — stąd
                `z-index` zamiast przesunięcia w osi Y. Dzięki temu nie rozpycha
                sekcji i nie znika, gdy telefon wjeżdża. Świadomie inny język
                wizualny niż reszta sekcji: ma się czytać jako komentarz do
                prezentacji, a nie jako element aplikacji.
              */}
              {state?.friendHint ? (
                <div
                  className="demo-annotation"
                  style={
                    {
                      top: ANNOTATION_TOP,
                      // Długość paska musi równać się odliczaniu w telefonie,
                      // inaczej pasek i dźwięk/czajnik fake call rozjadą się.
                      "--hint-ms": `${FAKE_CALL_COUNTDOWN_S * 1000}ms`,
                    } as CSSProperties
                  }
                >
                  <div className="demo-annotation-card">
                  <div className="demo-annotation-inner">
                    <span className="demo-annotation-tag">
                      Adnotacja prezentacji
                    </span>
                    <strong>Tak to wygląda u twojej przyjaciółki</strong>
                    <span>Za chwilę pokażemy jej telefon</span>
                  </div>
                  <div className="demo-annotation-actions">
                    <button
                      type="button"
                      className="demo-annotation-skip"
                      onClick={() => phone.current?.skipToFriend()}
                    >
                      Zobacz teraz
                    </button>
                    <button
                      type="button"
                      className="demo-annotation-close"
                      onClick={() => phone.current?.dismissFriendHint()}
                      aria-label="Zamknij adnotację"
                    >
                      ✕
                    </button>
                  </div>
                  {/*
                    Pasek postępu pokazuje, że zanim zobaczymy telefon znajomej,
                    demo wykonuje jeszcze fake połączenie na iPhonie. Bez niego
                    zamiana urządzeń wygląda jak teleport.
                  */}
                  <div className="demo-annotation-progress">
                    <span className="demo-annotation-bar" />
                    <span className="demo-annotation-progress-label">
                      fake połączenie
                    </span>
                  </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const LevelDemoButton: React.FC<{
  level: 1 | 2 | 3;
  name: string;
  bullets: ReadonlyArray<{ text: string; strong?: string }>;
  onPlay: () => void;
}> = ({ level, name, bullets, onPlay }) => {
  // Kolor z palety apki, więc kropka jest tym samym żółtym/pomarańczowym/
  // czerwonym, który widz zaraz zobaczy na wypełnieniu suwaka.
  const dot = colorForLevel(level);
  return (
    <button
      type="button"
      onClick={onPlay}
      className="group flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition-colors hover:border-[#ff2a85]/40 hover:bg-[#ff2a85]/[0.07]"
    >
      <span
        className="shrink-0 w-2.5 h-2.5 rounded-full mt-1.5"
        style={{ background: dot, boxShadow: `0 0 10px ${dot}` }}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">{name}</span>
        </span>
        <ul className="mt-2 flex flex-col gap-1">
          {bullets.map((b) => (
            <li
              key={b.text}
              className="relative pl-3 text-slate-400 text-[13px] leading-snug before:absolute before:left-0 before:top-[7px] before:h-1 before:w-1 before:rounded-full before:bg-slate-600"
            >
              {(() => {
                // `indexOf` wraca -1, gdy ktoś zmieni tekst bez `strong` —
                // `slice(0, -1)` rozcinałby wtedy zdanie, więc sprawdzamy.
                const word = b.strong;
                const at = word ? b.text.indexOf(word) : -1;
                if (!word || at < 0) return b.text;
                return (
                  <>
                    {b.text.slice(0, at)}
                    <strong className="font-semibold">{word}</strong>
                    {b.text.slice(at + word.length)}
                  </>
                );
              })()}
            </li>
          ))}
        </ul>
      </span>
    </button>
  );
};

