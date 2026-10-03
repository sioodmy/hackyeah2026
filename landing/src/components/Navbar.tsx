import React, { useState } from "react";
import { ShieldCheck, GithubLogo, List, X } from "@phosphor-icons/react";

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#090a10]/90 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <a href="#hero" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-[#ff2a85] flex items-center justify-center text-white shadow-md shadow-[#ff2a85]/20">
            <ShieldCheck size={20} weight="fill" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">
            PanicMap
          </span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7">
          <a
            href="#mechanizm"
            className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Jak działa
          </a>
          <a
            href="#kamuflaz"
            className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Kamuflaż
          </a>
          <a
            href="#dlaczego"
            className="text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Dlaczego tak
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

        {/* Top Right: HackYeah Logo + GitHub */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href="https://hackyeah.pl"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center opacity-85 hover:opacity-100 transition-opacity"
            title="HackYeah 2026"
          >
            <img
              src="./hackyeah-logo.svg"
              alt="HackYeah 2026"
              className="h-7 w-auto object-contain"
            />
          </a>

          <a
            href="https://github.com/sioodmy/hackyeah2026"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors"
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
          <div className="pb-3 mb-2 border-b border-slate-800 flex items-center justify-between">
            <a
              href="https://hackyeah.pl"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <img
                src="./hackyeah-logo.svg"
                alt="HackYeah 2026"
                className="h-6 w-auto object-contain"
              />
            </a>
          </div>
          <a
            href="#mechanizm"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            Jak działa
          </a>
          <a
            href="#kamuflaz"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            Kamuflaż
          </a>
          <a
            href="#dlaczego"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            Dlaczego tak
          </a>
          <a
            href="#heatmapa"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            Heatmapa Krakowa
          </a>
          <a
            href="#zalozenia"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            Założenia
          </a>
          <a
            href="#stack"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-1.5 text-sm font-medium text-slate-300 hover:text-white"
          >
            Stack
          </a>
          <div className="pt-2">
            <a
              href="https://github.com/sioodmy/hackyeah2026"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700"
            >
              <GithubLogo size={16} weight="bold" />
              <span>Kod źródłowy na GitHubie</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
