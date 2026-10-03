/**
 * Creates the local development database if it does not exist.
 *
 * Postgres here runs under your own macOS role with no password, so this needs
 * no credentials. Override with `psql "$DATABASE_URL" -c 'CREATE DATABASE ...'`
 * if your setup differs.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';

const run = promisify(execFile);

const DB_NAME = process.env.DB_NAME ?? 'safety';

/**
 * Homebrew's Postgres keeps its client tools in a versioned keg that is not
 * always on PATH, so look there before giving up. Without this, `db:create`
 * fails on a machine where psql is only reachable by full path.
 */
function resolveTool(name: string): string {
  if (existsSync(`/opt/homebrew/opt/postgresql@18/bin/${name}`)) {
    return `/opt/homebrew/opt/postgresql@18/bin/${name}`;
  }
  return name;
}

async function databaseExists(): Promise<boolean> {
  const { stdout } = await run(resolveTool('psql'), [
    '-d',
    'postgres',
    '-tAc',
    `SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'`,
  ]);
  return stdout.trim() === '1';
}

async function main(): Promise<void> {
  if (await databaseExists()) {
    console.log(`[db] database "${DB_NAME}" already exists`);
  } else {
    await run(resolveTool('createdb'), [DB_NAME]);
    console.log(`[db] created database "${DB_NAME}"`);
  }

  // gen_random_uuid() lives in pgcrypto from Postgres 13, but it has to be
  // present for the alert and user ids to default.
  await run(resolveTool('psql'), [
    '-d',
    DB_NAME,
    '-c',
    'CREATE EXTENSION IF NOT EXISTS pgcrypto',
  ]);
  console.log('[db] pgcrypto extension ready');
}

main().catch((error) => {
  const stderr = (error as { stderr?: string }).stderr ?? '';
  console.error('[db] could not create the database');
  console.error(stderr.trim() || (error as Error).message);
  console.error('\nIs Postgres running? Start it with:');
  console.error('  brew services start postgresql@18');
  console.error('\nIf psql is not on your PATH, the Homebrew tools live in:');
  console.error('  /opt/homebrew/opt/postgresql@18/bin');
  console.error('\nOr create the database yourself:');
  console.error('  createdb safety');
  process.exitCode = 1;
});