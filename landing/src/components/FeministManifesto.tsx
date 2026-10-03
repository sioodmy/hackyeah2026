import React from "react";
import { Heart } from "@phosphor-icons/react";

export const FeministManifesto: React.FC = () => {
  return (
    <section
      id="manifest"
      className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative border-t border-slate-800/80"
    >
      {/* Background restrained ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[320px] bg-[#ff2a85]/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="rounded-3xl bg-[#10111a] border border-slate-800 p-8 sm:p-12 lg:p-14 relative overflow-hidden">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-lg bg-[#ff2a85]/15 border border-[#ff2a85]/30 flex items-center justify-center text-[#ff2a85]">
            <Heart size={16} weight="fill" />
          </div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#ff2a85]">
            Manifest Sprawczości i Siostrzeństwa
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Main Manifesto Text */}
          <div className="lg:col-span-7">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15] mb-6">
              Nocne ulice należą do nas.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-[#ff2a85] to-pink-300">
                Bez lęku, bez wstydu, bez kompromisów.
              </span>
            </h2>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8">
              Przez lata kobietom powtarzano: „nie wracaj sama po zmroku”,
              „trzymaj klucze między palcami”, „uważaj na to, co zakładasz”.
              PanicMap odrzuca przerzucanie odpowiedzialności na ofiarę.
              Tworzymy technologię, która daje wolność wyboru, spokój i
              natychmiastowe wsparcie zaufanych ludzi.
            </p>

            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-5 h-5 rounded-full bg-[#ff2a85]/20 text-[#ff2a85] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">
                    Prawo do bezkonfliktowego wyjścia
                  </h4>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
                    Nie każda niebezpieczna sytuacja zaczyna się od fizycznej
                    napaści. Natarczywe zaczepki, nieudana randka czy
                    niepokojące towarzystwo w nocnym autobusie wymagają
                    bezpiecznego alibi. Fałszywy telefon pozwala opuścić
                    sytuację naturalnie, bez prowokowania agresji.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-5 h-5 rounded-full bg-[#ff2a85]/20 text-[#ff2a85] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">
                    Siostrzeństwo zamiast inwigilacji
                  </h4>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
                    Nie budujemy kolejnego narzędzia śledzącego każdy Twój krok
                    dla korporacji reklamowych. Pozycja GPS jest udostępniana
                    wyłącznie wtedy, gdy sama pociągniesz za suwak, i trafia
                    wyłącznie do wybranego przez Ciebie kręgu sióstr i
                    przyjaciół.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-5 h-5 rounded-full bg-[#ff2a85]/20 text-[#ff2a85] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">
                    Głos, który staje się niezaprzeczalnym dowodem
                  </h4>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
                    Koniec z sytuacjami „słowo przeciwko słowu”. Zaszyfrowane
                    pakiety audio z cyfrowym łańcuchem dowodowym (chain of
                    custody) zabezpieczają prawdę w chmurze w czasie
                    rzeczywistym — zanim ktokolwiek spróbuje ją podważyć.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Concrete Operational Principles */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs font-mono uppercase tracking-wider text-[#ff2a85] mb-2 font-semibold">
                Reguła 1: Deeskalacja społeczna
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Dlaczego alibi działa lepiej niż konfrontacja
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Konfrontacja słowna w odosobnionym miejscu niesie wysokie ryzyko
                natychmiastowej eskalacji fizycznej. Pretekst przychodzącego
                połączenia zmienia dynamikę władzy: osoba zaczepiająca zdaje
                sobie sprawę, że ktoś na Ciebie czeka i zaraz Cię zobaczy.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs font-mono uppercase tracking-wider text-[#ff2a85] mb-2 font-semibold">
                Reguła 2: Przełamanie znieczulicy
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Zasada „Idę do niej”
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tradycyjne powiadomienia gubią się wśród setek wiadomości z
                komunikatorów. W Poziomie 3 syrena w telefonach przyjaciółek
                przełamuje wyciszenie i milknie dopiero po podjęciu
                jednoznacznej akcji pomocowej.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
