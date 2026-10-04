import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Database,
  DeviceMobile,
  GithubLogo,
  Heart,
  ShieldCheck,
  TerminalWindow,
  Warning,
} from "@phosphor-icons/react";

const REPO = "https://github.com/sioodmy/hackyeah2026";
const RELEASES = "https://github.com/sioodmy/hackyeah2026/releases";

/** Kod QR jako inline SVG — bez zewnętrznego serwera i bez bitmapy w PDF-ie. */
const Qr: React.FC<{ value: string; size?: number }> = ({
  value,
  size = 116,
}) => {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    let alive = true;
    QRCode.toString(value, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#0b0c0e", light: "#00000000" },
    }).then((out) => {
      if (alive) setSvg(out);
    });
    return () => {
      alive = false;
    };
  }, [value]);

  return (
    <div
      className="rounded-xl bg-white p-2.5 shrink-0 grid place-items-center"
      style={{ width: size + 20, height: size + 20 }}
    >
      {svg ? (
        <div
          style={{ width: size, height: size }}
          className="[&>svg]:w-full [&>svg]:h-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null}
    </div>
  );
};

/** Trzy filary z `ArchitectureSection.tsx` — nazwy, opisy i bullety 1:1.
 *  Backend poprawiony na faktyczny stos (Fastify + Drizzle zamiast FastAPI). */
const STACK: ReadonlyArray<{
  icon: React.ReactNode;
  kicker: string;
  color: string;
  title: string;
  lead: string;
  rows: ReadonlyArray<string>;
  path: string;
}> = [
  {
    icon: <DeviceMobile size={22} weight="bold" />,
    kicker: "Client",
    color: "#38BDF8",
    title: "Aplikacja Mobilna",
    lead: "Klient w React Native i Expo, zoptymalizowany pod minimalne zużycie baterii i płynne rysowanie kafelków mapy.",
    rows: [
      "React Native 0.85 + Expo 56",
      "MapLibre (desaturacja CARTO / OSM)",
      "Expo Audio (pakiety 30 s, SHA-256)",
      "Expo Notifications (bypassDnd)",
    ],
    path: "app/src/**/*.{ts,tsx}",
  },
  {
    icon: <Database size={22} weight="bold" />,
    kicker: "Backend",
    color: "#ff2a85",
    title: "API i silnik zgłoszeń",
    lead: "Asynchroniczne API z WebSocketami dla pozycji na żywo oraz silnikiem agregującym zgłoszenia na siatce ~200 m.",
    rows: [
      "Fastify 5 + Zod + Drizzle",
      "WebSockets (/ws/locations)",
      "PostgreSQL (11 tabel, 4 migracje)",
      "Weryfikacja SHA-256 segmentów audio",
    ],
    path: "backend/src/**/*.ts",
  },
  {
    icon: <TerminalWindow size={22} weight="bold" />,
    kicker: "DevOps",
    color: "#4CAF7D",
    title: "Środowisko i pipeline",
    lead: "Powtarzalne środowisko developerskie dzięki Nix Flakes oraz pipeline testów i budowania APK.",
    rows: [
      "Nix Flakes (flake.nix, 4 systemy)",
      "Justfile (just api, just app)",
      "Vitest + PGlite (187 przypadków)",
      "GitHub Actions CI/CD + Pages",
    ],
    path: ".github/workflows/*.yml",
  },
];

/**
 * Slajd zamykający: manifesto, stack i granice w jednym kadrze.
 *
 * Manifest jest najmocniejszym tekstem w repozytorium, a stack i lista granic
 * są tym, o co jury pyta na końcu — przy limicie dziesięciu slajdów mieszczą
 * się w jednym ekranie, bo każde z tych trzech jest krótkie.
 */
export const Closing: React.FC<{ index: number; total: number }> = ({
  index,
  total,
}) => (
  <section className="slide" data-slide={index}>
    <div
      className="slide-glow"
      style={
        { width: 820, height: 400, top: 100, left: 100 } as React.CSSProperties
      }
      aria-hidden
    />
    <div className="slide-inner" style={{ padding: "46px 64px 40px" }}>
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-[#ff2a85] grid place-items-center text-white shadow-lg shadow-[#ff2a85]/25">
          <ShieldCheck size={20} weight="fill" />
        </div>
        <span className="text-[19px] font-extrabold tracking-tight text-white">
          Mokosh
        </span>
        <span className="ml-auto text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">
          HackYeah 2026 · Kraków · {String(index + 1).padStart(2, "0")} /{" "}
          {String(total).padStart(2, "0")}
        </span>
      </div>

      <div className="flex-1 min-h-0 flex items-center gap-11 mt-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-7 h-7 rounded-lg bg-[#ff2a85]/15 border border-[#ff2a85]/30 grid place-items-center text-[#ff2a85]">
              <Heart size={16} weight="fill" />
            </span>
            <span className="text-[10.5px] font-mono font-semibold uppercase tracking-[0.18em] text-[#ff2a85]">
              Dlaczego powstał Mokosh
            </span>
          </div>

          <h2 className="text-[38px] leading-[1.06] font-extrabold tracking-tight text-white">
            Nocne ulice bez strachu{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-[#ff2a85] to-pink-300">
              i bez pouczania.
            </span>
          </h2>

          <p className="mt-4 text-[13px] leading-relaxed text-slate-300 max-w-[60ch]">
            Zamiast powtarzać dziewczynom „nie wracaj sama” albo „uważaj jak się
            ubierasz”, stworzyliśmy proste narzędzie, które daje realną
            kontrolę. Bez moralizowania, bez wstydu i bez przerzucania winy na
            ofiarę.
          </p>

          <ul className="mt-5 flex flex-col gap-2.5">
            {[
              [
                "Pretekst zamiast konfrontacji",
                "Większość groźnych sytuacji to natarczywe zaczepki, nieudana randka czy niepokojący typ na przystanku. Fałszywy telefon daje natychmiastowe alibi, by odejść spokojnie i bez ryzyka awentury.",
              ],
              [
                "Wsparcie bez komercyjnego śledzenia",
                "Nie zbieramy Twojej lokalizacji dla reklamodawców. GPS uruchamia się tylko wtedy, gdy sama pociągniesz za suwak, i trafia wyłącznie do zaufanych osób z Twojego kręgu.",
              ],
              [
                "Nagranie bezpieczne w chmurze",
                "Koniec z sytuacjami słowo przeciwko słowu. Pakiety audio trafiają na serwer w czasie rzeczywistym razem ze znacznikami czasu i pozycji GPS.",
              ],
            ].map(([title, body]) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-[3px] shrink-0 w-4 h-4 rounded-full bg-[#ff2a85]/20 text-[#ff2a85] grid place-items-center text-[9px] font-bold">
                  ✓
                </span>
                <span className="min-w-0">
                  <span className="block text-[12.5px] font-bold text-white">
                    {title}
                  </span>
                  <span className="block text-[11.5px] leading-snug text-slate-400">
                    {body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 flex flex-col items-center gap-3.5">
          <Qr value={RELEASES} size={118} />
          <div className="text-center">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-slate-400 whitespace-nowrap">
              Pobierz APK (v0.3.0)
            </div>
            <div className="font-mono text-[10px] text-slate-600 mt-1 whitespace-nowrap">
              sioodmy/hackyeah2026
            </div>
          </div>
          <a
            href={REPO}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <GithubLogo size={14} weight="bold" />
            Kod źródłowy
          </a>
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-3 gap-3.5">
        {STACK.map((col) => (
          <div
            key={col.title}
            className="rounded-2xl border border-white/[0.07] bg-[#10111a] px-4 py-3.5"
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="shrink-0 w-7 h-7 rounded-lg grid place-items-center"
                style={{
                  background: `${col.color}1f`,
                  border: `1px solid ${col.color}3d`,
                  color: col.color,
                }}
              >
                {col.icon}
              </span>
              <span className="min-w-0">
                <span
                  className="block text-[9.5px] font-mono font-semibold uppercase tracking-[0.16em]"
                  style={{ color: col.color }}
                >
                  {col.kicker}
                </span>
                <span className="block text-[12.5px] font-bold text-white leading-tight">
                  {col.title}
                </span>
              </span>
            </div>
            <p className="text-[11px] leading-snug text-slate-400 mb-2">
              {col.lead}
            </p>
            <ul className="flex flex-col gap-1">
              {col.rows.map((r) => (
                <li key={r} className="flex items-center gap-2">
                  <span
                    className="w-1 h-1 rounded-full shrink-0"
                    style={{ background: col.color }}
                  />
                  <span className="text-[10.5px] font-mono text-slate-300">
                    {r}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="shrink-0 mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-2.5 flex items-start gap-2.5">
        <Warning
          size={14}
          weight="fill"
          className="text-amber-400 shrink-0 mt-0.5"
        />
        <div className="min-w-0">
          <span className="text-[11px] font-semibold text-amber-300">
            Granice, o których mówimy sami:
          </span>{" "}
          <p className="inline text-[11px] leading-snug text-slate-400">
            poziomy 2 i 3 to heads-up z dźwiękiem i wibracją, ekran otwiera
            dotknięcie (brak full-screen intent) · zabita apka u znajomej
            dostaje kanał powiadomień, nie proces · nagrywanie rozmowy bez zgody
            to art. 267a KK, więc tylko poziom 3 · brak odtwarzacza nagrania i
            brak limitu zgłoszeń · Android tylko. Pełna lista w README.
          </p>
        </div>
      </div>
    </div>
  </section>
);
