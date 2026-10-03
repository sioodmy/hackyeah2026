import React from "react";
import { LockKey } from "@phosphor-icons/react";

export const HeatmapSection: React.FC = () => {
  return (
    <section
      id="heatmapa"
      className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80"
    >
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center mb-16">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Krakowska heatmapa bezpieczeństwa
        </h2>
        <p className="text-slate-400 text-base leading-relaxed">
          Podczas gdy suwak odpowiada za bezpośrednie wsparcie użytkowniczki,
          heatmapa agreguje zgłoszenia agresji i niebezpiecznych miejsc w
          Krakowie. Dane są zrzutowane na komórki około 200 m w bazie PostGIS,
          gwarantując pełną anonimowość zgłaszających.
        </p>
      </div>

      {/* Privacy Enforcement */}
      <div className="max-w-4xl mx-auto p-6 sm:p-10 rounded-3xl bg-[#10111a] border border-slate-800 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <LockKey size={20} weight="fill" className="text-[#ff2a85]" />
          <span>Prywatność wymuszona przez backend</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-300 leading-relaxed">
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <strong className="text-white block mb-1">
              1. Odczyty zrzutowane na siatkę:
            </strong>
            Endpoint{" "}
            <code className="text-[#ff2a85]">
              GET /api/v1/incidents/heatmap
            </code>{" "}
            zwraca wyłącznie komórki ~200 m z zagregowaną liczbą zdarzeń. W
            odpowiedzi API nie ma ani jednego dokładnego punktu GPS ani
            identyfikatora użytkowniczki.
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <strong className="text-white block mb-1">
              2. W pełni anonimowe zgłoszenia:
            </strong>
            Osoba śledzona na ulicy nie musi logować się ani zakładać konta, by
            oznaczyć niebezpieczny zaułek (
            <code className="text-slate-400">POST /api/v1/incidents</code>).
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <strong className="text-white block mb-1">
              3. Wagi wyliczane po stronie serwera:
            </strong>
            Aplikacja klienta nie może manipulować wagą zdarzenia. Poważność
            wynika z kategorii i lokalizacji wewnątrz krakowskiego
            bounding-boxu.
          </div>
        </div>
      </div>
    </section>
  );
};
