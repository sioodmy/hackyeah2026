import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = dirname(fileURLToPath(import.meta.url));

// Tymczasowy podgląd UI — web only, bez backendu (branch web/preview).
// `@app` wskazuje na app/src, żeby czyste moduły (theme/levels, lib/avatar)
// były współdzielone 1:1 z RN: edytujesz raz, działa tu i na Androidzie.
// Reguła: web importuje z @app tylko pliki bez importów z react-native/expo.
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5174 },
  resolve: {
    alias: {
      "@app": resolve(here, "../app/src"),
    },
  },
});
