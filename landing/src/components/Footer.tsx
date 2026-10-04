import React from "react";
import { ShieldCheck, GithubLogo, ArrowUp } from "@phosphor-icons/react";

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="border-t border-slate-800/80 bg-[#07080d] py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Brand */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#ff2a85] flex items-center justify-center text-white">
              <ShieldCheck size={18} weight="fill" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">
              Mokosh
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Dyskretna obrona na nocne powroty. Otwarty projekt przygotowany na
            HackYeah 2026 w Krakowie.
          </p>
        </div>

        {/*
          Bez listy sekcji: przy dwóch pozycjach wyglądałaby jak przypadkowy
          fragment, a nie jak nawigacja.
        */}

        {/* Right icons: HackYeah Logo + GitHub + Back to top */}
        <div className="flex items-center gap-3">
          <a
            href="https://hackyeah.pl"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center opacity-85 hover:opacity-100 transition-opacity mr-1"
            title="HackYeah 2026"
          >
            <img
              src="./hackyeah-logo.svg"
              alt="HackYeah 2026"
              className="h-6 w-auto object-contain"
            />
          </a>
          <a
            href="https://github.com/sioodmy/hackyeah2026"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="GitHub Repository"
          >
            <GithubLogo size={18} weight="bold" />
          </a>
          <button
            onClick={scrollToTop}
            className="p-2.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="Przewiń do góry"
          >
            <ArrowUp size={18} weight="bold" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-4 text-center">
        <div className="flex items-center gap-1.5 justify-center">
          <span>Stworzone podczas HackYeah 2026 w Krakowie</span>
        </div>
        <div>
          Open Source, bez komercyjnych trackerów i bez zbierania danych
          osobowych
        </div>
      </div>
    </footer>
  );
};
