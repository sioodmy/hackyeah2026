import React from "react";
import { Heart } from "@phosphor-icons/react";

export const FeministManifesto: React.FC = () => {
  return (
    <section
      id="siostrzany-pakt"
      className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative"
    >
      {/* Background soft pink aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-[#ff2a85]/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      <div className="rounded-3xl bg-gradient-to-b from-[#141522] to-[#0f1019] border border-slate-800 p-8 sm:p-12 lg:p-16 relative overflow-hidden">
        {/* Subtle decorative motif */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-full bg-[#ff2a85]/20 border border-[#ff2a85]/40 flex items-center justify-center text-[#ff2a85]">
            <Heart size={18} weight="fill" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#ff2a85]">
            Manifest Sprawczości i Siostrzeństwa · Girls in Tech
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.15] mb-6">
              Nocne ulice należą do nas wszystkich.{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-[#ff2a85] to-rose-400">
                Bez lęku, bez wstydu, bez kompromisów.
              </span>
            </h2>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed mb-6 font-normal">
              Przez dekady słyszałyśmy: „nie wracaj sama po zmroku”, „trzymaj
              klucze w palcach”, „nie noś tego”. PanicMap nie uczy dziewczyn
              strachu ani nie przerzuca odpowiedzialności na ofiarę. Tworzymy
              cyfrowe ramię, które pozwala poruszać się po mieście na własnych
              zasadach.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[#ff2a85]/20 text-[#ff2a85] flex items-center justify-center flex-shrink-0 mt-1">
                  ✓
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">
                    Prawo do bezkonfliktowego wyjścia
                  </h4>
                  <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                    Fałszywy telefon daje Ci gotowe, społeczne alibi, by w
                    ułamku sekundy przerwać złą randkę, natarczywe zaczepki w
                    klubie czy dziwną rozmowę na przystanku bez ryzyka eskalacji
                    słownej.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[#ff2a85]/20 text-[#ff2a85] flex items-center justify-center flex-shrink-0 mt-1">
                  ✓
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">
                    Siostrzeństwo zamiast inwigilacji
                  </h4>
                  <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                    Twoja lokalizacja nie leci na serwery korporacji reklamowych
                    ani do osób trzecich. Uruchamia się wyłącznie wtedy, gdy to
                    Ty o tym zdecydujesz, i trafia wyłącznie do rąk tych, którym
                    naprawdę ufasz.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-6 h-6 rounded-full bg-[#ff2a85]/20 text-[#ff2a85] flex items-center justify-center flex-shrink-0 mt-1">
                  ✓
                </div>
                <div>
                  <h4 className="text-white font-semibold text-sm">
                    Głos, który staje się dowodem
                  </h4>
                  <p className="text-slate-400 text-xs sm:text-sm mt-0.5">
                    Koniec z sytuacjami „słowo przeciwko słowu”. Zaszyfrowane
                    pakiety audio z cyfrowym znacznikiem czasu i pozycji chronią
                    Twoją prawdę, zanim ktokolwiek spróbuje ją podważyć.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Quotes & Sister Network Badge */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-500 to-rose-400 flex items-center justify-center text-white font-bold text-sm">
                  👩‍💻
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">
                    Wiktoria, studentka AGH
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Użytkowniczka testowa z Krakowa
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                „Kiedy wracam z nocnego dyżuru na Ruczaju przez ciemne osiedle,
                nie chcę trzymać na wierzchu aplikacji ze świecącym na czerwono
                napisem RATUNKU. PanicMap wygląda jakbym sprawdzała trasę do
                domu, a wiem, że moje dziewczyny są o jeden ruch kciuka ode
                mnie.”
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-[#ff2a85]/15 to-transparent border border-[#ff2a85]/30">
              <div className="text-xs font-mono uppercase text-[#ff2a85] font-semibold mb-1">
                Pakt Wzajemnego Bezpieczeństwa
              </div>
              <div className="text-lg font-bold text-white mb-2">
                „Idę do niej” — zasada natychmiastowej reakcji
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Gdy odpala się Poziom 3, wyciszenie telefonu zostaje przełamane.
                Dziewczyna z kręgu nie dostaje powiadomienia, które może
                przeoczyć — dostaje sygnał alarmowy, który wyłącza się dopiero
                wtedy, gdy podejmie realne działanie.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
