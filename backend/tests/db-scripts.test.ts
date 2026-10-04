/**
 * The setup scripts must work from a clean checkout with no `.env` file, since
 * `npm run setup` runs before anyone has configured Clerk or push credentials.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);

/** Homebrew's Postgres keeps psql in a versioned keg that may not be on PATH. */
function resolveTool(name: string): string {
  const keg = `/opt/homebrew/opt/postgresql@18/bin/${name}`;
  return existsSync(keg) ? keg : name;
}

/** Runs a script with dotenv pointed at nothing, simulating a fresh checkout. */
async function runScript(script: string) {
  try {
    const { stdout, stderr } = await run("npx", ["tsx", script], {
      // PATH alone is not enough: tsx resolves loaders and the pg driver
      // through HOME, and vitest inherits a full environment we must not leak.
      env: {
        PATH: process.env.PATH ?? "",
        HOME: process.env.HOME ?? "",
        TMPDIR: process.env.TMPDIR ?? "",
        DOTENV_CONFIG_PATH: "/dev/null",
      },
      timeout: 60_000,
    });
    return { code: 0, output: stdout + stderr };
  } catch (error) {
    const err = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: err.code ?? 1,
      output: (err.stdout ?? "") + (err.stderr ?? ""),
    };
  }
}

describe("database scripts", () => {
  it("db:create reports the database already existing, without error", async () => {
    const result = await runScript("src/db/create.ts");

    expect(result.code).toBe(0);
    expect(result.output).toMatch(/database "mokosh"/);
    expect(result.output).toMatch(/pgcrypto/);
  });

  it("db:migrate applies cleanly and is repeatable", async () => {
    const first = await runScript("src/db/migrate.ts");
    expect(first.code).toBe(0);
    expect(first.output).toMatch(/migrations applied/);

    // Running it twice must not error: it is part of a documented setup step.
    const second = await runScript("src/db/migrate.ts");
    expect(second.code).toBe(0);
  });

  it("migrating does not require CLERK_JWKS_URL", async () => {
    // A fresh checkout has no .env at all. If migrations imported the app's
    // config they would fail on the missing signing key, blocking setup.
    const result = await runScript("src/db/migrate.ts");

    expect(result.code).toBe(0);
    expect(result.output).not.toMatch(/CLERK_JWKS_URL/);
  });

  it("the migration created every table the schema declares", async () => {
    const { stdout } = await run(resolveTool("psql"), [
      "-d",
      "mokosh",
      "-tAc",
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name",
    ]);

    const tables = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    expect(tables).toEqual(
      expect.arrayContaining(["users", "contacts", "devices", "alerts"]),
    );
  });
});
