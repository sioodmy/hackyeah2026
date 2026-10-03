import React from "react";
import { Heart } from "@phosphor-icons/react";

export const FeministManifesto: React.FC = () => {
  return (
    <section
      id="dlaczego"
      className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative border-t border-slate-800/80"
    >
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[320px] bg-[#ff2a85]/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="rounded-3xl bg-[#10111a] border border-slate-800 p-8 sm:p-12 lg:p-14 relative overflow-hidden">
        {/* Eyebrow */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-lg bg-[#ff2a85]/15 border border-[#ff2a85]/30 flex items-center justify-center text-[#ff2a85]">
            <Heart size={16} weight="fill" />
          </div>
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#ff2a85]">
            Dlaczego powstał Mokosh
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Main Column */}
          <div className="lg:col-span-7">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15] mb-6">
              Nocne ulice bez strachu{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-[#ff2a85] to-pink-300">
                i bez pouczania.
              </span>
            </h2>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-8">
              Zamiast powtarzać dziewczynom „nie wracaj sama” albo „uważaj jak
              się ubierasz”, stworzyliśmy proste narzędzie, które daje realną
              kontrolę. Bez moralizowania, bez wstydu i bez przerzucania winy na
              ofiarę.
            </p>

            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-5 h-5 rounded-full bg-[#ff2a85]/20 text-[#ff2a85] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">
                    Pretekst zamiast konfrontacji
                  </h4>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
                    Większość groźnych sytuacji to nie napady, tylko natarczywe
                    zaczepki, nieudana randka czy niepokojący typ na przystanku.
                    Fałszywy telefon daje natychmiastowe alibi, by odejść
                    spokojnie i bez ryzyka awantury.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-5 h-5 rounded-full bg-[#ff2a85]/20 text-[#ff2a85] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">
                    Wsparcie bez komercyjnego śledzenia
                  </h4>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
                    Nie zbieramy Twojej lokalizacji dla reklamodawców. GPS
                    uruchamia się tylko wtedy, gdy sama pociągniesz za suwak, i
                    trafia wyłącznie do zaufanych osób z Twojego kręgu.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-5 h-5 rounded-full bg-[#ff2a85]/20 text-[#ff2a85] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold">
                  ✓
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">
                    Nagranie bezpieczne w chmurze
                  </h4>
                  <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
                    Koniec z sytuacjami słowo przeciwko słowu. Zaszyfrowane
                    paczki audio trafiają na serwer w czasie rzeczywistym razem
                    ze znacznikami czasu i pozycji GPS.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs font-mono uppercase tracking-wider text-[#ff2a85] mb-2 font-semibold">
                Zasada 1: Bezpieczne alibi
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Dlaczego udawany telefon deeskaluje sytuację
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dyskusja z natrętną osobą w ciemnym miejscu często podgrzewa
                atmosferę. Dzwoniący telefon zmienia reguły gry: natręt widzi,
                że ktoś na Ciebie czeka, wie gdzie jesteś i zaraz do Ciebie
                dołączy.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800">
              <div className="text-xs font-mono uppercase tracking-wider text-[#ff2a85] mb-2 font-semibold">
                Zasada 2: Głośna reakcja
              </div>
              <h3 className="text-base font-bold text-white mb-2">
                Przełamanie trybu cichego (Idę do niej)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Zwykłe SMS-y łatwo przegapić w nocy. Na poziomie 3 syrena w
                telefonach znajomych włącza się mimo wyciszenia i milknie
                dopiero wtedy, gdy ktoś potwierdzi podjęcie działania.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
