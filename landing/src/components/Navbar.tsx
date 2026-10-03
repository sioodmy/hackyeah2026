import React, { useState } from "react";
import { ShieldCheck, GithubLogo, List, X } from "@phosphor-icons/react";

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#090a10]/85 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <a href="#hero" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#ff2a85] flex items-center justify-center text-white shadow-md shadow-[#ff2a85]/20">
            <ShieldCheck size={20} weight="fill" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-lg tracking-tight text-white">
              PanicMap
            </span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              HackYeah 2026
            </span>
          </div>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7">
          <a
            href="#mechanizm"
            className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Cztery strefy
          </a>
          <a
            href="#jak-to-dziala"
            className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Kamuflaż
          </a>
          <a
            href="#manifest"
            className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Manifest
          </a>
          <a
            href="#heatmapa"
            className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Heatmapa
          </a>
          <a
            href="#zalozenia"
            className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Założenia
          </a>
          <a
            href="#stack"
            className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Stack
          </a>
        </nav>

        {/* Desktop CTA Button */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="https://github.com/sioodmy/hackyeah2026"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors"
          >
            <GithubLogo size={15} weight="bold" />
            <span>GitHub</span>
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
            href="#mechanizm"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            Cztery strefy
          </a>
          <a
            href="#jak-to-dziala"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            Kamuflaż
          </a>
          <a
            href="#manifest"
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
            href="#zalozenia"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            Założenia
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
              href="https://github.com/sioodmy/hackyeah2026/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold text-white bg-[#ff2a85]"
            >
              <span>Pobierz APK (v0.3.0)</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
