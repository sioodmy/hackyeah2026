import React, { useState } from "react";
import {
  ShieldCheck,
  GithubLogo,
  List,
  X,
  Sparkle,
} from "@phosphor-icons/react";

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#090a10]/80 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <a href="#hero" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#ff2a85] to-rose-600 flex items-center justify-center shadow-lg shadow-[#ff2a85]/20 group-hover:scale-105 transition-transform">
            <ShieldCheck size={20} weight="fill" className="text-white" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-lg tracking-tight text-white">
              PanicMap
            </span>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-[#ff2a85]/15 text-[#ff2a85] border border-[#ff2a85]/30">
              HackYeah 2026
            </span>
          </div>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <a
            href="#jak-to-dziala"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Jak to działa
          </a>
          <a
            href="#symulator"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
          >
            <Sparkle size={14} weight="fill" className="text-[#ff2a85]" />
            Symulator
          </a>
          <a
            href="#siostrzany-pakt"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Manifest
          </a>
          <a
            href="#heatmapa"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Heatmapa
          </a>
          <a
            href="#dla-sedziow"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Dla sędziów
          </a>
          <a
            href="#architektura"
            className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Tech Stack
          </a>
        </nav>

        {/* Desktop CTA Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://github.com/sioodmy/hackyeah2026"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <GithubLogo size={16} weight="bold" />
            <span>GitHub</span>
          </a>
          <a
            href="#symulator"
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold text-white bg-[#ff2a85] hover:bg-[#e61a72] transition-all shadow-md shadow-[#ff2a85]/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Przetestuj na żywo</span>
          </a>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none"
          aria-label="Menu"
        >
          {mobileMenuOpen ? (
            <X size={22} weight="bold" />
          ) : (
            <List size={22} weight="bold" />
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#090a10] border-b border-slate-800 px-4 pt-2 pb-6 space-y-3">
          <a
            href="#jak-to-dziala"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            Jak to działa
          </a>
          <a
            href="#symulator"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            Symulator na żywo
          </a>
          <a
            href="#siostrzany-pakt"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            Manifest bezpieczeństwa
          </a>
          <a
            href="#heatmapa"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            Heatmapa Krakowa
          </a>
          <a
            href="#dla-sedziow"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-[#ff2a85] font-semibold"
          >
            Dla sędziów HackYeah
          </a>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href="https://github.com/sioodmy/hackyeah2026"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700"
            >
              <GithubLogo size={16} weight="bold" />
              <span>Kod źródłowy GitHub</span>
            </a>
            <a
              href="#symulator"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-[#ff2a85]"
            >
              <span>Uruchom symulator</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
