import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = dirname(fileURLToPath(import.meta.url));

// Podgląd UI: web preview (mock) oraz biblioteka dla landingu.
// `@app` wskazuje na app/src, żeby czyste moduły (theme/tokens, theme/levels,
// lib/avatar) były współdzielone 1:1 z RN: edytujesz raz, działa tu, na
// Androidzie i na landingu. Reguła: importuj z @app tylko pliki bez importów
// z react-native / expo.
//
// `vite build --mode lib` buduje bibliotekę z DemoPhone dla landingu; zwykły
// `vite build` tego nie używa.
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: "./",
  server: { port: 5174 },
  resolve: {
    alias: {
      "@app": resolve(here, "../app/src"),
    },
  },
  build:
    mode === "lib"
      ? {
          lib: {
            entry: resolve(here, "src/DemoPhone.tsx"),
            name: "MokoshDemo",
            formats: ["es"],
            fileName: () => "mokosh-demo.js",
          },
          cssCodeSplit: false,
          rollupOptions: { external: ["react", "react-dom", "maplibre-gl"] },
        }
      : undefined,
}));
