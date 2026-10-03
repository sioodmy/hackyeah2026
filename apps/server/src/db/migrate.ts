import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { sql } from "./client.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "migrations");

/**
 * Deliberately tiny migration runner: the project has one idempotent SQL file and
 * no reason to drag in a migration framework during a hackathon.
 */
async function main(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const applied = new Set(
    (await sql<{ name: string }[]>`SELECT name FROM schema_migrations`).map(
      (row) => row.name,
    ),
  );

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const name of files) {
    if (applied.has(name)) {
      console.log(`- pominięto ${name}`);
      continue;
    }

    const statements = await readFile(join(migrationsDir, name), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(statements);
      await tx`INSERT INTO schema_migrations (name) VALUES (${name})`;
    });

    console.log(`+ zastosowano ${name}`);
  }

  await sql.end({ timeout: 5 });
}

main().catch((error: unknown) => {
  console.error("Migracja nie powiodła się:", error);
  process.exit(1);
});
