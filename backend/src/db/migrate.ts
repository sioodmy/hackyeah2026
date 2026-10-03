import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { userInfo } from 'node:os';

/**
 * Applies the SQL files in ./drizzle.
 *
 * Reads DATABASE_URL directly rather than through src/config/env.ts: migrating
 * a database should not require push credentials or a Clerk key, or every fresh
 * checkout would need a full .env before `db:migrate`.
 *
 * The default connects over the Unix socket as the current OS user, which is how
 * Homebrew Postgres is set up. A URL with no username is rejected by libpq over
 * TCP, so the username is filled in from the OS when DATABASE_URL is absent.
 */
function resolveDatabaseUrl(): string {
  const configured = process.env.DATABASE_URL?.trim();
  if (configured) return configured;

  const { username } = userInfo();
  const socketDir = process.env.PGHOST ?? '/tmp';
  return `postgresql://${encodeURIComponent(username)}@/${DB_NAME}?host=${socketDir}`;
}

const DB_NAME = process.env.DB_NAME ?? 'mokosh';

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: resolveDatabaseUrl() });
  try {
    await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
    console.log('[db] migrations applied');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('[db] migration failed:', (error as Error).message);
  console.error('\nIf Postgres is not running:');
  console.error('  brew services start postgresql@18');
  console.error('\nIf the database does not exist yet:');
  console.error('  npm run db:create');
  process.exitCode = 1;
});