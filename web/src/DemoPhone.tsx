/**
 * Sam telefon z demo — bez panelu scenariuszy.
 *
 * Wyodrębnione, żeby landing mógł osadzić dokładnie ten sam kod co podgląd
 * (web preview = DemoPhone + panel), zamiast pisać drugą, rozjeżdżającą się
 * kopię UI.
 *
 * `safeAreaTop` / `safeAreaBottom` udają insets z react-native-safe-area-context:
 * wewnątrz prawdziwego iPhone'a treść nie wchodzi pod wyspę ani pod pasek
 * gestów. W podglądzie developerskim są zerowe (ramka iPhone'a nie ma).
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { MapView } from "./components/MapView";
import { ThreatSlider } from "./components/ThreatSlider";
import {
  FriendAlarmScreen,
  FriendCallScreen,
  IncomingCallOverlay,
} from "./components/Overlays";
import { FriendsPanel, SettingsPanel, SignInPanel } from "./components/Tabs";
import {
  FAKE_CALL_DELAY_MS,
  fakeCallPreview,
  hint,
  label,
  MAX_LEVEL,
  type ThreatLevel,
} from "./theme";
import {
  MOCK_CONTACTS,
  MOCK_FRIENDS,
  ackLine,
  mockHeatmap,
  type HeatmapCell,
  type MockAck,
} from "./mock";

export type DemoTab = "map" | "friends" | "settings" | "login";
export type CallPhase = "idle" | "waiting" | "ringing" | "active";
export type FriendView = "none" | "call" | "alarm";

export type DemoState = {
  tab: DemoTab;
  level: ThreatLevel;
  callPhase: CallPhase;
  countdown: number | null;
  friendView: FriendView;
  /** Czy pokazać adnotację „tak to wygląda u przyjaciółki”. */
  friendHint: boolean;
  showHeatmap: boolean;
  totalReported: number;
  cellCount: number;
};

export type DemoHandle = {
  commit: (level: ThreatLevel) => void;
  /**
   * Prezentacyjne „przesunięcie" suwaka: najpierw wraca do mapy, potem gałka
   * sama jedzie do wybranego poziomu i go zatwierdza. Landing używa tego,
   * bo obserwator często nie rusza telefonu i nie zobaczyłby poziomów wcale.
   */
  demoLevel: (level: ThreatLevel) => void;
  setFriendView: (view: FriendView) => void;
  setShowHeatmap: (next: boolean) => void;
  setTab: (tab: DemoTab) => void;
  ringNow: () => void;
  /** Przewija odliczanie i od razu pokazuje telefon przyjaciółki. */
  skipToFriend: () => void;
  /** Adnotację zamyka prezentacja, nie aplikacja. */
  dismissFriendHint: () => void;
  /** Pełny reset — używają go przyciski ekranu alarmu u znajomej. */
  reset: () => void;
  /**
   * Wyjście z ekranu podrzędnego — to, co w apce robi systemowy przycisk
   * „wstecz" w pasku nawigacji. Na landingu pokazuje się jako przycisk
   * w ramce telefonu, bo poza apką nie ma paska.
   */
  goBack: () => void;
};

export type DemoPhoneProps = {
  ref?: React.Ref<DemoHandle>;
  safeAreaTop?: number;
  safeAreaBottom?: number;
  onState?: (state: DemoState) => void;
};

const FAKE_DELAY_S = Math.round(FAKE_CALL_DELAY_MS / 1000);
/**
 * Ile sekund trwa odliczanie do fake call.
 *
 * Eksportowane, bo pasek postępu w adnotacji prezentacji musi mieć dokładnie
 * tę długość co odliczanie w telefonie — inaczej pasek dochodzi do końca
 * w chwili, gdy nic się jeszcze nie dzieje, albo znika zanim coś się pokaże.
 */
export const FAKE_CALL_COUNTDOWN_S = FAKE_DELAY_S;
/** Label na najwyższym poziomie: mówi, co się stanie, zamiast liczyć sekundy. */
const POLICE_LABEL = "Powiadom policje";

export const DemoPhone = forwardRef<DemoHandle, DemoPhoneProps>(
  function DemoPhone({ safeAreaTop = 0, safeAreaBottom = 0, onState }, ref) {
    const [tab, setTab] = useState<DemoTab>("map");
    const [level, setLevel] = useState<ThreatLevel>(0);
    const [preview, setPreview] = useState<ThreatLevel | null>(null);
    /**
     * Czy w tym przebiegu telefon przeszedł automatycznie na widok znajomej.
     *
     * Od tego zależy reset: automatyczny przebieg ma wrócić do początku po
     * 2 s, ale ścieżka ręczna („Zobacz teraz" w adnotacji prezentacji) ma
     * zostawić ekran znajomej, bo prezentator może chcieć przy nim zatrzymać.
     * Ref, nie state — nie potrzebuje przerysowania.
     */
    const autoPlayedRef = useRef(false);
    /**
     * Polecenie „przesuń suwak" z landingu. `nonce` rośnie przy każdym
     * kliknięciu, żeby ten sam poziom dało się odpalić wielokrotnie — sam
     * obiekt poziomu jako `useEffect` zależność nie wystarczyłby.
     */
    const [autoDrag, setAutoDrag] = useState<{
      level: ThreatLevel;
      nonce: number;
    } | null>(null);
    const [callPhase, setCallPhase] = useState<CallPhase>("idle");
    const [countdown, setCountdown] = useState<number | null>(null);
    const [contactIdx, setContactIdx] = useState(0);
    const [acks, setAcks] = useState<MockAck[]>([]);
    const [dispatchCase, setDispatchCase] = useState<string | null>(null);
    const [friendView, setFriendView] = useState<FriendView>("none");
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [cells] = useState<HeatmapCell[]>(() => mockHeatmap());
    const [recenterTick, setRecenterTick] = useState(0);
    /**
     * Komunikat po puszczeniu suwaka na poziom 3: zapowiada, że za chwilę
     * zobaczymy telefon przyjaciółki. Landing używa go jako narracji przed
     * zamianą urządzeń, a przycisk „Zobacz" przewija ten czas.
     */
    const [showFriendHint, setShowFriendHint] = useState(false);

    const contact = MOCK_CONTACTS[contactIdx % MOCK_CONTACTS.length]!;
    const recording = level === 3;

    const commit = (next: ThreatLevel) => {
      if (next === 0) {
        setLevel(0);
        setCallPhase("idle");
        setCountdown(null);
        setAcks([]);
        setDispatchCase(null);
        setShowFriendHint(false);
        return;
      }
      setLevel(next);
      setContactIdx((i) => i + 1);
      setCallPhase("waiting");
      setCountdown(FAKE_DELAY_S);
      if (next >= 2) {
        setAcks([
          { userId: "kasia", displayName: "Kasia", action: "answered" },
        ]);
      }
      setDispatchCase(
        next >= 3 ? `112/${new Date().getFullYear()}/0420` : null,
      );
      // Komunikat „tak to wygląda u przyjaciółki" tylko na najwyższym poziomie —
      // niżej znajomi dostają tylko powiadomienie, więc nie ma czego pokazywać.
      setShowFriendHint(next === 3);
    };

    /**
     * Całkowity reset demo.
     *
     * Wywoływany z przycisków ekranu alarmu u znajomej: nie chodzi tylko o
     * zamknięcie nakładki, ale o powrót do stanu początkowego — poziom 0,
     * brak licznika, brak wezwania 112, brak acków, mapa. Inaczej po „Zamknij"
     * telefon zostałby na poziomie 3 z zapisanym sprawieniem.
     */
    const reset = useCallback((opts?: { recenter?: boolean }) => {
      // Timer odliczania sprząta się sam w cleanup efektu, gdy `callPhase`
      // przestanie być „waiting" — nie trzymamy tu własnej listy timerów.
      autoPlayedRef.current = false;
      setLevel(0);
      setPreview(null);
      setCallPhase("idle");
      setCountdown(null);
      setAcks([]);
      setDispatchCase(null);
      setFriendView("none");
      setShowFriendHint(false);
      setTab("map");
      setShowHeatmap(true);
      if (opts?.recenter !== false) setRecenterTick((t) => t + 1);
    }, []);

    /**
     * Pełny reset, a potem suwak sam jedzie do wybranego poziomu.
     *
     * Reset przed ruchem jest konieczny: gdy telefon jest na ekranie rozmowy
     * albo w widoku znajomej, suwaka nie ma widać i animacja działałaby w
     * ukrytym drzewie, a widz nie zobaczyłby żadnej reakcji.
     *
     * `recenter: false` — recenter mapy przy każdym kliknięciu poziomu
     * wyglądałby jak przypadkowe przeskakiwanie, a `easeTo` MapLibre blokował
     * główny wątek na tyle, że `requestAnimationFrame` w ogóle nie dostawał
     * klatek przez pierwsze pół sekundy. Gałka wtedy stała nieruchomo, a potem
     * przeskakiwała na koniec — wyglądało to jak ucieczka poza pasek.
     */
    const demoLevel = useCallback(
      (target: ThreatLevel) => {
        reset({ recenter: false });
        setAutoDrag((prev) => ({ level: target, nonce: (prev?.nonce ?? 0) + 1 }));
      },
      [reset],
    );

    useImperativeHandle(ref, () => ({
      commit,
      demoLevel,
      setFriendView,
      setShowHeatmap,
      setTab,
      ringNow: () => setCallPhase("ringing"),
      /** Przewija odliczanie i od razu pokazuje telefon przyjaciółki. */
      dismissFriendHint: () => setShowFriendHint(false),
      skipToFriend: () => {
        setShowFriendHint(false);
        // Ścieżka ręczna: bez automatycznego resetu po 2 s.
        autoPlayedRef.current = false;
        // „active", nie „ringing": prezentacja wchodzi od razu w widok
        // znajomej, a fake call i tak ma zostać na iPhonie.
        setCallPhase("active");
      },
      reset,
      goBack: () => {
        // Kolejność jak w apce: najpierw zamykamy nakładkę, potem wracamy na mapę.
        if (friendView !== "none") setFriendView("none");
        else if (callPhase === "ringing" || callPhase === "active") {
          setCallPhase("idle");
          setCountdown(null);
        } else if (tab !== "map") setTab("map");
        setShowFriendHint(false);
      },
    }));

    /**
     * Odliczanie do fake incoming call — jak useThreatLevel.
     *
     * Gdy zadzwoni i poziom jest wysoki, przenosimy się na telefon przyjaciółki:
     * od poziomu 2 to już pełnoekranowe powiadomienie, a nie zwykły push.
     */
    useEffect(() => {
      if (callPhase !== "waiting") return;
      if (countdown === null || countdown <= 0) {
        setCallPhase("ringing");
        return;
      }
      const id = window.setTimeout(
        () => setCountdown((c) => (c === null ? c : c - 1)),
        1000,
      );
      return () => window.clearTimeout(id);
    }, [callPhase, countdown]);

    /**
     * Przełączenie na telefon znajomej.
     *
     * **Dopiero po odebraniu**, nie w chwili dzwonienia. Fake call to
     * wymówka, którą Kasia stosuje wobec siebie samej — dlatego dzwoni on
     * na jej iPhonie i dopiero po odebraniu (czyli kiedy realnie jest na
     * rozmowie) warto pokazać, co widzi znajomy. Przy warunku `ringing`
     * nakładka fake call była nadpisywana w tej samej klatce, więc widz
     * nigdy nie zobaczył połączenia przychodzącego na swoim telefonie, tylko
     * cudzy telefon.
     *
     * **Tylko poziom 3.** Przy poziomie 2 prezentacja ma zostać na iPhonie
     * od początku do końca — to pokazanie, że zmiana poziomu sama w sobie nie
     * ujawnia aplikacji. Wymiana urządzeń przy poziomie 2 była zresztą
     * myląca: prezentator klika pomarańczową kropkę oczekując zmiany
     * poziomu, a dostawał cudzy telefon.
     *
     * Po 2 s automatyczny reset wraca do stanu początkowego, żeby demo dało
     * się puszczać w pętli bez ręcznego sprzątania.
     */
    useEffect(() => {
      if (callPhase !== "active" || level < MAX_LEVEL) return;
      setShowFriendHint(false);
      setFriendView("alarm");
    }, [callPhase, level]);

    /**
     * Automatyczne odebranie fake call i sprzątanie po nim.
     *
     * Prezentacja ma być bezobsługowa i zapętlona: jeśli trzeba klikać
     * „Odbierz", żeby zobaczyć resztę scenariusza, to jest przerwa w
     * prezentacji, a jeśli po fake call zostaje wiszącą nakładką, to demo
     * utknęło i trzeba je odświeżyć.
     *
     * Oś czasu od pojawienia się połączenia przychodzącego:
     * - 1,2 s — telefon sam „odbiera"; przy poziomie 3 to moment zamiany na
     *   telefon znajomej, bo fake call ma być najpierw widać na iPhonie;
     * - +2 s — reset do stanu początkowego, czyli 2 s po pokazaniu fake
     *   telefonu. Ten sam licznik dla wszystkich przycisków po lewej, więc
     *   każdy scenariusz kończy się identycznie.
     *
     * `autoPlayedRef` chroni ścieżkę ręczną: gdy prezentator sam wciska
     * „Zobacz teraz" w adnotacji albo „Odbierz", nic nie ma się zamykać.
     */
    useEffect(() => {
      if (callPhase !== "ringing") return;
      const answer = window.setTimeout(() => {
        autoPlayedRef.current = true;
        setCallPhase("active");
      }, 1200);
      return () => window.clearTimeout(answer);
    }, [callPhase]);

    /**
     * Zamknięcie fake call i reset — 2 s po pokazaniu fake telefonu.
     *
     * Osobny efekt od auto-odbierania celowo: `setCallPhase("active")` w
     * pierwszym efekcie przelicza zależności, a `cleanup` przy każdym takim
     * przeliczeniu kasuje odliczające się `setTimeout`y. Gdyby reset był
     * zaplanowany w tym samym efekcie, nigdy by nie doszedł do końca —
     * telefon przeskakiwałby na „odebrane" i zostawał wisiąc na ekranie.
     *
     * Efekt czyta `autoPlayedRef`, którego nie ma w zależnościach: ref nie
     * powoduje przeliczenia renderu, a kolejność „ustaw flagę → zmień fazę”
     * gwarantuje, że gdy ten efekt wystartuje, flaga już jest ustawiona.
     */
    useEffect(() => {
      if (callPhase !== "active" || !autoPlayedRef.current) return;
      const finish = window.setTimeout(() => reset(), 2000);
      return () => window.clearTimeout(finish);
    }, [callPhase, reset]);

    /**
     * Treść labela w suwaku.
     *
     * Na najwyższym poziomie odliczanie zostaje w tle (ono i tak steruje
     * fake call), a user widzi „Powiadom policje" — komunikat, który mówi
     * o tym, co się stanie, zamiast odliczać sekundy do telefonu.
     */
    const statusText = useMemo(() => {
      // Acki znajomych wjeżdżają do tego samego labela — osobna linijka
      // została zdjęta, bo tylko dublowała to, co widać na sliderze.
      const ack = level >= 2 ? ackLine(acks) : null;
      const suffix = ack ? ` · ${ack}` : "";
      if (preview !== null) {
        switch (preview) {
          case 0:
            return "Puść, aby anulować";
          case 1:
            return fakeCallPreview();
          case 2:
            return "Poziom 2 · Znajomi dostaną lokalizację";
          case 3:
            return POLICE_LABEL;
        }
      }
      if (level >= 3 && callPhase !== "idle") return POLICE_LABEL;
      if (callPhase === "waiting" && countdown !== null) {
        return `Telefon zadzwoni za ${countdown} s`;
      }
      if (callPhase === "ringing") return `Połączenie przychodzące${suffix}`;
      if (dispatchCase) return `Wezwano służby · ${dispatchCase}${suffix}`;
      return hint(level) + suffix;
    }, [preview, callPhase, countdown, dispatchCase, level, acks]);

    useEffect(() => {
      onState?.({
        tab,
        level,
        callPhase,
        countdown,
        friendView,
        friendHint: showFriendHint,
        showHeatmap,
        totalReported: cells.reduce((s, c) => s + c.count, 0),
        cellCount: cells.length,
      });
    }, [
      onState,
      tab,
      level,
      callPhase,
      countdown,
      friendView,
      showFriendHint,
      showHeatmap,
      cells,
    ]);

    const ringing = callPhase === "ringing" || callPhase === "active";

    return (
      <div className="demo-screen">
        {tab === "map" ? (
          <div className="map-screen">
            <MapView
              friends={MOCK_FRIENDS}
              level={level}
              showHeatmap={showHeatmap}
              heatmap={cells}
              recenterTick={recenterTick}
            />

            <div
              className="topbar right-only"
              style={{ paddingTop: 16 + safeAreaTop }}
              data-testid="demo-topbar"
            >
              <div className="top-right">
                {recording && (
                  <span className="rec-dot" title="Nagrywanie dowodu (mock)" />
                )}
                <button
                  className="icon-pill"
                  onClick={() => setTab("settings")}
                  aria-label="Ustawienia"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M3 6H21"
                      stroke="#F4F5F7"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M3 12H21"
                      stroke="#F4F5F7"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M3 18H21"
                      stroke="#F4F5F7"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="9"
                      cy="6"
                      r="2.4"
                      fill="#14161A"
                      stroke="#F4F5F7"
                      strokeWidth="1.8"
                    />
                    <circle
                      cx="15"
                      cy="12"
                      r="2.4"
                      fill="#14161A"
                      stroke="#F4F5F7"
                      strokeWidth="1.8"
                    />
                    <circle
                      cx="7"
                      cy="18"
                      r="2.4"
                      fill="#14161A"
                      stroke="#F4F5F7"
                      strokeWidth="1.8"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Jedyna informacja o poziomie to wypełniony slider — label
              wjeżdża do jego środka po commicie. */}
            <div
              className="bottom"
              style={{ paddingBottom: 14 + safeAreaBottom }}
            >
              <ThreatSlider
                onCommit={commit}
                activeLevel={level}
                onDragLevelChange={setPreview}
                caption={statusText || undefined}
                autoDrag={autoDrag}
              />
              {/* Kotwica do góry panelu (12 px nad nim), nie sztywny offset. */}
              <button
                className="recenter"
                onClick={() => setRecenterTick((t) => t + 1)}
                aria-label="Wyśrodkuj na mojej lokalizacji"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <circle
                    cx="12"
                    cy="12"
                    r="7"
                    stroke="#F4F5F7"
                    strokeWidth="1.8"
                  />
                  <circle cx="12" cy="12" r="2.5" fill="#F4F5F7" />
                  <path
                    d="M12 2V5"
                    stroke="#F4F5F7"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M12 19V22"
                    stroke="#F4F5F7"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M2 12H5"
                    stroke="#F4F5F7"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M19 12H22"
                    stroke="#F4F5F7"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            {(ringing || friendView !== "none") && (
              <div className="overlay-wrap">
                {friendView === "call" ? (
                  <FriendCallScreen
                    name="Kasia"
                    onAnswer={() => {
                      setAcks([
                        {
                          userId: "kasia",
                          displayName: "Kasia",
                          action: "answered",
                        },
                      ]);
                      setFriendView("none");
                    }}
                    onDecline={() => {
                      setAcks([
                        {
                          userId: "kasia",
                          displayName: "Kasia",
                          action: "seen",
                        },
                      ]);
                      setFriendView("none");
                    }}
                  />
                ) : friendView === "alarm" ? (
                  // Przyciski ekranu alarmu wracają do samego początku:
                  // nie tylko zamykają nakładkę, ale kasują cały alert.
                  <FriendAlarmScreen
                    name="Kasia"
                    onOnTheWay={reset}
                    onSeen={reset}
                  />
                ) : (
                  <IncomingCallOverlay
                    level={level}
                    contact={contact}
                    onAnswer={() => setCallPhase("active")}
                    onDecline={() => {
                      setCallPhase("idle");
                      setCountdown(null);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="tab-screen" style={{ paddingTop: safeAreaTop }}>
            {tab === "friends" && <FriendsPanel friends={MOCK_FRIENDS} />}
            {tab === "settings" && <SettingsPanel />}
            {tab === "login" && <SignInPanel />}
          </div>
        )}
      </div>
    );
  },
);

export { label };
