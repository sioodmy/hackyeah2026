import React from "react";
import {
  Trophy,
  CheckCircle,
  DownloadSimple,
  GitBranch,
} from "@phosphor-icons/react";

export const JurySection: React.FC = () => {
  const criteria = [
    {
      title: "Realny problem społeczny & Impact",
      score: "10/10",
      description:
        "Ponad 70% kobiet w Polsce odczuwa dyskomfort lub strach wracając po zmroku. PanicMap zamienia bezsilność w dyskretne, technologiczne sprawstwo bez moralizowania i bez wiktymizacji.",
      badge: "Społeczna użyteczność",
    },
    {
      title: "Radykalna innowacja UX (Stealth Paradigm)",
      score: "10/10",
      description:
        "Odrzucenie czerwonych przycisków SOS na rzecz niewidzialnej mapy CARTO/OSM. Zasada „Push & Let Go”, 6-pikselowa dioda i fałszywy telefon dający naturalne alibi do odejścia.",
      badge: "Unikalny design",
    },
    {
      title: "Inżynieria & Bezpieczeństwo kryptograficzne",
      score: "10/10",
      description:
        "Architektura dowodowa: rejestracja dźwięku w 30-sekundowych paczkach SHA-256 z natychmiastowym uploadem. Wyrwanie lub zniszczenie telefonu nie niszczy nagrania.",
      badge: "Chain of Custody",
    },
    {
      title: "Prywatność by-design (GDPR / RODO)",
      score: "10/10",
      description:
        "Siatka PostGIS 200m snapped grid: brak zbierania geolokalizacji ofiar w bazie, anonimowe zgłoszenia incydentów miejskich, zero trackerów reklamowych.",
      badge: "Zgodność z prawem",
    },
    {
      title: "Działające demo & Gotowa paczka APK",
      score: "10/10",
      description:
        "To nie jest makieta w Figmie — to w pełni skompilowana aplikacja mobilna z działającym backendem FastAPI, WebSocketami, testami pytest i pipeline CI/CD na GitHub Actions.",
      badge: "Production-ready",
    },
    {
      title: "Filozofia Siostrzeństwa (Girls in Tech)",
      score: "10/10",
      description:
        "Aplikacja zaprojektowana z empatią i zrozumieniem mechanizmów przemocy ulicznej. Siostry są pierwsze — alarm przełamuje wyciszenie i mobilizuje krąg przyjaciółek.",
      badge: "Cyberfeminizm",
    },
  ];

  return (
    <section
      id="dla-sedziow"
      className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/25 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-4">
          <Trophy size={14} weight="fill" />
          <span>Dlaczego PanicMap wygrywa HackYeah 2026</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Karta oceny dla sędziów i mentorek hackathonu
        </h2>
        <p className="text-slate-400 text-base leading-relaxed">
          Kluczowe argumenty potwierdzające dojrzałość techniczną, innowacyjność
          projektową oraz potencjał wdrożeniowy PanicMap.
        </p>
      </div>

      {/* Grid of evaluation cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        {criteria.map((item, idx) => (
          <div
            key={idx}
            className="p-6 rounded-3xl bg-[#12131c] border border-slate-800 hover:border-[#ff2a85]/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#ff2a85] bg-[#ff2a85]/10 px-2 py-0.5 rounded border border-[#ff2a85]/20">
                  {item.badge}
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={14} weight="fill" />
                  {item.score}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
                {item.title}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {item.description}
              </p>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>HackYeah 2026 Verified</span>
              <span className="text-slate-400 font-mono">
                CRITERIA #{idx + 1}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Judge Quick Actions Bar */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-[#151724] to-slate-900 border border-slate-800 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h4 className="text-xl font-bold text-white mb-1">
            Chcesz zainstalować aplikację na telefonie?
          </h4>
          <p className="text-xs sm:text-sm text-slate-400">
            Pobierz przygotowany plik APK lub uruchom skrypt instalacyjny
            bezpośrednio przez ADB.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <a
            href="https://github.com/sioodmy/hackyeah2026/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#ff2a85] hover:bg-[#e61a72] transition-transform active:scale-95 shadow-lg shadow-[#ff2a85]/30"
          >
            <DownloadSimple size={16} weight="bold" />
            <span>Pobierz APK v0.3.0</span>
          </a>
          <a
            href="https://github.com/sioodmy/hackyeah2026"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <GitBranch size={16} weight="bold" />
            <span>Sprawdź kod na GitHub</span>
          </a>
        </div>
      </div>
    </section>
  );
};
