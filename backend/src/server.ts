import { buildApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase } from './db/client.js';

async function main(): Promise<void> {
  const app = await buildApp();

  // Stop accepting connections, then drain the pool.
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    try {
      await app.close();
      await closeDatabase();
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, 'shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (error) {
    app.log.error({ err: error }, 'failed to start');
    process.exit(1);
  }
}

main();