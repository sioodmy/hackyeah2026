import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const here = dirname(fileURLToPath(import.meta.url));

// Deck dziedziczy build po landingu: te same aliasy (`@app` na `app/src`,
// `@demo` na `web/src/DemoPhone.tsx`) i ten sam `tsconfigRaw`, bo esbuild przy
// bezustawowej konfiguracji wchodzi w `app/tsconfig.json`, który dziedziczy po
// `expo/tsconfig.base` — a `deck/node_modules` nie ma expo.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  esbuild: {
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        target: "es2022",
        useDefineForClassFields: true,
        jsx: "react-jsx",
      },
    }),
  },
  resolve: {
    // DemoPhone importuje `react` z `web/node_modules`; bez dedupe byłyby dwie
    // kopie i "Invalid hook call".
    dedupe: ["react", "react-dom"],
    alias: {
      "@app": resolve(here, "../app/src"),
      "@demo": resolve(here, "../web/src/DemoPhone.tsx"),
      "@landing": resolve(here, "../landing/src"),
    },
  },
  server: { port: 5199, strictPort: true },
});
