import { defineConfig } from 'drizzle-kit';

/**
 * Config for `npm run db:generate`, which turns the TypeScript table
 * definitions in src/db/schema.ts into the SQL files in ./drizzle.
 *
 * `strict` matters here: it makes drizzle-kit report anything ambiguous instead
 * of picking a name for you, because a migration named by guesswork is one you
 * will not recognise in a diff six months from now.
 */
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    // Only read by `drizzle-kit push`/`check`. Generation itself needs no
    // connection, so a blank DATABASE_URL is not an error.
    url: process.env.DATABASE_URL ?? 'postgresql://mokosh@localhost:5432/mokosh',
  },
  strict: true,
  verbose: true,
});