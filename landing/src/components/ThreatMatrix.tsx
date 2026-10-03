import React, { useState } from "react";

interface ZoneDetail {
  zone: number;
  name: string;
  badge: string;
  colorClass: string;
  accentBorder: string;
  phonePerspective: string;
  networkPerspective: string;
  technicalDetails: string[];
}

const zones: ZoneDetail[] = [
  {
    zone: 0,
    name: "Spoczynek",
    badge: "Stan domyślny",
    colorClass: "text-slate-400 bg-slate-800/80 border-slate-700",
    accentBorder: "border-slate-800 hover:border-slate-700",
    phonePerspective:
      "Cicha, odbarwiona mapa uliczna OpenStreetMap (raster-saturation: 0). Brak jakichkolwiek elementów sugerujących aplikację ratunkową. W rogu ekranu znajduje się 6-pikselowy punkt o znikomym kryciu.",
    networkPerspective:
      "Telefony osób w kręgu zaufania milczą. Brak powiadomień w tle, brak zbędnego drenażu baterii.",
    technicalDetails: [
      "Stan spoczynkowy, do którego aplikacja wraca po odwołaniu alertu",
      "Desaturacja rastra na poziomie GPU zapobiega przyciąganiu wzroku z dystansu",
    ],
  },
  {
    zone: 1,
    name: "Pretekst",
    badge: "Fałszywy telefon",
    colorClass: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    accentBorder: "border-amber-500/30 hover:border-amber-500/50",
    phonePerspective:
      "Po 10 sekundach od puszczenia suwaka telefon wyzwala realistyczny przychodzący telefon (nazwa kontaktu: „Mama” / zaufana osoba). Cichy dzwonek, wibracja. Odebranie odtwarza 30-sekundową ambientową rozmowę tła.",
    networkPerspective:
      "Przyjaciółki otrzymują ciche powiadomienie systemowe (OS-level heads-up): Kasia uruchomiła pretekst wyjścia. Ekran ich telefonów nie zostaje zablokowany.",
    technicalDetails: [
      "10-sekundowy bufor bezpieczeństwa na ewentualne cofnięcie",
      "Dźwięk odtwarzany na volume 0.15 z uwagi na specyfikę routing audio w urządzeniu",
    ],
  },
  {
    zone: 2,
    name: "Krąg Sióstr",
    badge: "Priorytetowe połączenie",
    colorClass: "text-orange-300 bg-orange-500/10 border-orange-500/30",
    accentBorder: "border-orange-500/30 hover:border-orange-500/50",
    phonePerspective:
      "Wszystkie akcje poziomu 1, plus natychmiastowe uruchomienie transmisji bieżącej pozycji GPS przez kanał WebSocket do uprawnionych odbiorców.",
    networkPerspective:
      "Na telefonach w kręgu pojawia się pełnoekranowe wywołanie z dedykowanym przyciskiem „Odbierz”. Odebranie natychmiast łączy głosowo i zwraca u Ciebie status: Kasia rozmawia.",
    technicalDetails: [
      "Niskolatencyjny strumień współrzędnych (/ws/locations)",
      "Przyjaciółka widzi przemieszczający się punkt na swojej mapie w czasie rzeczywistym",
    ],
  },
  {
    zone: 3,
    name: "Alarm Krytyczny",
    badge: "112 & Rejestracja dowodowa",
    colorClass: "text-rose-300 bg-rose-500/10 border-rose-500/30",
    accentBorder: "border-rose-500/40 hover:border-rose-500/60",
    phonePerspective:
      "Niewidoczna rejestracja audio w 30-sekundowych segmentach SHA-256 wysyłanych natychmiast po zamknięciu paczki. Równolegle wyzwalany mock dyspozytora 112 zwracający numer zgłoszenia.",
    networkPerspective:
      "U wszystkich osób w kręgu rozlega się zapętlona syrena na maksymalnym poziomie głośności, przełamująca tryb cichy (bypassDnd). Dźwięk milknie wyłącznie po naciśnięciu „Idę do niej”.",
    technicalDetails: [
      "Pakiety audio zabezpieczone kryptograficznie (ciągłość, stemple czasowe, współrzędne)",
      "Zniszczenie lub odebranie telefonu powoduje utratę maksymalnie ułamka ostatniego segmentu",
    ],
  },
];

export const ThreatMatrix: React.FC = () => {
  const [selectedZone, setSelectedZone] = useState<number>(1);

  return (
    <section
      id="mechanizm"
      className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80"
    >
      {/* Section Header */}
      <div className="max-w-3xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/20 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-4">
          Architektura Suwaka Zagrożenia
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Cztery strefy. Dwie strony każdego alertu.
        </h2>
        <p className="text-slate-400 text-base leading-relaxed">
          Suwak operuje na zasadzie <em>Push &amp; Let Go</em>: akcja zostaje
          zatwierdzona dopiero po oderwaniu kciuka, eliminując przypadkowe
          dotknięcia w kieszeni. Każdy poziom precyzyjnie dzieli obowiązki
          między kamuflaż a reakcję sieci wsparcia.
        </p>
      </div>

      {/* Zone Tabs for Quick Navigation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-10 max-w-4xl mx-auto">
        {zones.map((z) => (
          <button
            key={z.zone}
            onClick={() => setSelectedZone(z.zone)}
            className={`p-3.5 rounded-2xl text-left transition-all border ${
              selectedZone === z.zone
                ? `${z.colorClass} border-current shadow-lg`
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <div className="text-[11px] font-mono uppercase tracking-wider opacity-75">
              Strefa {z.zone}
            </div>
            <div className="text-sm sm:text-base font-bold text-white mt-0.5">
              {z.name}
            </div>
          </button>
        ))}
      </div>

      {/* Selected Zone Deep Dive Display */}
      {(() => {
        const current = zones[selectedZone];
        return (
          <div
            className={`rounded-3xl bg-[#10111a] border ${current.accentBorder} p-6 sm:p-10 transition-colors`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/80 mb-8">
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded text-xs font-mono font-semibold uppercase tracking-wider border mb-2 ${current.colorClass}`}
                >
                  Poziom {current.zone} · {current.badge}
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Strefa {current.zone}: {current.name}
                </h3>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {current.zone === 0 && "Akcja: Spoczynek (Brak alertu)"}
                {current.zone === 1 && "Akcja: Po 10s pretekst połączenia"}
                {current.zone === 2 &&
                  "Akcja: WebSocket GPS + Dzwonek u przyjaciółek"}
                {current.zone === 3 &&
                  "Akcja: Syrena full-volume + 112 + SHA-256"}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Left Column: Phone Screen */}
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ff2a85]" />
                  <span>Twój telefon (Widok kamuflażu)</span>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-sm text-slate-300 leading-relaxed min-h-[140px]">
                  {current.phonePerspective}
                </div>
              </div>

              {/* Right Column: Support Network */}
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span>Krąg zaufania (Telefony przyjaciółek)</span>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-sm text-slate-300 leading-relaxed min-h-[140px]">
                  {current.networkPerspective}
                </div>
              </div>
            </div>

            {/* Technical Highlights Bar */}
            <div className="pt-6 border-t border-slate-800/80">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                Zasady implementacyjne &amp; Rygor techniczny:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {current.technicalDetails.map((detail, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-slate-300"
                  >
                    <span className="text-[#ff2a85] font-bold">―</span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
};
