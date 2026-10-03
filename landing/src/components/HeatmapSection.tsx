import React, { useState } from "react";
import { Fire, GridFour, LockKey, Compass } from "@phosphor-icons/react";

export const HeatmapSection: React.FC = () => {
  const [filterCategory, setFilterCategory] = useState<
    "all" | "stalking" | "harassment" | "lighting"
  >("all");
  const [showGridOverlay, setShowGridOverlay] = useState(true);

  // Simulated Kraków hotspots based on the backend seed data
  const hotZones = [
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

  const filteredZones = hotZones.filter((zone) => {
    if (filterCategory === "all") return true;
    return zone.type === filterCategory;
  });

  return (
    <section
      id="heatmapa"
      className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/25 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-4">
          <Fire size={14} weight="fill" />
          <span>Krakowska Heatmapa Bezpieczeństwa</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Anonimowa siatka 200 m: Miasto bezpieczne dla każdego
        </h2>
        <p className="text-slate-400 text-base leading-relaxed">
          Suwak ratuje w nagłym wypadku. Heatmapa chroni całe miasto. Zgłoszenia
          o niebezpiecznych miejscach w Krakowie są automatycznie kafelkowane do
          200-metrowych komórek PostGIS — bez żadnych danych osobowych, bez
          śledzenia ofiary.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Interactive Map Visualizer */}
        <div className="lg:col-span-8 rounded-3xl bg-[#12131c] border border-slate-800 p-6 shadow-2xl relative overflow-hidden">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800/80 mb-4">
            <div className="flex items-center gap-2">
              <Compass size={18} weight="bold" className="text-[#ff2a85]" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                Widok zrzutowany: Kraków Śródmieście
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowGridOverlay(!showGridOverlay)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${
                  showGridOverlay
                    ? "border-[#ff2a85] bg-[#ff2a85]/15 text-[#ff2a85]"
                    : "border-slate-700 bg-slate-800 text-slate-400"
                }`}
              >
                <GridFour size={14} />
                <span>
                  Siatka 200m PostGIS:{" "}
                  {showGridOverlay ? "Włączona" : "Wyłączona"}
                </span>
              </button>
            </div>
          </div>

          {/* Interactive Map Canvas (Stylized SVG Dark Kraków) */}
          <div className="relative w-full h-[420px] rounded-2xl bg-[#0c0e14] border border-slate-800/80 overflow-hidden flex items-center justify-center">
            {/* Kraków River Vistula (Wisła) */}
            <svg
              className="absolute inset-0 w-full h-full opacity-60"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d="M 0,65 Q 25,60 45,68 T 80,62 T 100,55"
                fill="none"
                stroke="#1e293b"
                strokeWidth="7"
                strokeLinecap="round"
              />
              {/* Planty Ring */}
              <circle
                cx="50"
                cy="45"
                r="16"
                fill="none"
                stroke="#162e20"
                strokeWidth="4"
              />
              {/* Major Streets */}
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

            {/* PostGIS 200m Snapped Grid Mesh */}
            {showGridOverlay && (
              <div className="absolute inset-0 bg-dot-grid opacity-30 pointer-events-none" />
            )}

            {/* Heatmap Pulsing Cells */}
            {filteredZones.map((zone) => (
              <div
                key={zone.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 group cursor-pointer"
                style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
              >
                {/* Glow ring */}
                <div
                  className={`w-14 h-14 rounded-full -translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 animate-ping opacity-25 ${
                    zone.severity === "critical"
                      ? "bg-rose-500"
                      : zone.severity === "high"
                        ? "bg-orange-500"
                        : "bg-amber-400"
                  }`}
                />

                {/* Heat cell blob */}
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs text-white shadow-xl transition-transform group-hover:scale-125 border ${
                    zone.severity === "critical"
                      ? "bg-rose-600/80 border-rose-400 shadow-rose-600/40"
                      : zone.severity === "high"
                        ? "bg-orange-600/80 border-orange-400 shadow-orange-600/40"
                        : "bg-amber-600/80 border-amber-400 shadow-amber-600/30"
                  }`}
                >
                  {zone.count}
                </div>

                {/* Hover Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-30 pointer-events-none text-left">
                  <div className="text-[11px] font-bold text-white leading-tight">
                    {zone.name}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Zgłoszeń w komórce:{" "}
                    <span className="text-white font-mono">{zone.count}</span>
                  </div>
                  <div className="text-[9px] font-mono text-emerald-400 mt-0.5">
                    ✓ Brak user_id · Grid 200m snapped
                  </div>
                </div>
              </div>
            ))}

            {/* Bottom Map Legend */}
            <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[10px] text-slate-300 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &gt;20
                incydentów
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />{" "}
                10-20
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />{" "}
                &lt;10
              </span>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
            <span className="text-xs text-slate-400 mr-2">
              Filtruj wg typu:
            </span>
            {[
              { id: "all", label: "Wszystkie zgłoszenia" },
              { id: "harassment", label: "Zaczepki i nagabywanie" },
              { id: "stalking", label: "Śledzenie / niebezpieczne zaułki" },
              { id: "lighting", label: "Brak oświetlenia / ciemne zaułki" },
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

        {/* Right Info: Privacy by Design Rules */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-6 rounded-2xl bg-[#12131c] border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-white font-bold text-base">
              <LockKey size={20} weight="fill" className="text-[#ff2a85]" />
              <span>Prywatność enforced po stronie serwera</span>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <strong className="text-white block mb-0.5">
                  1. Odczyty są zrzutowane na siatkę:
                </strong>
                Endpoint `/api/v1/incidents/heatmap` zwraca wyłącznie komórki
                ~200 m z wagami i liczbą zgłoszeń. W odpowiedzi API nie ma ani
                jednego punktu GPS ani identyfikatora użytkownika.
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <strong className="text-white block mb-0.5">
                  2. Zgłoszenia są anonimowe:
                </strong>
                Osoba śledzona na ulicy nie musi logować się ani rejestrować
                konta, by oznaczyć niebezpieczny zaułek.
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <strong className="text-white block mb-0.5">
                  3. Wagi kalkuluje serwer:
                </strong>
                Klient nie może manipulować wagą zdarzenia. Poważność wynika z
                kategorii i lokalizacji wewnątrz krakowskiego bounding-boxu.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
