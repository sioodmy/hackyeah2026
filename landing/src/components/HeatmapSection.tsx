import React, { useState } from "react";
import { LockKey, Compass, GridFour } from "@phosphor-icons/react";

interface Hotspot {
  id: number;
  name: string;
  x: number;
  y: number;
  count: number;
  type: "harassment" | "stalking" | "lighting";
  severity: "critical" | "high" | "medium";
}

const hotZones: Hotspot[] = [
  {
    id: 1,
    name: "Planty Krakowskie (odc. Dworzec Główny)",
    x: 62,
    y: 35,
    count: 18,
    severity: "high",
    type: "lighting",
  },
  {
    id: 2,
    name: "ul. Floriańska / Pijarska",
    x: 50,
    y: 42,
    count: 24,
    severity: "critical",
    type: "harassment",
  },
  {
    id: 3,
    name: "Rondo Mogilskie (przejście podziemne)",
    x: 78,
    y: 48,
    count: 14,
    severity: "medium",
    type: "stalking",
  },
  {
    id: 4,
    name: "Kazimierz (ul. Szeroka / Miodowa)",
    x: 54,
    y: 72,
    count: 21,
    severity: "high",
    type: "harassment",
  },
  {
    id: 5,
    name: "Krowodrza Górka (park)",
    x: 32,
    y: 25,
    count: 9,
    severity: "medium",
    type: "lighting",
  },
  {
    id: 6,
    name: "Bulwary Wiślane (pod Wawelem)",
    x: 42,
    y: 64,
    count: 16,
    severity: "high",
    type: "stalking",
  },
];

export const HeatmapSection: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState<
    "all" | "stalking" | "harassment" | "lighting"
  >("all");
  const [showGridOverlay, setShowGridOverlay] = useState(true);

  const filteredZones = hotZones.filter((zone) => {
    if (filterCategory === "all") return true;
    return zone.type === filterCategory;
  });

  return (
    <section
      id="heatmapa"
      className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80"
    >
      {/* Header */}
      <div className="max-w-3xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/20 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-4">
          Anonimowa Analityka Zagrożeń
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Map Canvas */}
        <div className="lg:col-span-8 rounded-3xl bg-[#10111a] border border-slate-800 p-6 shadow-xl relative overflow-hidden">
          {/* Header controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80 mb-4">
            <div className="flex items-center gap-2">
              <Compass size={18} weight="bold" className="text-[#ff2a85]" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                Kraków Śródmieście: Siatka PostGIS
              </span>
            </div>

            <button
              onClick={() => setShowGridOverlay(!showGridOverlay)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                showGridOverlay
                  ? "border-[#ff2a85]/60 bg-[#ff2a85]/10 text-[#ff2a85]"
                  : "border-slate-700 bg-slate-800 text-slate-400"
              }`}
            >
              <GridFour size={14} />
              <span>
                Siatka 200m: {showGridOverlay ? "Widoczna" : "Ukryta"}
              </span>
            </button>
          </div>

          {/* Map canvas */}
          <div className="relative w-full h-[400px] rounded-2xl bg-[#090b10] border border-slate-800/80 overflow-hidden flex items-center justify-center">
            {/* SVG Kraków river and outline */}
            <svg
              className="absolute inset-0 w-full h-full opacity-50"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d="M 0,65 Q 25,60 45,68 T 80,62 T 100,55"
                fill="none"
                stroke="#1e293b"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <circle
                cx="50"
                cy="45"
                r="16"
                fill="none"
                stroke="#1c2d24"
                strokeWidth="4"
              />
              <line
                x1="50"
                y1="0"
                x2="50"
                y2="45"
                stroke="#1e293b"
                strokeWidth="1.5"
              />
              <line
                x1="50"
                y1="45"
                x2="80"
                y2="48"
                stroke="#1e293b"
                strokeWidth="1.5"
              />
              <line
                x1="50"
                y1="45"
                x2="54"
                y2="72"
                stroke="#1e293b"
                strokeWidth="1.5"
              />
            </svg>

            {/* Grid Mesh */}
            {showGridOverlay && (
              <div className="absolute inset-0 bg-dot-grid opacity-25 pointer-events-none" />
            )}

            {/* Snapped 200m Grid Cells */}
            {filteredZones.map((zone) => (
              <div
                key={zone.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs text-white transition-transform group-hover:scale-110 border ${
                    zone.severity === "critical"
                      ? "bg-rose-950/80 border-rose-500/80 text-rose-200"
                      : zone.severity === "high"
                        ? "bg-orange-950/80 border-orange-500/80 text-orange-200"
                        : "bg-amber-950/80 border-amber-500/80 text-amber-200"
                  }`}
                >
                  {zone.count}
                </div>

                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-30 pointer-events-none text-left">
                  <div className="text-xs font-bold text-white leading-tight">
                    {zone.name}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Liczba incydentów w komórce:{" "}
                    <span className="text-white font-mono">{zone.count}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-1">
                    Waga obliczona przez serwer
                  </div>
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 bg-slate-950/90 px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-slate-400 flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-rose-500/80" />{" "}
                &gt;20 incydentów
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-orange-500/80" />{" "}
                10-20
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-md bg-amber-500/80" />{" "}
                &lt;10
              </span>
            </div>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
            <span className="text-xs text-slate-400 mr-2">Kategoria:</span>
            {[
              { id: "all", label: "Wszystkie" },
              { id: "harassment", label: "Zaczepki i nagabywanie" },
              { id: "stalking", label: "Śledzenie" },
              { id: "lighting", label: "Brak oświetlenia" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id as any)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  filterCategory === cat.id
                    ? "bg-[#ff2a85] text-white font-semibold"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Info: Privacy Enforcement */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-[#10111a] border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <LockKey size={20} weight="fill" className="text-[#ff2a85]" />
            <span>Prywatność wymuszona przez backend</span>
          </div>

          <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
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
              Osoba śledzona na ulicy nie musi logować się ani zakładać konta,
              by oznaczyć niebezpieczny zaułek (
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
      </div>
    </section>
  );
};
