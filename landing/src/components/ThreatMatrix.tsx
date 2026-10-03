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
      "Telefony znajomych w kręgu milczą. Brak powiadomień w tle, brak zbędnego drenażu baterii.",
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
      "Po 10 sekundach od puszczenia suwaka telefon sam dzwoni (jako Mama lub inny wybrany kontakt). Cichy dzwonek i wibracja. Po odebraniu leci 30-sekundowa ambientowa rozmowa tła, dająca powód do szybkiego odejścia.",
    networkPerspective:
      "Przyjaciółki dostają ciche powiadomienie systemowe (OS-level heads-up), że uruchomiłaś pretekst wyjścia. Ekran ich telefonów nie zostaje zablokowany.",
    technicalDetails: [
      "10-sekundowy bufor na ewentualne cofnięcie suwaka do 0",
      "Dźwięk odtwarzany na volume 0.15 z uwagi na specyfikę routing audio w urządzeniu",
    ],
  },
  {
    zone: 2,
    name: "Krąg Sióstr",
    badge: "Połączenie na żywo",
    colorClass: "text-orange-300 bg-orange-500/10 border-orange-500/30",
    accentBorder: "border-orange-500/30 hover:border-orange-500/50",
    phonePerspective:
      "Wszystko z poziomu 1, plus natychmiastowe uruchomienie transmisji pozycji GPS przez kanał WebSocket do uprawnionych odbiorców.",
    networkPerspective:
      "Na telefonach w kręgu pojawia się pełnoekranowe wywołanie z przyciskiem Odbierz. Po odebraniu rozmawiacie, a u Ciebie pojawia się status: Kasia rozmawia.",
    technicalDetails: [
      "Niskolatencyjny strumień współrzędnych (/ws/locations)",
      "Przyjaciółka widzi poruszający się punkt na swojej mapie w czasie rzeczywistym",
    ],
  },
  {
    zone: 3,
    name: "Alarm Krytyczny",
    badge: "112 i audio w chmurze",
    colorClass: "text-rose-300 bg-rose-500/10 border-rose-500/30",
    accentBorder: "border-rose-500/40 hover:border-rose-500/60",
    phonePerspective:
      "Niewidoczne nagrywanie dźwięku w 30-sekundowych segmentach SHA-256 wysyłanych na serwer natychmiast po zamknięciu paczki. Równolegle wyzwalane zgłoszenie mock 112 zwracające numer sprawy.",
    networkPerspective:
      "U wszystkich w kręgu włącza się głośna syrena omijająca tryb wyciszenia (bypassDnd). Dźwięk milknie dopiero wtedy, gdy przyjaciółka kliknie przycisk: Idę do niej.",
    technicalDetails: [
      "Pakiety audio zabezpieczone sumą SHA-256, stemplami czasu i współrzędnymi start/stop",
      "Zniszczenie lub odebranie telefonu oznacza utratę maksymalnie ułamka ostatniego segmentu",
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
          Architektura Suwaka
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Cztery strefy. Dwie strony każdego alertu.
        </h2>
        <p className="text-slate-400 text-base leading-relaxed">
          Suwak działa w modelu <em>Push and Let Go</em>: nic się nie dzieje,
          dopóki palec dotyka ekranu. Dopiero puszczenie aktywuje dany poziom,
          co eliminuje przypadkowe dotknięcia w kieszeni czy torebce.
        </p>
      </div>

      {/* Zone Tabs */}
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

      {/* Selected Zone Display */}
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
                  Poziom {current.zone}: {current.badge}
                </span>
                <h3 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  Strefa {current.zone}: {current.name}
                </h3>
              </div>
              <div className="text-xs text-slate-400 font-mono">
                {current.zone === 0 && "Stan normalny (brak alertu)"}
                {current.zone === 1 && "Po 10s: fałszywy telefon"}
                {current.zone === 2 && "WebSocket GPS + połączenie"}
                {current.zone === 3 && "Syrena bypassDnd + 112 + SHA-256"}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {/* Left: Phone */}
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#ff2a85]" />
                  <span>Twój telefon (Widok kamuflażu)</span>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-sm text-slate-300 leading-relaxed min-h-[130px]">
                  {current.phonePerspective}
                </div>
              </div>

              {/* Right: Friends */}
              <div className="space-y-3">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span>Krąg znajomych (Telefony przyjaciółek)</span>
                </div>
                <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-sm text-slate-300 leading-relaxed min-h-[130px]">
                  {current.networkPerspective}
                </div>
              </div>
            </div>

            {/* Technical Highlights */}
            <div className="pt-6 border-t border-slate-800/80">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                Szczegóły implementacji:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {current.technicalDetails.map((detail, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-slate-300"
                  >
                    <span className="text-[#ff2a85] font-bold">-</span>
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
