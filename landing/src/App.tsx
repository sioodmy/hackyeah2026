import React from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { InteractiveSimulator } from "./components/InteractiveSimulator";
import { FeatureBento } from "./components/FeatureBento";
import { FeministManifesto } from "./components/FeministManifesto";
import { HeatmapSection } from "./components/HeatmapSection";
import { JurySection } from "./components/JurySection";
import { ArchitectureSection } from "./components/ArchitectureSection";
import { Footer } from "./components/Footer";

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#090a10] text-slate-100 flex flex-col font-sans selection:bg-[#ff2a85] selection:text-white">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <InteractiveSimulator />
        <FeatureBento />
        <FeministManifesto />
        <HeatmapSection />
        <JurySection />
        <ArchitectureSection />
      </main>
      <Footer />
    </div>
  );
};

export default App;
