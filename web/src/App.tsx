/**
 * WEB-PREVIEW (branch web/preview) — podgląd UI Mokosh w przeglądarce.
 * Zero backendu, zero buildów Androida. Wszystko to mock w pamięci.
 *
 * Ten plik to tylko sam telefon + panel scenariuszy. Właściwy ekran mieszka
 * w `DemoPhone.tsx`, bo ten sam komponent osadza landing w ramce iPhone'a —
 * jedna kopia UI, dwa miejsca, w których działa.
 *
 * PĘTLA PRACY RN → WEB → RN:
 * 1. Czysta logika jest importowana NA ŻYWO przez alias @app — edytujesz raz,
 *    działa tu i w RN: theme/tokens.ts, theme/levels.ts, lib/avatar.ts.
 * 2. Komponenty są lustrzane 1:1 z appką:
 *    components/ThreatSlider ↔ app/src/components/ThreatSlider
 *    components/MapView     ↔ app/src/components/MapCanvas
 *    components/Overlays    ↔ IncomingCallOverlay + FriendAlarmOverlay
 *    components/Tabs        ↔ FriendsScreen + SettingsScreen + SignInScreen
 * 3. Materiał (kolory, gradienty, geometria) czytany z `sliderTokens`
 *    i `switchTokens`, więc podgląd i apka nie rozjadą się po kolorach.
 */
import { useRef, useState, type CSSProperties } from "react";
import {
  DemoPhone,
  FAKE_CALL_COUNTDOWN_S,
  type DemoHandle,
  type DemoState,
} from "./DemoPhone";
import { colorForLevel, label, palette, type ThreatLevel } from "./theme";

export default function App() {
  const phone = useRef<DemoHandle>(null);
  const [state, setState] = useState<DemoState | null>(null);

  return (
    <div className="page">
      <div className="phone-col">
        {/* Adnotacja jest NAD telefonem, nie w jego ekranie — tak samo jak na
            landingu. Wewnątrz ekranu wyglądałaby jak funkcja Mokosh. */}
        {state?.friendHint ? (
          <div
            className="friend-hint is-outside"
            style={
              {
                "--hint-ms": `${FAKE_CALL_COUNTDOWN_S * 1000}ms`,
              } as CSSProperties
            }
          >
            <span
              className="friend-hint-dot"
              style={{ background: palette.level3 }}
              aria-hidden
            />
            <div className="friend-hint-text">
              <strong>Tak to wygląda u twojej przyjaciółki</strong>
              <span>Za chwilę pokażemy jej telefon</span>
            </div>
            <button
              type="button"
              className="friend-hint-skip"
              style={{ background: palette.level3 }}
              onClick={() => phone.current?.skipToFriend()}
            >
              Zobacz
            </button>
            <button
              type="button"
              className="friend-hint-close"
              onClick={() => phone.current?.dismissFriendHint()}
              aria-label="Zamknij komunikat"
            >
              ✕
            </button>
            <div className="friend-hint-progress">
              <span className="friend-hint-bar" />
              <span className="friend-hint-progress-label">fake połączenie</span>
            </div>
          </div>
        ) : null}
        <div className="phone">
          <DemoPhone ref={phone} onState={setState} />
        </div>
      </div>

      <aside className="deck">
        <h1>
          Mokosh <span className="tag">web-preview · mock</span>
        </h1>
        <p className="deck-note">
          Bez backendu, bez Android builda. Slider i mapa działają lokalnie;
          poziomy, countdown 5 s i overlaye jak w appce. Ten sam{" "}
          <code>DemoPhone</code> siedzi w sekcji demo na landingu, więc to, co
          tu poprawisz, od razu widać tam.
        </p>

        <section>
          <h2>Scenariusz poziomu</h2>
          <div className="btn-row">
            {[0, 1, 2, 3].map((l) => (
              <button
                key={l}
                className={state?.level === l ? "deck-btn active" : "deck-btn"}
                style={
                  state?.level === l && l > 0
                    ? { borderColor: colorForLevel(l) }
                    : undefined
                }
                onClick={() => phone.current?.commit(l as ThreatLevel)}
              >
                {l === 0 ? "0 · reset" : l === 3 ? "3 · SOS" : `${l}`}
              </button>
            ))}
          </div>
          <div className="deck-note">
            Stan: poziom <strong>{state?.level ?? 0}</strong> ·{" "}
            {label(state?.level ?? 0)} · faza połączenia:{" "}
            <strong>{state?.callPhase ?? "idle"}</strong>
            {state?.countdown != null &&
              state?.callPhase === "waiting" &&
              ` · za ${state.countdown} s`}
          </div>
          {state?.callPhase === "waiting" && (
            <button
              className="deck-btn wide"
              onClick={() => phone.current?.ringNow()}
            >
              Przyspiesz: zadzwoń teraz ⏩
            </button>
          )}
        </section>

        <section>
          <h2>Telefon znajomej (push → tap)</h2>
          <div className="btn-row">
            <button
              className={
                state?.friendView === "call" ? "deck-btn active" : "deck-btn"
              }
              onClick={() =>
                phone.current?.setFriendView(
                  state?.friendView === "call" ? "none" : "call",
                )
              }
            >
              📞 Poziom 2 · call request
            </button>
            <button
              className={
                state?.friendView === "alarm" ? "deck-btn active" : "deck-btn"
              }
              onClick={() =>
                phone.current?.setFriendView(
                  state?.friendView === "alarm" ? "none" : "alarm",
                )
              }
            >
              🚨 Poziom 3 · alarm + syrena
            </button>
          </div>
          <div className="deck-note">
            Przyciski w overlayach ustawiają ack („rozmawia / idzie”).
          </div>
        </section>

        <section>
          <h2>Mapa</h2>
          <div className="btn-row">
            <button
              className="deck-btn"
              onClick={() =>
                phone.current?.setShowHeatmap(!(state?.showHeatmap ?? true))
              }
            >
              🔥 heatmapa: {state?.showHeatmap ? "on" : "off"}
            </button>
          </div>
          <div className="deck-note">
            {state?.totalReported ?? 0} zgłoszeń w {state?.cellCount ?? 0}{" "}
            komórkach (mock, ~200 m grid). UI zgłoszeń i legenda zostały zdjęte
            zgodnie z decyzją — warstwa jest włączona zawsze.
          </div>
        </section>

        <section>
          <h2>Ekran w telefonie</h2>
          <div className="btn-row">
            {(["map", "friends", "settings", "login"] as const).map((t) => (
              <button
                key={t}
                className={state?.tab === t ? "deck-btn active" : "deck-btn"}
                onClick={() => phone.current?.setTab(t)}
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
