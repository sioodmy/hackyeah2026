import React from "react";
import { ShieldCheck, Heart, GithubLogo, ArrowUp } from "@phosphor-icons/react";

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="border-t border-slate-800/80 bg-[#07080d] py-12 px-4 sm:px-6 lg:px-8 mt-20">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        {/* Brand & Mission */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#ff2a85] flex items-center justify-center text-white">
              <ShieldCheck size={18} weight="fill" />
            </div>
            <span className="font-bold text-lg text-white tracking-tight">
              PanicMap
            </span>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              HackYeah 2026
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            Niewidzialny pancerz na nocne powroty. Otwarta technologia
            solidarności, stworzona z myślą o bezpieczeństwie dziewczyn i
            każdego na ulicach polskich miast.
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-400 font-medium">
          <a href="#mechanizm" className="hover:text-white transition-colors">
            Cztery strefy
          </a>
          <a
            href="#jak-to-dziala"
            className="hover:text-white transition-colors"
          >
            Kamuflaż
          </a>
          <a href="#manifest" className="hover:text-white transition-colors">
            Manifest
          </a>
          <a href="#heatmapa" className="hover:text-white transition-colors">
            Heatmapa
          </a>
          <a href="#zalozenia" className="hover:text-white transition-colors">
            Założenia
          </a>
          <a href="#stack" className="hover:text-white transition-colors">
            Stack
          </a>
        </div>

        {/* Back to Top & GitHub Link */}
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/sioodmy/hackyeah2026"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="GitHub Repository"
          >
            <GithubLogo size={20} weight="bold" />
          </a>
          <button
            onClick={scrollToTop}
            className="p-2.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            title="Przewiń do góry"
          >
            <ArrowUp size={20} weight="bold" />
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-4 text-center">
        <div className="flex items-center gap-1.5 justify-center">
          <span>Stworzone z</span>
          <Heart size={14} weight="fill" className="text-[#ff2a85]" />
          <span>podczas HackYeah 2026 w Krakowie</span>
        </div>
        <div>
          Open Source · Licencja wolnego oprogramowania · Zero trackerów
          reklamowych
        </div>
      </div>
    </footer>
  );
};
