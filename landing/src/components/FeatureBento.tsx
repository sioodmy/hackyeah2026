import React from "react";
import {
  EyeSlash,
  HandPointing,
  FileLock,
  QrCode,
  Sparkle,
} from "@phosphor-icons/react";

export const FeatureBento: React.FC = () => {
  return (
    <section
      id="jak-to-dziala"
      className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/25 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-4">
          <Sparkle size={14} weight="fill" />
          <span>Rewolucja w architekturze bezpieczeństwa</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Dlaczego tradycyjne aplikacje SOS zawodziły?
        </h2>
        <p className="text-slate-400 text-base leading-relaxed">
          Większość aplikacji ratunkowych zakłada, że w chwili zagrożenia masz
          czas odblokować telefon, wpisać kod i nacisnąć wielki czerwony
          przycisk. PanicMap odrzuca te iluzje na rzecz radykalnego kamuflażu i
          natychmiastowej sprawczości.
        </p>
      </div>

      {/* Bento Grid with Asymmetric Rhythm */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Cell 1: Large 2-column feature - Stealth First */}
        <div className="md:col-span-2 rounded-3xl bg-[#12131c] border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-colors relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#ff2a85]/10 blur-[100px] pointer-events-none rounded-full" />
          <div>
            <div className="w-12 h-12 rounded-2xl bg-[#ff2a85]/15 border border-[#ff2a85]/30 flex items-center justify-center text-[#ff2a85] mb-6">
              <EyeSlash size={24} weight="bold" />
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-[#ff2a85] mb-2 font-semibold">
              Kluczowa innowacja UX
            </div>
            <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
              Niewidzialność z dystansu: Mapa, która wygląda jak mapa
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mb-6">
              Rastrowa mapa bazowa jest celowo odbarwiona i przyciemniona
              (`raster-saturation: 0` na kaflach CARTO, `-0.92` na
              OpenStreetMap). Na ekranie nie ma ani jednego czerwonego napisu
              typu „ALARM” czy „SOS”. Ktokolwiek zerka przez Twoje ramię, widzi
              jedynie zwykłą nawigację pieszą.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              <div className="text-xs text-slate-300">
                <strong className="text-white">6-pikselowa dioda:</strong>{" "}
                Dyskretny wskaźnik nagrywania w rogu ekranu z niskim opacity —
                mówi Tobie, że telefon nagrywa, i nie zdradza Cię nikomu innemu.
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              <div className="text-xs text-slate-300">
                <strong className="text-white">Kamuflaż słuchawki:</strong>{" "}
                Fałszywy telefon wymusza trzymanie aparatu przy uchu, dzięki
                czemu wskaźnik mikrofonu w Androidzie wygląda naturalnie.
              </div>
            </div>
          </div>
        </div>

        {/* Cell 2: 1-column feature - Push & Let Go */}
        <div className="rounded-3xl bg-[#12131c] border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-6">
              <HandPointing size={24} weight="bold" />
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-2 font-semibold">
              Ergonomia kciuka
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">
              Zasada „Push & Let Go”
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Suwak ma 4 strefy. Przesuwasz gałkę i <strong>puszczasz</strong> —
              nic nie dzieje się, dopóki palec jest dociśnięty do szkła.
              Przypadkowe otarcie w torebce lub kieszeni kurtki nigdy nie
              uruchomi niepotrzebnego alarmu.
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono">
            0 fałszywych alarmów · Natychmiastowe odwołanie przesunięciem do 0
          </div>
        </div>

        {/* Cell 3: 1-column feature - Evidence Custody */}
        <div className="rounded-3xl bg-[#12131c] border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-6">
              <FileLock size={24} weight="bold" />
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-rose-400 mb-2 font-semibold">
              Wartość procesowa
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">
              30-sekundowe paczki SHA-256
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              W Poziomie 3 telefon rejestruje dźwięk w 30-sekundowych
              fragmentach i wysyła je na serwer w chwili zamknięcia każdego z
              nich. Gdyby napastnik zniszczył telefon, dowód jest już w chmurze.
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 font-mono">
            Chain-of-custody · Podpis kryptograficzny · Znaczniki GPS
          </div>
        </div>

        {/* Cell 4: Large 2-column feature - QR Sisterhood */}
        <div className="md:col-span-2 rounded-3xl bg-[#12131c] border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-colors relative overflow-hidden">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 mb-6">
              <QrCode size={24} weight="bold" />
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-pink-400 mb-2 font-semibold">
              Sieć zaufania w 3 sekundy
            </div>
            <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
              Parowanie kodem QR bez ujawniania numerów
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mb-6">
              Jesteś na imprezie, w klubie lub na festiwalu? Wystarczy jeden
              skan kodu QR aparatem, by dołączyć koleżankę do Twojego Kręgu
              Sióstr na dzisiejszy nocny powrót. Bez ręcznego przepisywania
              numerów, bez zbędnych zaproszeń SMS.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-white font-semibold text-xs mb-1">
                Krok 1: Pokaż QR
              </div>
              <div className="text-[11px] text-slate-400">
                Wygeneruj kod sesyjny jednym kliknięciem
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-white font-semibold text-xs mb-1">
                Krok 2: Zeskanuj
              </div>
              <div className="text-[11px] text-slate-400">
                Koleżanka potwierdza gotowość do czuwania
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-white font-semibold text-xs mb-1">
                Krok 3: Spokojny powrót
              </div>
              <div className="text-[11px] text-slate-400">
                Powiadomienia i syrena działają automatycznie
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
