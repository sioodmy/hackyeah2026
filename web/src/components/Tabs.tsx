/**
 * Webowe odpowiedniki ekranów:
 * - app/src/screens/FriendsScreen (+ ScanScreen — tu sam mock kodu)
 * - app/src/screens/SettingsScreen (+ ProfileSettingsCard — uproszczony)
 * - app/src/screens/SignInScreen
 *
 * parseAvatar importowane na żywo z appki (@app/lib/avatar) — ten sam parser
 * co w RN, więc format "emoji|aura" testujesz tu i na Androidzie naraz.
 */
import { useState } from "react";
import { parseAvatar } from "@app/lib/avatar";
import { palette, switchTokens } from "../theme";
import type { MockFriend } from "../mock";

export function FriendsPanel({ friends }: { friends: MockFriend[] }) {
  const [accepted, setAccepted] = useState<string[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const visible = friends.filter((f) => !removed.includes(f.userId));

  return (
    <div className="tab-scroll">
      <div className="tab-header">
        <span className="tab-title">Znajomi</span>
      </div>

      <div className="card">
        <div className="card-title">Oczekujące prośby</div>
        <div className="friend-row">
          <div className="friend-ava" style={{ borderColor: "#AB47BC" }}>
            🦉
          </div>
          <div className="friend-info">
            <div className="friend-name">Nina</div>
            <div className="friend-sub">Zaproszenie oczekujące</div>
          </div>
          <button
            className="small-btn"
            onClick={() => setAccepted((a) => (a.includes("nina") ? a : [...a, "nina"]))}
          >
            {accepted.includes("nina") ? "Dodana ✓" : "Akceptuj"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Twój kod QR</div>
        <div className="card-note">Znajoma może zeskanować ten kod lub wpisać sześć znaków</div>
        <div className="qr-box">
          <div className="qr-fake">
            <span>MOKOSH</span>
            <strong>K7X·2QD</strong>
          </div>
          <div className="qr-code">K7X·2QD</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Twoje kontakty</div>
        {visible.length === 0 ? (
          <div className="card-note">Brak kontaktów. Pokaż swój kod znajomej.</div>
        ) : (
          visible.map((f) => {
            const { emoji, aura } = parseAvatar(`${f.emoji}|${f.aura}`);
            return (
              <div key={f.userId} className="friend-row">
                <div
                  className="friend-ava"
                  style={{ borderColor: aura ?? palette.border }}
                >
                  {emoji}
                </div>
                <div className="friend-info">
                  <div className="friend-name">{f.displayName}</div>
                  <div className="friend-sub">Kontakt zaufania</div>
                </div>
                <button className="link-danger" onClick={() => setRemoved((r) => [...r, f.userId])}>
                  Usuń
                </button>
              </div>
            );
          })
        )}
      </div>

      <button className="scan-btn" onClick={() => alert("Mock: tu w appce otwiera się skaner QR (expo-camera).")}>
        Skanuj kod znajomej
      </button>
    </div>
  );
}

const AURAS = ["#F472B6", "#F2761B", "#EFC02B", "#4CAF7D", "#8AB4F8", "#AB47BC"];
const EMOJIS = ["🌸", "🦊", "🌙", "⚡", "🐚", "🍀"];

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const s = switchTokens;
  return (
    <div className="row">
      <div>
        <div>{label}</div>
        {hint ? <div className="muted small">{hint}</div> : null}
      </div>
      <button
        className={value ? 'switch' : 'switch'}
        style={{
          width: s.width,
          height: s.height,
          background: value ? s.on : s.off,
        }}
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        aria-label={label}
      >
        <span
          style={{
            width: s.thumb,
            height: s.thumb,
            left: value ? s.width - s.thumb - s.padding : s.padding,
          }}
        />
      </button>
    </div>
  );
}

export function SettingsPanel() {
  const [name, setName] = useState("Kasia");
  const [emoji, setEmoji] = useState("🦊");
  const [aura, setAura] = useState(AURAS[1]!);
  const [liveShare, setLiveShare] = useState(true);
  const [haptics, setHaptics] = useState(true);

  return (
    <div className="tab-scroll">
      <div className="tab-header">
        <span className="tab-title">Ustawienia</span>
      </div>

      <div className="section-h">Twój profil</div>
      <div className="card">
        <div className="profile-preview">
          <div className="friend-ava big" style={{ borderColor: aura }}>
            {emoji}
          </div>
          <div>
            <div className="friend-name">{name || "Bez nazwy"}</div>
            <div className="friend-sub">Tak widzą Cię znajomi na mapie</div>
          </div>
        </div>
        <input
          className="text-input"
          value={name}
          maxLength={30}
          onChange={(e) => setName(e.target.value)}
          placeholder="Imię"
        />
        <div className="emoji-row">
          {EMOJIS.map((e) => (
            <button
              key={e}
              className={e === emoji ? "emoji-btn selected" : "emoji-btn"}
              onClick={() => setEmoji(e)}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="aura-row">
          {AURAS.map((a) => (
            <button
              key={a}
              className={a === aura ? "aura-btn selected" : "aura-btn"}
              style={{ background: a }}
              onClick={() => setAura(a)}
              aria-label={`Aura ${a}`}
            />
          ))}
        </div>
      </div>

      <div className="section-h">Prywatność</div>
      <div className="card">
        <Toggle
          label="Udostępnianie lokalizacji"
          hint="Znajomi widzą pozycję przy podwyższonym poziomie"
          value={liveShare}
          onChange={setLiveShare}
        />
        <Toggle label="Wibracje" value={haptics} onChange={setHaptics} />
      </div>
    </div>
  );
}

export function SignInPanel() {
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "verify">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");

  const submit = () => {
    if (mode === "sign-up") setMode("verify");
  };

  return (
    <div className="signin">
      <div className="signin-glow" aria-hidden />

      <div className="signin-top">
        <div className="signin-mark" aria-hidden>
          <span className="signin-mark-ring" />
          <span className="signin-mark-dot" />
        </div>
        <h1 className="signin-brand">Mokosh</h1>
        <p className="signin-tagline">
          Wygląda jak mapa. Znajomi wiedzą, gdzie jesteś — tylko wtedy, gdy naprawdę tego
          potrzebujesz.
        </p>
      </div>

      <div className="signin-card">
        <div className="signin-seg" role="tablist" aria-label="Logowanie lub rejestracja">
          <button
            role="tab"
            aria-selected={mode === "sign-in"}
            className={mode === "sign-in" ? "signin-seg-btn on" : "signin-seg-btn"}
            onClick={() => setMode("sign-in")}
          >
            Logowanie
          </button>
          <button
            role="tab"
            aria-selected={mode === "sign-up"}
            className={mode === "sign-up" ? "signin-seg-btn on" : "signin-seg-btn"}
            onClick={() => setMode("sign-up")}
          >
            Konto
          </button>
          <span
            className="signin-seg-thumb"
            style={{ transform: `translateX(${mode === "sign-in" ? 0 : 100}%)` }}
            aria-hidden
          />
        </div>

        {mode === "verify" ? (
          <>
            <div className="signin-hint">Wysłaliśmy sześciocyfrowy kod na {email || "twój mail"}.</div>
            <input
              className="signin-code"
              placeholder="• • • • • •"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              aria-label="Kod z maila"
            />
            <button className="signin-cta" disabled={code.length < 6}>
              Potwierdź
            </button>
            <button className="signin-link" onClick={() => setMode("sign-up")}>
              Wróć
            </button>
          </>
        ) : (
          <>
            <label className="signin-field">
              <span>Email</span>
              <input
                type="email"
                placeholder="ty@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="signin-field">
              <span>Hasło</span>
              <input
                type="password"
                placeholder="min. 8 znaków"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              className="signin-cta"
              disabled={!email || password.length < 8}
              onClick={submit}
            >
              {mode === "sign-in" ? "Zaloguj się" : "Załóż konto"}
            </button>
          </>
        )}
      </div>

      <p className="signin-foot">
        Twoja lokalizacja jest udostępniana wyłącznie przy podwyższonym poziomie zagrożenia.
        Wszystko, co zbieramy, zostaje między Tobą a Twoimi kontaktami zaufania.
      </p>
      <div className="signin-mock">Mock: Clerk niepodłączony — przyciski tylko pokazują UI.</div>
    </div>
  );
}
