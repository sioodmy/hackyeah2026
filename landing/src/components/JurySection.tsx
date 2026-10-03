import React from "react";
import { DownloadSimple, GitBranch } from "@phosphor-icons/react";

interface Criterion {
  title: string;
  category: string;
  description: string;
}

const criteria: Criterion[] = [
  {
    category: "Walor Społeczny",
    title: "Realny problem bezpieczeństwa nocnego",
    description:
      "Większość kobiet w polskich miastach doświadcza niepokoju lub zaczepiania podczas nocnych powrotów. PanicMap przekłada poczucie bezradności na sprawczość technologiczną bez moralizowania i bez wiktymizacji.",
  },
  {
    category: "UX & Psychologia",
    title: "Kamuflaż zamiast czerwonych przycisków SOS",
    description:
      "Agresor nie może zorientować się, że wzywasz pomoc. Odbarwiona mapa rastrowa CARTO/OSM, 6-pikselowa subtelna dioda i fałszywy telefon dają bezpieczną przestrzeń do odejścia.",
  },
  {
    category: "Kryptografia",
    title: "Łańcuch dowodowy audio (SHA-256 Chunks)",
    description:
      "Nagrywanie w 30-sekundowych segmentach z natychmiastowym uploadem i weryfikacją skrótów SHA-256 po stronie backendu. Zniszczenie telefonu przez sprawcę nie niszczy zabezpieczonego materiału dowodowego.",
  },
  {
    category: "Prywatność & Prawo",
    title: "Siatka PostGIS 200m zrzutowana na serwerze",
    description:
      "Endpointy heatmapy zwracają zagregowane wagi w komórkach 200 m bez współrzędnych punktowych i bez identyfikatorów user_id. Zgłaszanie incydentów jest w pełni anonimowe.",
  },
  {
    category: "Inżynieria",
    title: "Działający, przetestowany stos technologiczny",
    description:
      "Projekt to nie makieta, lecz w pełni skompilowana aplikacja React Native / Expo z backendem FastAPI, obsługą WebSocketów, bazą PostgreSQL/PostGIS, zestawem testów pytest i pipeline CI/CD na GitHub Actions.",
  },
  {
    category: "Ergonomia Stresu",
    title: "Mechanizm „Push & Let Go”",
    description:
      "W stresie precyzja motoryczna spada. Suwak wymaga przesunięcia i puszczenia — palec trzymany na ekranie nie wywołuje akcji, co całkowicie eliminuje fałszywe alarmy z torebki lub kieszeni.",
  },
];

export const JurySection: React.FC = () => {
  return (
    <section
      id="dla-sedziow"
      className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80"
    >
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/20 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-4">
          Dla Sędziów i Mentorek Hackathonu
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Kluczowe filary oceny projektu PanicMap
        </h2>
        <p className="text-slate-400 text-base leading-relaxed">
          Zestawienie merytorycznych założeń technicznych, projektowych i
          społecznych przygotowane pod kątem kryteriów HackYeah 2026.
        </p>
      </div>

      {/* Grid of evaluation cards without fake scores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {criteria.map((item, idx) => (
          <div
            key={idx}
            className="p-6 rounded-2xl bg-[#10111a] border border-slate-800 hover:border-slate-700 transition-colors flex flex-col justify-between"
          >
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#ff2a85] font-semibold mb-2">
                {item.category}
              </div>
              <h3 className="text-lg font-bold text-white mb-2.5 tracking-tight">
                {item.title}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {item.description}
              </p>
            </div>
            <div className="pt-4 mt-6 border-t border-slate-800/80 text-[11px] font-mono text-slate-500">
              Filar #{idx + 1}
            </div>
          </div>
        ))}
      </div>

      {/* Jury Quick Actions Bar */}
      <div className="rounded-3xl bg-[#10111a] border border-slate-800 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h4 className="text-xl font-bold text-white mb-1">
            Dostęp do aplikacji i kodu źródłowego
          </h4>
          <p className="text-xs sm:text-sm text-slate-400">
            Aplikację można zainstalować bezpośrednio z pliku APK lub uruchomić
            lokalnie przez dołączony justfile.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <a
            href="https://github.com/sioodmy/hackyeah2026/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#ff2a85] hover:bg-[#e61a72] transition-colors shadow-md"
          >
            <DownloadSimple size={16} weight="bold" />
            <span>Pobierz APK (v0.3.0)</span>
          </a>
          <a
            href="https://github.com/sioodmy/hackyeah2026"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <GitBranch size={16} weight="bold" />
            <span>Repozytorium GitHub</span>
          </a>
        </div>
      </div>
    </section>
  );
};
