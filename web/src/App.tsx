/**
 * WEB-PREVIEW (branch web/preview) — tymczasowy podgląd UI Mokosh w przeglądarce.
 * Zero backendu, zero buildów Androida. Wszystko to mock w pamięci.
 *
 * PĘTLA PRACY RN → WEB → RN:
 * 1. Czysta logika (app/src/theme/levels.ts, app/src/lib/avatar.ts) jest
 *    importowana NA ŻYWO przez alias @app — edytujesz raz, działa tu i w RN.
 * 2. Komponenty są lustrzane 1:1 z appką (te same propsy i nazwy stanów):
 *    web/src/components/ThreatSlider ↔ app/src/components/ThreatSlider
 *    web/src/components/MapView     ↔ app/src/components/MapCanvas
 *    web/src/components/Overlays    ↔ IncomingCallOverlay + FriendAlarmOverlay
 *    web/src/components/Tabs        ↔ FriendsScreen + SettingsScreen + SignInScreen
 *    (HeatmapLegend i IncidentReportModal usunięte — bez UI zgłoszeń)
 *    Iterujesz wygląd tutaj (pyk pyk), potem przeklejasz style/logikę do RN.
 * 3. Paleta (theme.ts) to kopia wartości z app/src/theme/index.ts — przy
 *    mergu porównaj i ujednolić w obie strony.
 */
import { useEffect, useMemo, useState } from "react";
import { MapView } from "./components/MapView";
import { ThreatSlider } from "./components/ThreatSlider";
import { FriendAlarmScreen, FriendCallScreen, IncomingCallOverlay } from "./components/Overlays";
import { FriendsPanel, SettingsPanel, SignInPanel } from "./components/Tabs";
import {
  FAKE_CALL_DELAY_MS,
  colorForLevel,
  hint,
  label,
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

type Tab = "map" | "friends" | "settings" | "login";
type CallPhase = "idle" | "waiting" | "ringing" | "active";
type FriendView = "none" | "call" | "alarm";

const FAKE_DELAY_S = Math.round(FAKE_CALL_DELAY_MS / 1000);

export default function App() {
  const [tab, setTab] = useState<Tab>("map");
  const [level, setLevel] = useState<ThreatLevel>(0);
  const [preview, setPreview] = useState<ThreatLevel | null>(null);
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [contactIdx, setContactIdx] = useState(0);
  const [acks, setAcks] = useState<MockAck[]>([]);
  const [dispatchCase, setDispatchCase] = useState<string | null>(null);
  const [friendView, setFriendView] = useState<FriendView>("none");
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [cells] = useState<HeatmapCell[]>(() => mockHeatmap());
  const [recenterTick, setRecenterTick] = useState(0);

  const contact = MOCK_CONTACTS[contactIdx % MOCK_CONTACTS.length]!;
  const recording = level === 3;

  const commit = (next: ThreatLevel) => {
    if (next === 0) {
      setLevel(0);
      setCallPhase("idle");
      setCountdown(null);
      setAcks([]);
      setDispatchCase(null);
      return;
    }
    setLevel(next);
    setContactIdx((i) => i + 1);
    setCallPhase("waiting");
    setCountdown(FAKE_DELAY_S);
    if (next >= 2) {
      setAcks([{ userId: "kasia", displayName: "Kasia", action: "answered" }]);
    }
    if (next >= 3) {
      setDispatchCase("112/" + new Date().getFullYear() + "/0420");
    } else {
      setDispatchCase(null);
    }
  };

  // Odliczanie do fake incoming call — jak useThreatLevel (10 s od commita).
  useEffect(() => {
    if (callPhase !== "waiting") return;
    if (countdown === null || countdown <= 0) {
      setCallPhase("ringing");
      return;
    }
    const id = window.setTimeout(() => setCountdown((c) => (c === null ? c : c - 1)), 1000);
    return () => window.clearTimeout(id);
  }, [callPhase, countdown]);

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
          return "Poziom 1 · Telefon zadzwoni za 10 s";
        case 2:
          return "Poziom 2 · Znajomi dostaną lokalizację";
        case 3:
          return "Poziom 3 · Pełny alarm SOS + nagrywanie";
      }
    }
    if (callPhase === "waiting" && countdown !== null) return `Telefon zadzwoni za ${countdown} s`;
    if (callPhase === "ringing") return `Połączenie przychodzące${suffix}`;
    if (dispatchCase) return `Wezwano służby · ${dispatchCase}${suffix}`;
    return hint(level) + suffix;
  }, [preview, callPhase, countdown, dispatchCase, level, acks]);

  const totalReported = useMemo(() => cells.reduce((s, c) => s + c.count, 0), [cells]);

  const ringing = callPhase === "ringing" || callPhase === "active";

  return (
    <div className="page">
      <div className="phone-col">
        <div className="phone">
          {tab === "map" && (
            <div className="map-screen">
              <MapView
                friends={MOCK_FRIENDS}
                level={level}
                showHeatmap={showHeatmap}
                heatmap={cells}
                recenterTick={recenterTick}
              />

              <div className="topbar right-only">
                <div className="top-right">
                  {recording && <span className="rec-dot" title="Nagrywanie dowodu (mock)" />}
                  <button className="icon-pill" onClick={() => setTab("settings")} aria-label="Ustawienia">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M3 6H21" stroke="#F4F5F7" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M3 12H21" stroke="#F4F5F7" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M3 18H21" stroke="#F4F5F7" strokeWidth="1.8" strokeLinecap="round" />
                      <circle cx="9" cy="6" r="2.4" fill="#14161A" stroke="#F4F5F7" strokeWidth="1.8" />
                      <circle cx="15" cy="12" r="2.4" fill="#14161A" stroke="#F4F5F7" strokeWidth="1.8" />
                      <circle cx="7" cy="18" r="2.4" fill="#14161A" stroke="#F4F5F7" strokeWidth="1.8" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="bottom">
                {/* Jedyna informacja o poziomie to wypełniony slider — label
                    wjeżdża do jego środka po commicie. Osobna linijka statusu
                    i ack-linia zostały zdjęte: duplikowały to, co widać. */}
                <ThreatSlider
                  onCommit={commit}
                  activeLevel={level}
                  onDragLevelChange={setPreview}
                  caption={statusText || undefined}
                />
                {/* Kotwica do góry panelu (12 px nad nim), nie sztywny offset. */}
                <button
                  className="recenter"
                  onClick={() => setRecenterTick((t) => t + 1)}
                  aria-label="Wyśrodkuj na mojej lokalizacji"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="7" stroke="#F4F5F7" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="2.5" fill="#F4F5F7" />
                    <path d="M12 2V5" stroke="#F4F5F7" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M12 19V22" stroke="#F4F5F7" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M2 12H5" stroke="#F4F5F7" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M19 12H22" stroke="#F4F5F7" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {(ringing || friendView !== "none") && (
                <div className="overlay-wrap">
                  {friendView === "call" ? (
                    <FriendCallScreen
                      name="Kasia"
                      onAnswer={() => {
                        setAcks([{ userId: "kasia", displayName: "Kasia", action: "answered" }]);
                        setFriendView("none");
                      }}
                      onDecline={() => {
                        setAcks([{ userId: "kasia", displayName: "Kasia", action: "seen" }]);
                        setFriendView("none");
                      }}
                    />
                  ) : friendView === "alarm" ? (
                    <FriendAlarmScreen
                      name="Kasia"
                      onOnTheWay={() => {
                        setAcks([{ userId: "kasia", displayName: "Kasia", action: "on_the_way" }]);
                        setFriendView("none");
                      }}
                      onSeen={() => {
                        setAcks([{ userId: "kasia", displayName: "Kasia", action: "seen" }]);
                        setFriendView("none");
                      }}
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
          )}

          {tab !== "map" && (
            <div className="tab-screen">
              {tab === "friends" && <FriendsPanel friends={MOCK_FRIENDS} />}
              {tab === "settings" && <SettingsPanel />}
              {tab === "login" && <SignInPanel />}
            </div>
          )}
        </div>
      </div>

      <aside className="deck">
        <h1>
          Mokosh <span className="tag">web-preview · mock</span>
        </h1>
        <p className="deck-note">
          Bez backendu, bez Android builda. Slider i mapa działają lokalnie; poziomy, countdown
          10 s i overlaye jak w appce. Zmiany wyglądu przeklej do
          <code> app/src/…</code> (mapowanie w nagłówku tego pliku).
        </p>

        <section>
          <h2>Scenariusz poziomu</h2>
          <div className="btn-row">
            {[0, 1, 2, 3].map((l) => (
              <button
                key={l}
                className={level === l ? "deck-btn active" : "deck-btn"}
                style={level === l && l > 0 ? { borderColor: colorForLevel(l) } : undefined}
                onClick={() => commit(l as ThreatLevel)}
              >
                {l === 0 ? "0 · reset" : l === 3 ? "3 · SOS" : `${l}`}
              </button>
            ))}
          </div>
          <div className="deck-note">
            Stan: poziom <strong>{level}</strong> · {label(level)} · faza połączenia:{" "}
            <strong>{callPhase}</strong>
            {countdown !== null && callPhase === "waiting" && ` · za ${countdown} s`}
          </div>
          {callPhase === "waiting" && (
            <button className="deck-btn wide" onClick={() => setCallPhase("ringing")}>
              Przyspiesz: zadzwoń teraz ⏩
            </button>
          )}
        </section>

        <section>
          <h2>Telefon znajomej (push → tap)</h2>
          <div className="btn-row">
            <button
              className={friendView === "call" ? "deck-btn active" : "deck-btn"}
              onClick={() => setFriendView(friendView === "call" ? "none" : "call")}
            >
              📞 Poziom 2 · call request
            </button>
            <button
              className={friendView === "alarm" ? "deck-btn active" : "deck-btn"}
              onClick={() => setFriendView(friendView === "alarm" ? "none" : "alarm")}
            >
              🚨 Poziom 3 · alarm + syrena
            </button>
          </div>
          <div className="deck-note">Przyciski w overlayach ustawiają ack („rozmawia / idzie”).</div>
        </section>

        <section>
          <h2>Mapa</h2>
          <div className="btn-row">
            <button className="deck-btn" onClick={() => setShowHeatmap((v) => !v)}>
              🔥 heatmapa: {showHeatmap ? "on" : "off"}
            </button>
          </div>
          <div className="deck-note">
            {totalReported} zgłoszeń w {cells.length} komórkach (mock, ~200 m grid). UI zgłoszeń
            i legenda zostały zdjęte zgodnie z decyzją — warstwa jest włączona zawsze.
          </div>
        </section>

        <section>
          <h2>Ekran w telefonie</h2>
          <div className="btn-row">
            {(["map", "friends", "settings", "login"] as Tab[]).map((t) => (
              <button
                key={t}
                className={tab === t ? "deck-btn active" : "deck-btn"}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
