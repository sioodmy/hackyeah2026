import React from "react";
import { Database, DeviceMobile, TerminalWindow } from "@phosphor-icons/react";

export const ArchitectureSection: React.FC = () => {
  return (
    <section
      id="stack"
      className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80"
    >
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/20 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-4">
          Stack Technologiczny
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Stack technologiczny i architektura
        </h2>
        <p className="text-slate-400 text-base leading-relaxed">
          Natywne shadery rastrowe w MapLibre, PostGIS z siatką kafelkową i
          strumieniowanie pozycji przez WebSockets. Cały stos został
          zoptymalizowany pod niezawodność i natychmiastowy czas reakcji.
        </p>
      </div>

      {/* 3 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* Mobile Pillar */}
        <div className="rounded-3xl bg-[#10111a] border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center mb-4">
              <DeviceMobile size={22} weight="bold" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Aplikacja Mobilna (Client)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Klient w React Native i Expo, zoptymalizowany pod minimalne
              zużycie baterii i płynne rysowanie kafelków mapy.
            </p>
            <ul className="space-y-2 text-xs text-slate-300 font-mono">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                React Native 0.85 + Expo 56
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                MapLibre Native (desaturacja CARTO)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                Expo Audio (pakiety 30s SHA-256)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                Expo Notifications (bypassDnd)
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
            app/src/**/*.{"{ts,tsx}"}
          </div>
        </div>

        {/* Backend Pillar */}
        <div className="rounded-3xl bg-[#10111a] border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-[#ff2a85]/15 text-[#ff2a85] flex items-center justify-center mb-4">
              <Database size={22} weight="bold" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Backend i Silnik PostGIS
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Asynchroniczne API w FastAPI z WebSocketami dla pozycji na żywo
              oraz silnikiem agregującym zgłoszenia na siatce przestrzennej.
            </p>
            <ul className="space-y-2 text-xs text-slate-300 font-mono">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff2a85]" />
                FastAPI + Python 3.12 (uv)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff2a85]" />
                WebSockets (/ws/locations)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff2a85]" />
                PostgreSQL 16 + PostGIS
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff2a85]" />
                Weryfikacja SHA-256 segmentów audio
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
            backend/src/hy/**/*.{"{py}"}
          </div>
        </div>

        {/* DevOps Pillar */}
        <div className="rounded-3xl bg-[#10111a] border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-4">
              <TerminalWindow size={22} weight="bold" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              DevOps i Środowisko
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Powtarzalne środowisko developerskie dzięki Nix Flakes oraz
              pipeline testów i budowania APK.
            </p>
            <ul className="space-y-2 text-xs text-slate-300 font-mono">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Nix Flakes (flake.nix)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Justfile (just api, just app)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Treefmt (Ruff + Prettier)
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                GitHub Actions CI/CD + Pages
              </li>
            </ul>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 font-mono">
            .github/workflows/*.yml
          </div>
        </div>
      </div>

      {/* Terminal Snippet */}
      <div className="rounded-2xl bg-[#090b10] border border-slate-800 p-5 font-mono text-xs overflow-x-auto shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3 text-slate-500 text-[11px]">
          <span>Terminal: Uruchomienie lokalne</span>
          <span>bash</span>
        </div>
        <pre className="text-slate-300 space-y-1">
          <div>
            <span className="text-[#ff2a85]">$</span> git clone
            https://github.com/sioodmy/hackyeah2026.git
          </div>
          <div>
            <span className="text-[#ff2a85]">$</span> cd hackyeah2026
          </div>
          <div>
            <span className="text-[#ff2a85]">$</span> just setup{" "}
            <span className="text-slate-500">
              # Instalacja zależności Python i JS
            </span>
          </div>
          <div>
            <span className="text-[#ff2a85]">$</span> just db-up{" "}
            <span className="text-slate-500">
              # Start bazy PostgreSQL z PostGIS
            </span>
          </div>
          <div>
            <span className="text-[#ff2a85]">$</span> just api{" "}
            <span className="text-slate-500">
              # Start backendu FastAPI na :8000
            </span>
          </div>
          <div>
            <span className="text-[#ff2a85]">$</span> just app{" "}
            <span className="text-slate-500">
              # Start Expo dla aplikacji mobilnej
            </span>
          </div>
        </pre>
      </div>
    </section>
  );
};
