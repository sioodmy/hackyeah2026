/**
 * Eksport prezentacji do PDF.
 *
 * Deck renderuje się w przeglądarce, a PDF powstaje przez `page.pdf()` — dzięki
 * temu wychodzi **wektorowy**: tekst zostaje tekstem, a nie bitmapą 4K.
 *
 * Uruchomienie:
 *   npm run build && npm run preview &   # albo `just deck`
 *   npm run pdf
 *
 * Playwright instaluje swojego Chromiuma z cache (~/.cache/ms-playwright).
 * Na NixOS binarka z Playwrighta nie ruszy (stub-ld), więc skrypt szuka
 * najpierw chromium z nix store i dopiero potem własnego pobrania.
 */
import { chromium } from "playwright";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const OUT_DIR = resolve(root, "dist");
const OUT_PDF = resolve(OUT_DIR, "Mokosh-HackYeah2026.pdf");

const URL_BASE = process.env.DECK_URL ?? "http://localhost:5199";
/** Ile slajdów ma deck — tyle samo stron ma mieć PDF. */
const PAGES = 10;
/** Rozmiar strony w tych samych jednostkach co slajd (1280×720 CSS px). */
const PAGE_W = "1280px";
const PAGE_H = "720px";
/** Ile czekamy na kafle mapy i końcowy render przed zdjęciem strony. */
const SETTLE_MS = 4500;

/**
 * Rozmiar strony.
 *
 * `preferCSSPageSize` zamiast `width`/`height` w Playwrightu: przy
 * przeliczaniu `1280px` na punkty Chromium zaokrągla stronę o ułamek
 * piksela i slajd nie mieści się w kartce. Wtedy dół slajdu (u nas: brzeg
 * telefonu, pasek gestów i stopka) ucina się przy podziale na strony, mimo
 * że w podglądzie wszystko jest na miejscu. Rozmiar bierze więc `@page`
 * z `deck.css`, który jest w tych samych jednostkach co slajd.
 */

/**
 * Chromium do eksportu.
 *
 * Kolejność: zmienna z explicit path → systemowy → nix store → Chromium
 * pobrany przez Playwrighta.
 */
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;

  for (const bin of ["chromium", "chromium-browser", "google-chrome"]) {
    try {
      // `stdio: ignore` — `which` krzyczy na stderr, a to tylko brak binarki.
      return execFileSync("which", [bin], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      /* nie ma — szukamy dalej */
    }
  }

  // Nix store: `chromium-<wersja>` bez rozszerzenia, katalog `bin/chromium`.
  // Szukamy po `/nix/store` zamiast przez `nix eval`, bo `builtins.nixStore`
  // nie istnieje i skrypt nie może od tego zależeć.
  for (const store of ["/nix/store", process.env.NIX_STORE].filter(Boolean)) {
    if (!existsSync(store)) continue;
    const candidates = readdirSync(store)
      .filter((d) => /^.{32}-chromium-[\d.]+$/.test(d))
      .sort()
      .reverse();
    for (const dir of candidates) {
      const bin = resolve(store, dir, "bin", "chromium");
      if (existsSync(bin)) return bin;
    }
  }

  return undefined; // zostawiamy Playwrightowi jego własnego Chromiuma
}

const run = async () => {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  // Serwer musi istnieć. `just deck-pdf` woła tylko `npm run pdf`, więc
  // skrypt sam podnosi `vite preview` na zbudowanym `dist/` i ubija go po
  // eksporcie; działający serwer z `just deck` zostawiamy w spokoju.
  let server;
  if (!(await reachable(URL_BASE))) {
    console.log(`[deck] brak serwera na ${URL_BASE} — startuję vite preview`);
    server = spawn(
      "npx",
      [
        "vite",
        "preview",
        "--port",
        String(new URL(URL_BASE).port || 5199),
        "--strictPort",
      ],
      { cwd: root, stdio: "ignore" },
    );
    for (let i = 0; i < 40 && !(await reachable(URL_BASE)); i++) {
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!(await reachable(URL_BASE))) {
      server.kill();
      throw new Error(
        `nie udało się podnieść ${URL_BASE} — zbuduj deck przez npm run build`,
      );
    }
  }

  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: [
      "--no-sandbox",
      // MapLibre renderuje przez WebGL; na maszynie bez GPU jedynie SwiftShader
      // daje działający kontekst, inaczej mapa w PDF-ie jest czarna.
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    page.on("pageerror", (e) => console.error("[deck]", e.message));

    // Wyeksportuj slajd po slajdzie, każdy na własnej karcie. Wersja
    // jednodokumentowa (`print=1` bez `only`) dzieliła dokument na strony po
    // swojemu i gubiła dolną krawędź telefonu: znikała ramka, pasek gestów
    // i suwak, a slajd z demo wyglądał na ucięty. Jedna strona na slajd
    // wyklucza podział w ogóle.
    const partDir = resolve(OUT_DIR, ".slides");
    mkdirSync(partDir, { recursive: true });

    for (let n = 0; n < PAGES; n++) {
      await page.goto(`${URL_BASE}/?print=1&only=${n}`, {
        waitUntil: "networkidle",
        timeout: 60_000,
      });
      // Kafle mapy dochodzą asynchronicznie; bez tego PDF miałby pusty
      // prostokąt zamiast mapy.
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll(".mapview canvas")].every(
            (c) => c.width > 0,
          ),
        null,
        { timeout: 30_000 },
      );
      await page.waitForTimeout(SETTLE_MS);

      const hosts = await page.evaluate(
        () => document.querySelectorAll(".slide-host").length,
      );
      if (hosts !== 1)
        throw new Error(`slajd ${n}: oczekiwano 1, jest ${hosts}`);

      await page.pdf({
        path: resolve(partDir, `${String(n + 1).padStart(2, "0")}.pdf`),
        printBackground: true,
        width: PAGE_W,
        height: PAGE_H,
      });
      process.stdout.write(`[deck] ${n + 1}/${PAGES}\r`);
    }
    await page.emulateMedia({ media: null });

    // Sklejenie stron. `pdfunite` z poppler-utils; bez niego zostają
    // pojedyncze pliki w `dist/.slides/`, a nie ma ich czym zastąpić.
    try {
      const parts = readdirSync(partDir)
        .filter((f) => f.endsWith(".pdf"))
        .sort()
        .map((f) => resolve(partDir, f));
      execFileSync("pdfunite", [...parts, OUT_PDF], {
        stdio: ["ignore", "ignore", "pipe"],
      });
    } catch (e) {
      console.warn(`[deck] pdfunite zawiódł: ${e.message}`);
      console.warn(`[deck] strony leżą osobno w ${partDir}`);
      return;
    }

    console.log(`[deck] ${OUT_PDF} (${PAGES} slajdów)`);
  } finally {
    await browser.close();
    server?.kill();
  }
};

/** Czy na tym adresie coś odpowiada. */
async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
