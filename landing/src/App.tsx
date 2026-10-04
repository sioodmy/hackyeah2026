import React from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { ProblemSection } from "./components/ProblemSection";
import { DemoSection } from "./components/DemoSection";
import { Footer } from "./components/Footer";
// Style demo (mapa, suwak, nakładki) — te same, co w web preview.
import "../../web/src/styles.css";
import "maplibre-gl/dist/maplibre-gl.css";

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#090a10] text-slate-100 flex flex-col font-sans selection:bg-[#ff2a85] selection:text-white">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ProblemSection />
        <DemoSection />
        {/*
        Sekcje od „Architektura Suwaka" (ThreatMatrix) do „Stack
        Technologiczny" (ArchitectureSection) zostały usunięte — prezentacja
        ma prowadzić widza od razu do demo, a nie przez sześć sekcji
        dokumentacyjnych. Pliki komponentów zostały na dysku, więc da się je
        przywrócić jednym importem.
      */}
      </main>
      <Footer />
    </div>
  );
};

export default App;
