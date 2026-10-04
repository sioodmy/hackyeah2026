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
  esbuild: {
    // Sekcja demo wciąga `app/src/theme/tokens.ts`, a esbuild szuka tsconfiga
    // *w górę* od pliku — trafia więc na `app/tsconfig.json`, który dziedziczy
    // po `expo/tsconfig.base`. Na maszynie z apką działa (expo jest w
    // `app/node_modules`), ale w CI na GitHub Pages nikt nie instalował apki,
    // więc build wybuchał na `failed to resolve "extends": "expo/tsconfig.base"`.
    // `tsconfigRaw` musi być **stringiem**, nie obiektem: Vite przy obiekcie
    // i tak wczytuje tsconfig pliku wspinając się w górę (`dep-*.js`,
    // `transformWithEsbuild`) i pada na tym samym `extends`. Ze stringiem
    // esbuild dostaje opcje wprost i ignoruje tsconfigi sąsiadów.
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        target: "es2022",
        useDefineForClassFields: true,
        jsx: "react-jsx",
      },
    }),
  },
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