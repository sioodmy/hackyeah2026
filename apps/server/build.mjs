import { builtinModules } from "node:module"
import { readFile } from "node:fs/promises"

import { build } from "esbuild"

const pkg = JSON.parse(
  await readFile(new URL("./package.json", import.meta.url), "utf8")
)

/**
 * `@safecall/shared` ships TypeScript source, so it is bundled in. Everything
 * else stays external and is resolved from node_modules at runtime.
 */
const external = [
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
  ...Object.keys(pkg.dependencies).filter(
    (name) => name !== "@safecall/shared"
  ),
]

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: true,
  logLevel: "info",
  external,
})
