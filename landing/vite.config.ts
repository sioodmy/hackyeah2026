import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const here = dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  resolve: {
    // Osadzone demo importuje `react` ze swojego katalogu (`web/`), który ma
    // własne node_modules. Bez `dedupe` Vite dałby dwie instancje Reacta —
    // ten sam kod, dwa kontekstowe hooki, czyli "Invalid hook call" w całej
    // sekcji. `dedupe` zmusza wszystko do jednej kopii z korzenia.
    dedupe: ["react", "react-dom"],
    alias: {
      // Sekcja demo osadza ten sam kod co web preview (`web/src/DemoPhone.tsx`),
      // a on importuje wspólne tokeny i poziomy z apki. Ten sam alias co w
      // web/vite.config.ts, więc demo nie może rozjechać się z apką.
      "@app": resolve(here, "../app/src"),
      "@demo": resolve(here, "../web/src/DemoPhone.tsx"),
    },
  },
});