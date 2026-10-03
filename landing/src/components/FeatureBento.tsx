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
      id="jak-to-dziala"
      className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80"
    >
      {/* Section Header */}
      <div className="max-w-3xl mx-auto text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/20 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-4">
          Kamuflaż i Zasada Działania
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Dlaczego tradycyjne aplikacje SOS zawodziły?
        </h2>
        <p className="text-slate-400 text-base leading-relaxed">
          Większość aplikacji ratunkowych zakłada, że w chwili zagrożenia masz
          czas odblokować telefon, wpisać PIN i nacisnąć jaskrawy przycisk.
          PanicMap odrzuca te iluzje na rzecz radykalnego kamuflażu i
          natychmiastowej sprawczości.
        </p>
      </div>

      {/* Bento Grid with Asymmetric Rhythm */}
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
              Niewidzialność z dystansu: Mapa, która wygląda jak mapa
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mb-6">
              Rastrowa mapa bazowa jest celowo odbarwiona i przyciemniona (
              <code className="text-slate-300">raster-saturation: 0</code> na
              kaflach CARTO, <code className="text-slate-300">-0.92</code> na
              OpenStreetMap). Na ekranie nie ma ani jednego czerwonego napisu
              typu „ALARM” czy „SOS”. Ktokolwiek zerka przez Twoje ramię, widzi
              jedynie zwykłą nawigację pieszą.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6 border-t border-slate-800/80">
            <div className="text-xs text-slate-300">
              <strong className="text-white block mb-1">
                6-pikselowa dioda kontrolna:
              </strong>
              Dyskretny wskaźnik nagrywania w rogu ekranu z niskim opacity —
              potwierdza Tobie, że telefon rejestruje dźwięk, i nie zdradza nic
              nikomu innemu.
            </div>
            <div className="text-xs text-slate-300">
              <strong className="text-white block mb-1">
                Naturalny pretext fizyczny:
              </strong>
              Fałszywy telefon wymusza trzymanie aparatu przy uchu, dzięki czemu
              systemowy wskaźnik mikrofonu w Androidzie wygląda w pełni
              naturalnie.
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
              Ergonomia kciuka
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">
              Zasada „Push &amp; Let Go”
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Przesuwasz gałkę i <strong>puszczasz</strong> — nic nie dzieje
              się, dopóki palec jest dociśnięty do szkła. Przypadkowe otarcie w
              torebce lub kieszeni kurtki nigdy nie uruchomi fałszywego alertu.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 font-mono">
            Zero przypadkowych alarmów · Anulowanie przesunięciem do 0
          </div>
        </div>

        {/* Cell 3: 1-column feature - Evidence Custody */}
        <div className="rounded-3xl bg-[#10111a] border border-slate-800 p-8 flex flex-col justify-between hover:border-slate-700 transition-colors">
          <div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-6">
              <FileLock size={24} weight="bold" />
            </div>
            <div className="text-xs font-mono uppercase tracking-wider text-rose-400 mb-2 font-semibold">
              Dowodowość
            </div>
            <h3 className="text-xl font-bold text-white mb-3 tracking-tight">
              Pakiety audio SHA-256
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              W Poziomie 3 telefon rejestruje dźwięk w 30-sekundowych
              fragmentach i wysyła je na serwer w chwili zamknięcia każdego z
              nich. Gdyby sprawca zniszczył urządzenie, nagranie jest już
              bezpieczne w chmurze.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 font-mono">
            Chain of custody · Sumy SHA-256 · Znaczniki pozycji
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
              Krąg Sióstr sparowany kodem QR w 3 sekundy
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mb-6">
              Wychodzicie razem z klubu, imprezy lub biblioteki? Jeden skan kodu
              QR aparatem wystarczy, by dodać koleżankę do Twojej sieci czuwania
              na czas nocnego powrotu. Bez podawania numerów, bez reklamowych
              komunikatorów.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-6 border-t border-slate-800/80">
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-white font-semibold text-xs mb-1">
                1. Wyświetl kod QR
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
                Koleżanka potwierdza gotowość
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
              <div className="text-white font-semibold text-xs mb-1">
                3. Czuwanie aktywne
              </div>
              <div className="text-[11px] text-slate-400">
                Powiadomienia i syrena działają w tle
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
