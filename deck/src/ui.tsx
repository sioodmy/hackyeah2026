import React from "react";

/**
 * Wspólne elementy slajdów.
 *
 * Slajd ma stały rozmiar 1280×720 (patrz `deck.css`), więc każdy element
 * układa się w siatce wewnątrz `.slide-inner` i nie musi znać swojej
 * szerokości — dzięki temu slajd jest tak samo wyglądający w przeglądarce
 * i w wyeksportowanym PDF-ie.
 */

/** Slajd pełnoekranowy: nagłówek, treść, stopka z numerem. */
export const Slide: React.FC<{
  index: number;
  total: number;
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  children: React.ReactNode;
  /** Poświata w tle — różny odcień na każdym slajdzie, żeby kolejne kadry
   *  nie wyglądały jak jeden przewijany ekran. */
  glow?: string;
  /** Slajdy z telefonem mają ciało luźniejsze — nagłówek w jednej kolumnie,
   *  telefon w drugiej. */
  bodyClass?: string;
}> = ({ index, total, eyebrow, title, lead, children, glow, bodyClass }) => (
  <section className="slide" data-slide={index}>
    <div
      className="slide-glow"
      style={
        {
          "--glow": glow,
          width: 640,
          height: 340,
          top: -140,
          right: -120,
        } as React.CSSProperties
      }
      aria-hidden
    />
    <div className="slide-inner">
      <header className="shrink-0">
        <div className="mb-3.5">
          <span className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[#ff2a85]">
            {eyebrow}
          </span>
        </div>
        <h2 className="text-[36px] leading-[1.08] font-extrabold tracking-tight text-white">
          {title}
        </h2>
        {lead ? (
          <p className="mt-3 text-[14px] leading-relaxed text-slate-400 max-w-[78ch]">
            {lead}
          </p>
        ) : null}
      </header>

      <div className={`flex-1 min-h-0 mt-8 ${bodyClass ?? ""}`}>{children}</div>

      <footer className="shrink-0 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.16em] text-slate-600 pt-3.5 mt-6 border-t border-white/[0.06]">
        <span>Mokosh · HackYeah 2026</span>
        <span className="tabular-nums">
          {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </footer>
    </div>
  </section>
);

/** Karta w kolorze landingu (`#10111a` + hairline). */
export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  accent?: string;
}> = ({ children, className = "", accent }) => (
  <div
    className={`relative rounded-2xl bg-[#10111a] border border-white/[0.07] p-6 overflow-hidden ${className}`}
    style={accent ? { borderColor: `${accent}33` } : undefined}
  >
    {accent ? (
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />
    ) : null}
    {children}
  </div>
);

/** Punkt listy z kropką w kolorze akcentu. */
export const Bullet: React.FC<{
  children: React.ReactNode;
  color?: string;
  className?: string;
}> = ({ children, color = "#ff2a85", className = "" }) => (
  <li
    className={`relative pl-5 text-[13.5px] leading-[1.55] text-slate-300 ${className}`}
  >
    <span
      className="absolute left-0 top-[7px] w-[5px] h-[5px] rounded-full"
      style={{ background: color, boxShadow: `0 0 8px ${color}` }}
    />
    {children}
  </li>
);

/** Nagłówek karty: ikona w kafelku + nadtytuł mono + tytuł. */
export const CardHead: React.FC<{
  icon?: React.ReactNode;
  kicker: string;
  title: string;
  kickerColor?: string;
}> = ({ icon, kicker, title, kickerColor = "#ff2a85" }) => (
  <div className="flex items-start gap-3.5 mb-3.5">
    {icon ? (
      <div
        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
        style={{
          background: `${kickerColor}1f`,
          border: `1px solid ${kickerColor}3d`,
          color: kickerColor,
        }}
      >
        {icon}
      </div>
    ) : null}
    <div className="min-w-0">
      <div
        className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] mb-1"
        style={{ color: kickerColor }}
      >
        {kicker}
      </div>
      <h3 className="text-[16px] font-bold leading-snug text-white">{title}</h3>
    </div>
  </div>
);

/** Dwuznakowy licznik w stylu landingu (1 / 2 / 3). */
export const Step: React.FC<{ n: number; label: string; color?: string }> = ({
  n,
  label,
  color = "#ff2a85",
}) => (
  <div className="flex items-center gap-3">
    <span
      className="w-7 h-7 rounded-lg grid place-items-center font-mono text-[12px] font-bold shrink-0"
      style={{
        background: `${color}1f`,
        border: `1px solid ${color}45`,
        color,
      }}
    >
      {n}
    </span>
    <span className="text-[12.5px] text-slate-300">{label}</span>
  </div>
);

/** Monospace'owy akcent techniczny (konfiguracja, snippet). */
export const Mono: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <code
    className={`font-mono text-[11.5px] px-1.5 py-0.5 rounded-md bg-white/[0.07] text-slate-200 ${className}`}
  >
    {children}
  </code>
);

/** Znaczek poziomu zagrożenia — ten sam kolor co wypełnienie suwaka w telefonie. */
export const LevelDot: React.FC<{ color: string; pulse?: boolean }> = ({
  color,
  pulse,
}) => (
  <span className="relative flex items-center justify-center w-3 h-3 shrink-0">
    {pulse ? (
      <span
        className="absolute inset-0 rounded-full"
        style={{ background: color, opacity: 0.35, filter: "blur(3px)" }}
      />
    ) : null}
    <span
      className="relative w-2.5 h-2.5 rounded-full"
      style={{ background: color, boxShadow: `0 0 12px ${color}` }}
    />
  </span>
);
