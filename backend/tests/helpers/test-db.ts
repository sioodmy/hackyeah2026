/**
 * Postgres for tests, without a Docker dependency.
 *
 * PGlite is real Postgres compiled to WASM, so the SQL Drizzle emits is the
 * same SQL production runs. The Drizzle query builder keeps working against
 * the live driver via `drizzle-orm/pglite`.
 */
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import * as schema from '../../src/db/schema.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

export type TestDatabase = PgliteDatabase<typeof schema>;

export interface TestDatabaseHandle {
  client: PGlite;
  db: TestDatabase;
  /** Empties every table, keeping the schema in place. */
  truncate: () => Promise<void>;
  close: () => Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabaseHandle> {
  const client = new PGlite();
  await applyMigrations(client);

  const db = drizzle(client, { schema });

  return {
    client,
    db,
    truncate: () => truncate(client),
    close: () => client.close(),
  };
}

/**
 * Applies the same generated SQL that `npm run db:migrate` applies, so tests
 * exercise the real schema rather than a hand-written approximation.
 */
async function applyMigrations(client: PGlite): Promise<void> {
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await client.exec(sql);
  }
}

async function truncate(client: PGlite): Promise<void> {
  await client.exec(
    'TRUNCATE TABLE alerts, contacts, devices, users RESTART IDENTITY CASCADE',
  );
}