import React from "react";
import { ArrowDown, DownloadSimple, ArrowRight } from "@phosphor-icons/react";

export const Hero: React.FC = () => {
  return (
    <section
      id="hero"
      className="relative min-h-[100dvh] flex flex-col justify-between pt-24 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[320px] bg-[#ff2a85]/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      {/* Main hero content container */}
      <div className="my-auto flex flex-col items-center text-center max-w-4xl mx-auto">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.1] mb-6">
          Każda z nas zasługuje na{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-[#ff2a85] to-pink-400">
            bezpieczeństwo
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-[65ch] mb-8 font-normal">
          Od unikania niekomfortowych interakcji z creepami po wczesne
          zawiadamianie o niebezpieczeństwie bliskich i służby. W zależności od
          poziomu zagrożenia, na bierząco w czasie rzeczywistym
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
          <a
            href="#demo"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-xs sm:text-sm font-semibold text-white bg-[#ff2a85] hover:bg-[#e61a72] transition-colors shadow-md shadow-[#ff2a85]/25"
          >
            <span>Zobacz jak działa</span>
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

      {/* Specifications strip */}
      <div className="pt-8 border-t border-slate-800/80 mt-auto">
        <div className="flex items-center justify-center">
          <a
            href="#demo"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <span>Poznaj mechanizm czterech stref</span>
            <ArrowDown size={13} />
          </a>
        </div>
      </div>
    </section>
  );
};
