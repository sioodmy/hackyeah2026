import React from "react";
import { ArrowDown, Sparkle, DownloadSimple } from "@phosphor-icons/react";

export const Hero: React.FC = () => {
  return (
    <section
      id="hero"
      className="relative min-h-[100dvh] flex flex-col justify-between pt-20 md:pt-24 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden"
    >
      {/* Background ambient lighting - restrained single rose accent */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[340px] bg-[#ff2a85]/15 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Main hero content container */}
      <div className="my-auto flex flex-col items-center text-center max-w-4xl mx-auto">
        {/* 1. Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/25 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-6">
          <Sparkle size={14} weight="fill" />
          <span>HackYeah 2026 · Cyberfeminist Stealth Tech</span>
        </div>

        {/* 2. Headline (Max 2 lines on desktop) */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
          Mapa, która wygląda jak mapa.{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-[#ff2a85] to-pink-400">
            Niewidzialny pancerz
          </span>{" "}
          na nocne powroty.
        </h1>

        {/* 3. Subtext (Max 20 words) */}
        <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-[65ch] mb-8 font-normal">
          Dyskretna obrona przed napaścią na ulicach Krakowa. Fałszywy telefon,
          alarm kręgu sióstr i kryptograficzne nagranie dowodowe.
        </p>

        {/* 4. CTAs (1 primary + max 1 secondary, visible without scroll) */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <a
            href="#symulator"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full text-sm font-semibold text-white bg-[#ff2a85] hover:bg-[#e61a72] transition-all shadow-lg shadow-[#ff2a85]/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkle size={18} weight="fill" />
            <span>Przetestuj symulator</span>
          </a>

          <a
            href="https://github.com/sioodmy/hackyeah2026/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full text-sm font-semibold text-slate-200 bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <DownloadSimple size={18} weight="bold" />
            <span>Pobierz APK (v0.3.0)</span>
          </a>
        </div>
      </div>

      {/* Trust & hackathon credentials strip strictly UNDER hero */}
      <div className="pt-6 border-t border-slate-800/60 mt-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <div className="text-xl md:text-2xl font-bold text-white tracking-tight">
              0 sekund
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Czas wzbudzenia podejrzeń
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <div className="text-xl md:text-2xl font-bold text-[#ff2a85] tracking-tight">
              4 strefy
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Skalowany suwak zagrożenia
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <div className="text-xl md:text-2xl font-bold text-white tracking-tight">
              SHA-256
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              30s pakiety dowodowe audio
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800/60">
            <div className="text-xl md:text-2xl font-bold text-white tracking-tight">
              200 m
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Anonimowa siatka PostGIS
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center pt-4">
          <a
            href="#jak-to-dziala"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <span>Poznaj mechanizm działania</span>
            <ArrowDown size={14} className="animate-bounce" />
          </a>
        </div>
      </div>
    </section>
  );
};
