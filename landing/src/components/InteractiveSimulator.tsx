import React, { useState, useEffect } from "react";
import {
  PhoneCall,
  PhoneDisconnect,
  Siren,
  ShieldCheck,
  Broadcast,
  LockKey,
  Users,
  Waveform,
  CheckCircle,
} from "@phosphor-icons/react";

export const InteractiveSimulator: React.FC = () => {
  const [activeZone, setActiveZone] = useState<0 | 1 | 2 | 3>(0);
  const [callAnswered, setCallAnswered] = useState(false);
  const [callTimer, setCallTimer] = useState(0);
  const [mockCoordinates, setMockCoordinates] = useState({
    lat: 50.0614,
    lng: 19.9372,
  });
  const [audioChunks, setAudioChunks] = useState<
    Array<{ id: number; hash: string; status: string }>
  >([]);

  // Timer for active call
  useEffect(() => {
    let interval: any;
    if (callAnswered) {
      interval = setInterval(() => {
        setCallTimer((prev) => prev + 1);
      }, 1000);
    } else {
      setCallTimer(0);
    }
    return () => clearInterval(interval);
  }, [callAnswered]);

  // Coordinate jitter for Level 2 & 3
  useEffect(() => {
    let interval: any;
    if (activeZone >= 2) {
      interval = setInterval(() => {
        setMockCoordinates((prev) => ({
          lat: Number((prev.lat + (Math.random() - 0.5) * 0.0003).toFixed(5)),
          lng: Number((prev.lng + (Math.random() - 0.5) * 0.0003).toFixed(5)),
        }));
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [activeZone]);

  // Mock audio chunk generator for Level 3
  useEffect(() => {
    if (activeZone === 3) {
      setAudioChunks([
        {
          id: 1,
          hash: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1f...",
          status: "Verified",
        },
      ]);
      const interval = setInterval(() => {
        setAudioChunks((prev) => {
          if (prev.length >= 4) return prev;
          const newId = prev.length + 1;
          const randomHash = Array.from({ length: 40 }, () =>
            Math.floor(Math.random() * 16).toString(16),
          ).join("");
          return [
            ...prev,
            {
              id: newId,
              hash: `${randomHash.slice(0, 36)}...`,
              status: "Verified",
            },
          ];
        });
      }, 3000);
      return () => clearInterval(interval);
    } else {
      setAudioChunks([]);
      setCallAnswered(false);
    }
  }, [activeZone]);

  const zoneColors = {
    0: "border-slate-700 bg-slate-800 text-slate-300",
    1: "border-amber-500/50 bg-amber-500/20 text-amber-300",
    2: "border-orange-500/50 bg-orange-500/20 text-orange-300",
    3: "border-rose-500/50 bg-rose-500/20 text-rose-300",
  };

  return (
    <section
      id="symulator"
      className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
    >
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff2a85]/10 border border-[#ff2a85]/25 text-[#ff2a85] text-xs font-semibold uppercase tracking-wider mb-4">
          <Broadcast size={14} weight="fill" />
          <span>Interaktywny symulator alertu</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
          Przetestuj działanie obu stron w czasie rzeczywistym
        </h2>
        <p className="text-slate-400 text-base max-w-2xl mx-auto leading-relaxed">
          W PanicMap każde przesunięcie suwaka to dwie strony medalu: to, co
          dzieje się na Twoim ekranie (pełen kamuflaż), i natychmiastowa reakcja
          na telefonach Twojego kręgu przyjaciółek.
        </p>
      </div>

      {/* Zone Selector Pills */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-10 max-w-2xl mx-auto">
        {[
          {
            zone: 0,
            label: "Strefa 0: Spoczynek (Cicha mapa)",
            color: "hover:border-slate-500",
          },
          {
            zone: 1,
            label: "Strefa 1: Pretekst (Fałszywy telefon)",
            color: "hover:border-amber-400",
          },
          {
            zone: 2,
            label: "Strefa 2: Krąg Sióstr (Odbierz)",
            color: "hover:border-orange-400",
          },
          {
            zone: 3,
            label: "Strefa 3: Alarm & Dowody (Siren + 112)",
            color: "hover:border-rose-500",
          },
        ].map((item) => (
          <button
            key={item.zone}
            onClick={() => {
              setActiveZone(item.zone as any);
              setCallAnswered(false);
            }}
            className={`px-4 py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all border ${
              activeZone === item.zone
                ? `${zoneColors[item.zone as keyof typeof zoneColors]} ring-2 ring-[#ff2a85]/50 scale-[1.02]`
                : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Two-Perspective Device Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* LEFT: User's Phone (Stealth Map & Pretext) */}
        <div className="rounded-3xl bg-[#12131c] border border-slate-800 p-5 shadow-2xl relative overflow-hidden">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Twój telefon (Widok stealth)
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded">
              {activeZone === 0 && "STATUS: MAPA NORMALNA"}
              {activeZone === 1 && "STATUS: FAŁSZYWE POŁĄCZENIE"}
              {activeZone === 2 && "STATUS: STREAMING GPS DO SIÓSTR"}
              {activeZone === 3 && "STATUS: 112 & SZYFROWANIE AUDIO"}
            </div>
          </div>

          {/* Smartphone Mock Frame */}
          <div className="w-full max-w-[340px] mx-auto h-[540px] rounded-[36px] border-4 border-slate-700 bg-[#0d0f15] relative flex flex-col justify-between overflow-hidden shadow-inner">
            {/* Phone Speaker Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-full z-30 flex items-center justify-center">
              <div className="w-8 h-1 bg-slate-900 rounded-full" />
            </div>

            {/* Quiet stealth indicator dot (top right) - 6px dot at low opacity */}
            <div
              className={`absolute top-3 right-4 w-1.5 h-1.5 rounded-full z-30 transition-all ${
                activeZone === 3
                  ? "bg-rose-500 opacity-60 animate-ping"
                  : "bg-slate-600 opacity-20"
              }`}
              title="6-pixel stealth recording indicator"
            />

            {/* SCREEN CONTENT BASED ON ZONE */}
            <div className="flex-1 w-full h-full relative pt-8">
              {/* Simulated Desaturated OSM Map Basemap */}
              <div className="absolute inset-0 z-0 bg-[#161822] overflow-hidden">
                {/* SVG Map grid resembling quiet desaturated OpenStreetMap Kraków Planty */}
                <svg className="w-full h-full opacity-40" viewBox="0 0 340 500">
                  <path
                    d="M-20,120 Q120,140 360,90"
                    stroke="#334155"
                    strokeWidth="18"
                    fill="none"
                  />
                  <path
                    d="M80,-10 L100,520"
                    stroke="#334155"
                    strokeWidth="14"
                    fill="none"
                  />
                  <path
                    d="M220,-10 Q240,260 260,520"
                    stroke="#334155"
                    strokeWidth="22"
                    fill="none"
                  />
                  <path
                    d="M10,320 L350,300"
                    stroke="#334155"
                    strokeWidth="12"
                    fill="none"
                  />
                  {/* Kraków Planty green belt simplified */}
                  <circle
                    cx="160"
                    cy="220"
                    r="110"
                    stroke="#223328"
                    strokeWidth="36"
                    fill="none"
                  />
                  {/* Rynek Główny polygon */}
                  <rect
                    x="135"
                    y="195"
                    width="50"
                    height="50"
                    fill="#1e2230"
                    stroke="#384258"
                    strokeWidth="2"
                  />
                  <text
                    x="142"
                    y="225"
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="sans-serif"
                  >
                    Rynek
                  </text>
                  {/* User location pin */}
                  <circle cx="160" cy="270" r="6" fill="#38bdf8" />
                  <circle
                    cx="160"
                    cy="270"
                    r="14"
                    fill="#38bdf8"
                    opacity="0.25"
                  />
                </svg>

                {/* Street name labels resembling real quiet navigation */}
                <div className="absolute top-12 left-4 text-[10px] text-slate-500 font-mono">
                  Kraków, ul. Szewska · 3 min do celu
                </div>
              </div>

              {/* OVERLAY: Zone 1 Fake Call UI (The Pretext) */}
              {activeZone === 1 && (
                <div className="absolute inset-0 z-20 bg-slate-950/95 backdrop-blur-sm flex flex-col justify-between p-6">
                  <div className="text-center pt-8">
                    <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-amber-400/50 mx-auto flex items-center justify-center text-3xl mb-3 shadow-xl">
                      👩‍👧
                    </div>
                    <div className="text-lg font-bold text-white">Mama</div>
                    <div className="text-xs text-amber-400 mt-1">
                      {callAnswered
                        ? `Połączenie trwa · 00:${callTimer < 10 ? "0" : ""}${callTimer}`
                        : "Połączenie przychodzące..."}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-2 italic px-2">
                      {callAnswered
                        ? "„Cześć kochanie! Już czekamy w aucie przy rogu, podejdź proszę zaraz...”"
                        : "Pretekst: Odbierz, by mieć natychmiastowe alibi i odejść bez podejrzeń."}
                    </div>
                  </div>

                  {/* Call Action Buttons */}
                  <div className="flex items-center justify-around pb-6">
                    <button
                      onClick={() => setCallAnswered(false)}
                      className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-90"
                      title="Odrzuć i wróć do mapy"
                    >
                      <PhoneDisconnect size={24} weight="bold" />
                    </button>
                    {!callAnswered && (
                      <button
                        onClick={() => setCallAnswered(true)}
                        className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg animate-bounce transition-transform active:scale-90"
                        title="Odbierz fałszywy telefon"
                      >
                        <PhoneCall size={24} weight="bold" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* OVERLAY: Zone 2 Live Coordinate Streaming pill */}
              {activeZone === 2 && (
                <div className="absolute top-10 left-3 right-3 z-10 p-3 rounded-2xl bg-slate-900/95 border border-orange-500/40 shadow-xl backdrop-blur-md">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-orange-400 flex items-center gap-1.5">
                      <Broadcast size={14} className="animate-spin" />
                      Streaming GPS aktywny
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      WebSocket 60fps
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-300">
                    Współrzędne: {mockCoordinates.lat}, {mockCoordinates.lng}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-medium mt-1">
                    ✓ Przyjaciółka „Kasia” odebrała żądanie
                  </div>
                </div>
              )}

              {/* OVERLAY: Zone 3 Mock 112 Dispatch & Forensics */}
              {activeZone === 3 && (
                <div className="absolute top-10 left-3 right-3 z-10 p-3 rounded-2xl bg-slate-950/95 border border-rose-500/60 shadow-xl backdrop-blur-md">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-bold text-rose-400 flex items-center gap-1.5">
                      <Siren
                        size={15}
                        weight="fill"
                        className="animate-pulse text-rose-500"
                      />
                      Mock 112 Dispatch Nadany
                    </span>
                    <span className="text-[10px] font-mono bg-rose-950/80 text-rose-300 px-1.5 py-0.5 rounded border border-rose-800">
                      KPP-KRK-8491
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 flex items-center gap-1.5">
                    <Waveform
                      size={14}
                      className="text-rose-400 animate-pulse"
                    />
                    <span>Nagrywanie dowodowe (30s SHA-256)</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {audioChunks.map((chunk) => (
                      <div
                        key={chunk.id}
                        className="text-[9px] font-mono text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded flex items-center justify-between"
                      >
                        <span>chunk_{chunk.id}.m4a</span>
                        <span className="text-emerald-400">
                          hash: {chunk.hash.slice(0, 14)}...
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom 4-Zone Threat Slider - The signature PanicMap control */}
            <div className="relative z-20 p-4 bg-slate-900/90 backdrop-blur-md border-t border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2 flex justify-between">
                <span>Threat Slider (Push & Let Go)</span>
                <span className="font-mono text-white">
                  Poziom: {activeZone}
                </span>
              </div>

              {/* Visual Slider Track */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-slate-950 rounded-full border border-slate-800 relative">
                {[0, 1, 2, 3].map((level) => (
                  <button
                    key={level}
                    onClick={() => {
                      setActiveZone(level as any);
                      setCallAnswered(false);
                    }}
                    className={`py-2 text-xs font-bold rounded-full transition-all ${
                      activeZone === level
                        ? level === 0
                          ? "bg-slate-700 text-white shadow"
                          : level === 1
                            ? "bg-amber-500 text-black shadow-lg shadow-amber-500/30"
                            : level === 2
                              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/30"
                              : "bg-rose-600 text-white shadow-lg shadow-rose-600/40 animate-pulse"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    L{level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Friend & Dispatch Network View */}
        <div className="rounded-3xl bg-[#12131c] border border-slate-800 p-5 shadow-2xl relative flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-6">
              <div className="flex items-center gap-2">
                <Users size={18} weight="fill" className="text-[#ff2a85]" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Krąg Sióstr & Dyspozytor (Druga strona)
                </span>
              </div>
              <span className="text-xs text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded">
                Kanał ratunkowy
              </span>
            </div>

            {/* Active Alert Card */}
            <div className="space-y-4">
              {activeZone === 0 && (
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center py-12">
                  <ShieldCheck
                    size={48}
                    weight="duotone"
                    className="text-slate-600 mx-auto mb-3"
                  />
                  <div className="text-base font-semibold text-slate-200">
                    Stan Spoczynku
                  </div>
                  <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                    Brak aktywnych alertów. Telefony w Twoim kręgu zaufania
                    milczą. Ekran nie zdradza żadnych funkcji ratunkowych
                    przechodniom ani osobie idącej za Tobą.
                  </p>
                </div>
              )}

              {activeZone === 1 && (
                <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/40 space-y-3">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <CheckCircle size={18} weight="fill" />
                    <span>Ciche powiadomienie Heads-Up (OS level)</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Telefon przyjaciółek otrzymuje dyskretne powiadomienie:
                    „Kasia uruchomiła pretekst fałszywego połączenia”.
                  </p>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-amber-500/20 text-xs text-slate-400 font-mono">
                    Typ: Notification (Background) · Bez przejmowania ekranu
                  </div>
                </div>
              )}

              {activeZone === 2 && (
                <div className="p-5 rounded-2xl bg-orange-950/20 border border-orange-500/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-orange-400 text-sm flex items-center gap-2">
                      <Broadcast
                        size={18}
                        weight="bold"
                        className="animate-spin"
                      />
                      Żądanie rozmowy na pełnym ekranie
                    </span>
                    <span className="text-[10px] font-mono text-orange-300 bg-orange-900/50 px-2 py-0.5 rounded">
                      PRIORITY HIGH
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Na telefonie zaufanej przyjaciółki dzwoni pełnoekranowy
                    ekran połączenia z przyciskiem{" "}
                    <strong className="text-white">„Odbierz”</strong>.
                    Jednocześnie mapa na jej telefonie zaczyna przesuwać się w
                    czasie rzeczywistym wg Twojej lokalizacji.
                  </p>
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-950/40 border border-orange-500/30 text-xs text-orange-200">
                    <CheckCircle
                      size={16}
                      weight="fill"
                      className="text-orange-400"
                    />
                    <span>Status u Ciebie: „Kasia rozmawia z Tobą”</span>
                  </div>
                </div>
              )}

              {activeZone === 3 && (
                <div className="p-5 rounded-2xl bg-rose-950/30 border border-rose-500/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-400 text-sm flex items-center gap-2">
                      <Siren
                        size={20}
                        weight="fill"
                        className="animate-bounce"
                      />
                      ALARM KRYTYCZNY (Bypass DND)
                    </span>
                    <span className="text-[10px] font-mono text-white bg-rose-600 px-2 py-0.5 rounded font-bold">
                      POZIOM 3
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    U wszystkich w kręgu włącza się głośna syrena na pełnym
                    regulatorze — nawet jeśli telefon był wyciszony (`bypassDnd:
                    true`). Syrena cichnie tylko wtedy, gdy przyjaciółka
                    kliknie:
                  </p>
                  <div className="p-3 rounded-xl bg-rose-600 text-white font-bold text-center text-xs tracking-wider uppercase shadow-lg shadow-rose-600/30">
                    „IDĘ DO NIEJ!”
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-mono text-slate-400 space-y-1">
                    <div className="text-emerald-400">
                      ✓ Mock 112 Dispatch: Zgłoszenie przyjęte
                    </div>
                    <div>✓ Pozycja: Kraków, Kazimierz (dokładność 4m)</div>
                    <div>✓ Łańcuch dowodowy: Szyfrowany manifest SHA-256</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Deep Insight for Judges */}
          <div className="mt-8 pt-4 border-t border-slate-800/80">
            <div className="text-xs font-semibold text-[#ff2a85] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <LockKey size={14} weight="bold" />
              <span>Zasada działania PanicMap</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Przesunięcie suwaka z powrotem do zera natychmiast ucisza telefony
              sióstr, kończy alarm i zamyka plik manifestu z cyfrowym podpisem.
              Wszystko bez żadnego krzyczącego czerwonego napisu na Twoim
              ekranie.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
