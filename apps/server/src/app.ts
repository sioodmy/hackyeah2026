import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { ZodError } from "zod";

import { config } from "./config.js";
import { isDatabaseHealthy } from "./db/client.js";
import { hub, startHeartbeat } from "./realtime/hub.js";
import { realtimeRoutes } from "./realtime/routes.js";
import { alertRoutes, deviceRoutes, locationRoutes } from "./routes/alerts.js";
import { contactsRoutes } from "./routes/contacts.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.isProduction
        ? undefined
        : {
            target: "pino-pretty",
            options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
          },
    },
  });

  await app.register(cors, {
    origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN.split(","),
    credentials: true,
  });
  await app.register(websocket, {
    options: { maxPayload: 64 * 1024 },
  });

  app.get("/health", async () => ({
    ok: true,
    db: await isDatabaseHealthy(),
    uptime: Math.round(process.uptime()),
    sockets: hub.connectionCount,
  }));

  app.setErrorHandler((rawError: FastifyError | ZodError, request, reply) => {
    if (rawError instanceof ZodError) {
      const error = rawError;
      return reply.code(400).send({
        error: {
          message: "Nieprawidłowe dane",
          code: "validation_error",
          issues: error.issues,
        },
      });
    }

    const error = rawError as FastifyError;
    const status = error.statusCode ?? 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;

    request.log.error({ err: error }, "błąd żądania");

    return reply.code(safeStatus).send({
      error: {
        message:
          safeStatus === 500
            ? "Coś poszło nie tak po naszej stronie"
            : error.message,
        code:
          error.code ??
          (safeStatus === 500 ? "internal_error" : "request_error"),
      },
    });
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({
      error: { message: "Nie znaleziono zasobu", code: "not_found" },
    }),
  );

  await app.register(contactsRoutes);
  await app.register(alertRoutes);
  await app.register(locationRoutes);
  await app.register(deviceRoutes);
  await app.register(realtimeRoutes);

  startHeartbeat();

  return app;
}
