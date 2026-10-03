import React from "react";
import {
  EyeSlash,
  HandPointing,
  FileLock,
  QrCode,
} from "@phosphor-icons/react";

export const FeatureBento: React.FC = () => {
  return (
    <section
      id="kamuflaz"
      className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80"
    >
      {/* Section Header */}
      <div className="max-w-3xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/20 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-4">
          Kamuflaż i Zasada Działania
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Dlaczego typowe aplikacje SOS nie sprawdzają się na ulicy
        </h2>
        <p className="text-slate-400 text-base leading-relaxed">
          Większość aplikacji ratunkowych zakłada, że w sytuacji zagrożenia
          odblokujesz telefon, przeklikasz się przez menu i naciśniesz jaskrawy
          czerwony przycisk. PanicMap stawia na kamuflaż: telefon wygląda jak
          zwykła mapa, a pomoc rusza w tle.
        </p>
      </div>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cell 1: Large 2-column feature - Stealth First */}
        <div className="md:col-span-2 rounded-3xl bg-[#10111a] border border-slate-800 p-8 sm:p-10 flex flex-col justify-between hover:border-slate-700 transition-colors relative overflow-hidden">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-[#ff2a85]/15 border border-[#ff2a85]/30 flex items-center justify-center text-[#ff2a85] mb-6">
              <EyeSlash size={24} weight="bold" />
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-[#ff2a85] mb-2 font-semibold">
              Koncepcja wizualna
            </div>
            <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
              Niewidzialność z dystansu: mapa, która wygląda jak mapa
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mb-6">
              Rastrowa mapa bazowa jest celowo odbarwiona i przyciemniona (
              <code className="text-slate-300">raster-saturation: 0</code> na
              kaflach CARTO, <code className="text-slate-300">-0.92</code> na
              OpenStreetMap). Nie ma tu żadnych czerwonych pasków ani napisu
              ALARM. Osoba idąca obok widzi jedynie zwykłą mapę uliczną.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-800/80">
            <div className="text-xs text-slate-300">
              <strong className="text-white block mb-1">
                Dioda 6px w rogu ekranu:
              </strong>
              Dyskretny punkt o niskim kryciu potwierdza Tobie, że rejestracja
              dźwięku działa, bez zwracania uwagi osób postronnych.
            </div>
            <div className="text-xs text-slate-300">
              <strong className="text-white block mb-1">
                Naturalny pretekst do rozmowy:
              </strong>
              Fałszywy telefon wymusza przyłożenie aparatu do ucha, dzięki czemu
              wskaźnik użycia mikrofonu w systemie wygląda w 100% naturalnie.
            </div>
          </div>
        </div>

        {/* Cell 2: 1-column feature - Push & Let Go */}
        <div className="rounded-3xl bg-[#10111a] border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6">
              <HandPointing size={24} weight="bold" />
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-2 font-semibold">
              Obsługa kciukiem
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">
              Zasada „Push and Let Go”
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Przesuwasz suwak i <strong>puszczasz</strong>: dopóki palec dotyka
              ekranu, alert się nie odpala. Przypadkowe otarcie w torebce lub
              kieszeni nie wywoła fałszywego alarmu.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 font-mono">
            Zero pomyłek: cofnięcie suwaka do zera odwołuje akcję natychmiast
          </div>
        </div>

        {/* Cell 3: 1-column feature - Evidence Custody */}
        <div className="rounded-3xl bg-[#10111a] border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-6">
              <FileLock size={24} weight="bold" />
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-rose-400 mb-2 font-semibold">
              Bezpieczeństwo danych
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">
              Kawałki audio po 30 sekund
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              W Poziomie 3 telefon rejestruje dźwięk w 30-sekundowych paczkach i
              wrzuca je od razu na serwer. Nawet jeśli telefon zostanie
              zniszczony, dowód jest już bezpiecznie zapisany w chmurze.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 font-mono">
            Suma SHA-256 dla każdej paczki, timestampy i pozycja GPS
          </div>
        </div>

        {/* Cell 4: Large 2-column feature - QR Sisterhood */}
        <div className="md:col-span-2 rounded-3xl bg-[#10111a] border border-slate-800 p-8 sm:p-10 flex flex-col justify-between hover:border-slate-700 transition-colors relative overflow-hidden">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 mb-6">
              <QrCode size={24} weight="bold" />
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-pink-400 mb-2 font-semibold">
              Szybkie parowanie
            </div>
            <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
              Dołączenie do kręgu kodem QR w 3 sekundy
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mb-6">
              Wychodzicie razem z klubu, koncertu czy biblioteki? Wystarczy
              jeden skan kodu QR aparatem, by dodać znajomą do kręgu czuwania na
              czas nocnego powrotu. Bez wymieniania się numerami i bez zbędnych
              kont.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-6 border-t border-slate-800/80">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-white font-semibold text-xs mb-1">
                1. Pokaż kod QR
              </div>
              <div className="text-[11px] text-slate-400">
                Wygeneruj kod sesyjny w aplikacji
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-white font-semibold text-xs mb-1">
                2. Zeskanuj aparatem
              </div>
              <div className="text-[11px] text-slate-400">
                Druga osoba potwierdza czuwanie
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-white font-semibold text-xs mb-1">
                3. Bezpieczny powrót
              </div>
              <div className="text-[11px] text-slate-400">
                Kanał alertowy działa w tle
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
