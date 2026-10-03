import { buildApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase, isDatabaseHealthy } from "./db/client.js";

const app = await buildApp();

try {
  await app.listen({ port: config.PORT, host: config.HOST });
} catch (error) {
  app.log.error({ err: error }, "nie udało się uruchomić serwera");
  process.exit(1);
}

if (!(await isDatabaseHealthy())) {
  app.log.warn(
    "Baza danych nie odpowiada — uruchom `docker compose up -d postgres`",
  );
}

const shutdown = async (signal: string): Promise<void> => {
  app.log.info(`${signal} — zamykam serwer`);
  await app.close();
  await closeDatabase();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
