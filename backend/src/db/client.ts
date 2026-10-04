import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "../config/env.js";
import * as schema from "./schema.js";

/**
 * Services only ever call Drizzle's query API, which is identical across
 * drivers. Tests swap in PGlite via `setDatabase`; ES module live bindings mean
 * importers pick up the replacement without re-wiring anything.
 */
export type Database = NodePgDatabase<typeof schema>;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (error) => {
  // A pooled client died in the background; the pool will replace it.
  console.error("[db] idle client error", error);
});

export let db: Database = drizzle(pool, { schema });

/** Test seam: replaces the handle with a PGlite instance. */
export function setDatabase(replacement: unknown): void {
  db = replacement as Database;
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
