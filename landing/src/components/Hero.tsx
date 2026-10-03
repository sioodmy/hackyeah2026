import React from "react";
import { ArrowDown, DownloadSimple, ArrowRight } from "@phosphor-icons/react";

export const Hero: React.FC = () => {
  return (
    <section
      id="hero"
      className="relative min-h-[100dvh] flex flex-col justify-between pt-24 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden"
    >
      {/* Background ambient lighting - restrained single rose accent */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[320px] bg-[#ff2a85]/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      {/* Main hero content container */}
      <div className="my-auto flex flex-col items-center text-center max-w-4xl mx-auto">
        {/* 1. Eyebrow */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[#ff2a85] text-xs font-mono uppercase tracking-wider mb-6">
          HackYeah 2026 · Cyberfeminist Stealth Tech
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
        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
          <a
            href="#mechanizm"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-white bg-[#ff2a85] hover:bg-[#e61a72] transition-colors shadow-md shadow-[#ff2a85]/25"
          >
            <span>Poznaj mechanizm działania</span>
            <ArrowRight size={16} weight="bold" />
          </a>

          <a
            href="https://github.com/sioodmy/hackyeah2026/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 transition-colors"
          >
            <DownloadSimple size={16} weight="bold" />
            <span>Pobierz APK (v0.3.0)</span>
          </a>
        </div>
      </div>

      {/* Trust & specifications strip strictly UNDER hero */}
      <div className="pt-8 border-t border-slate-800/80 mt-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="p-3.5 rounded-2xl bg-[#10111a] border border-slate-800">
            <div className="text-xl font-bold text-white tracking-tight">
              0 sekund
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Czas wzbudzenia podejrzeń
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#10111a] border border-slate-800">
            <div className="text-xl font-bold text-[#ff2a85] tracking-tight">
              4 strefy
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Skalowany suwak zagrożenia
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#10111a] border border-slate-800">
            <div className="text-xl font-bold text-white tracking-tight">
              SHA-256
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              30s pakiety dowodowe audio
            </div>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#10111a] border border-slate-800">
            <div className="text-xl font-bold text-white tracking-tight">
              200 m
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Anonimowa siatka PostGIS
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center pt-5">
          <a
            href="#mechanizm"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <span>Przejdź do specyfikacji stref</span>
            <ArrowDown size={13} />
          </a>
        </div>
      </div>
    </section>
  );
};
