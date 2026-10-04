import React from "react";
import { ShieldCheck } from "@phosphor-icons/react";
import { DemoStage } from "../DemoStage";

/**
 * Slajd tytułowy — nagłówek i podtytuł wzięte z hero landingu (Hero.tsx),
 * opis z stopki. Telefon po prawej jest celowo w stanie spoczynku: pierwszą
 * rzeczą, którą widz zobaczy, jest mapa, która wygląda jak mapa.
 */
export const Title: React.FC = () => (
  <section className="slide" data-slide={0}>
    <div
      className="slide-glow"
      style={
        { width: 760, height: 420, top: 90, right: 100 } as React.CSSProperties
      }
      aria-hidden
    />
    <div className="slide-inner">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#ff2a85] grid place-items-center text-white shadow-lg shadow-[#ff2a85]/25">
          <ShieldCheck size={20} weight="fill" />
        </div>
        <span className="text-[19px] font-extrabold tracking-tight text-white">
          Mokosh
        </span>
        <span className="w-px h-5 bg-white/15" />
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500">
          HackYeah 2026 · Kraków
        </span>
      </div>

      <div className="flex-1 min-h-0 flex items-center gap-12">
        <div className="flex-1 min-w-0">
          <h1 className="text-[58px] leading-[1.04] font-extrabold tracking-tight text-white">
            Każda z nas zasługuje na{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-200 via-[#ff2a85] to-pink-400">
              bezpieczeństwo
            </span>
          </h1>

          <p className="mt-6 text-[16px] leading-relaxed text-slate-300 max-w-[54ch]">
            Od unikania niekomfortowych interakcji z creepami po wczesne
            zawiadamianie o niebezpieczeństwie bliskich i służby. W zależności
            od poziomu zagrożenia, na bierząco w czasie rzeczywistym
          </p>

          <div className="mt-6 text-[15px] text-slate-400">
            Dyskretna obrona na nocne powroty.
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {[
              "Android · APK v0.3.0",
              "Open Source",
              "Expo · React Native",
              "Fastify · Postgres · WebSocket",
              "187 testów",
            ].map((chip) => (
              <span
                key={chip}
                className="px-3 py-1.5 rounded-full text-[11.5px] font-medium text-slate-300 bg-white/[0.045] border border-white/10"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="shrink-0 relative">
          <div
            className="absolute -inset-10 rounded-full blur-[70px] pointer-events-none"
            style={{ background: "rgba(255,42,133,0.18)" }}
            aria-hidden
          />
          <div className="relative">
            <DemoStage script={{ kind: "map", heatmap: false }} scale={0.58} />
          </div>
        </div>
      </div>

      <footer className="shrink-0 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.16em] text-slate-600 pt-4 border-t border-white/[0.06]">
        <span>github.com/sioodmy/hackyeah2026</span>
        <img
          src="./hackyeah-logo.svg"
          alt="HackYeah 2026"
          className="h-5 w-auto object-contain opacity-80"
        />
      </footer>
    </div>
  </section>
);
