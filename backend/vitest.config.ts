import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Each file gets a real Postgres (PGlite) and its own JWT keypair, which
    // is too heavy to share across parallel workers.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Config validates the environment on import. CLERK_JWKS_URL is overwritten
    // by the Clerk stub, but the module still needs a syntactically valid one.
    // Push credentials are deliberately left blank here; suites that exercise
    // delivery install generated keys before importing the app.
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'fatal',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      CLERK_JWKS_URL: 'http://127.0.0.1:1/.well-known/jwks.json',
      FCM_PROJECT_ID: '',
      FCM_CLIENT_EMAIL: '',
      FCM_PRIVATE_KEY: '',
    },
  },
});