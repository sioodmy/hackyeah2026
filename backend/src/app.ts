import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyInstance } from "fastify";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type FastifyPluginAsyncZod,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";

import { env, isProduction } from "./config/env.js";
import { AppError } from "./core/errors.js";
import authPlugin from "./plugins/auth.js";
import { alertRoutes } from "./routes/alerts.js";
import { authRoutes } from "./routes/auth.js";
import { contactRoutes } from "./routes/contacts.js";
import { deviceRoutes } from "./routes/devices.js";
import { incidentRoutes } from "./routes/incidents.js";
import { inviteRoutes } from "./routes/invites.js";
import { locationRoutes } from "./routes/locations.js";
import { userRoutes } from "./routes/users.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: isProduction
      ? { level: env.LOG_LEVEL }
      : { level: env.LOG_LEVEL, transport: { target: "pino-pretty" } },
    bodyLimit: 256 * 1024,
  }).withTypeProvider<ZodTypeProvider>();

  // Zod is both the validator and the source of truth for the OpenAPI spec,
  // so a route's schema and its documentation cannot drift apart.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, { origin: true });
  // Registered before the routes: the socket lives at the app root, not under
  // the API prefix, because the mobile WebSocket client cannot rewrite its URL.
  await app.register(websocket);

  await app.register(swagger, {
    openapi: {
      info: {
        title: "Safety Alert API",
        description: [
          "Backend for the women's safety app.",
          "",
          "Clients raise alerts over REST; trusted contacts are reached through",
          "APNs (iOS) and FCM (Android) push notifications. Authentication is",
          "handled by Clerk - send the session JWT as `Authorization: Bearer <token>`.",
          "",
          "There is no WebSocket layer: the phone sleeps, the backend keeps watch.",
        ].join("\n"),
        version: "0.1.0",
      },
      servers: [{ url: "http://localhost:3000", description: "Local" }],
      tags: [
        { name: "meta", description: "Health and readiness" },
        { name: "auth", description: "Clerk session verification" },
        { name: "users", description: "Local mirror of the Clerk profile" },
        { name: "contacts", description: "Trusted contacts who get alerted" },
        { name: "devices", description: "Push token registration" },
        {
          name: "alerts",
          description: "Raising, acknowledging and resolving alerts",
        },
        {
          name: "friends",
          description:
            "Invite codes and the friend list that decides who sees your alerts",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { docExpansion: "list", deepLinking: true },
  });

  await app.register(authPlugin);

  app.setErrorHandler((rawError, request, reply) => {
    if (rawError instanceof AppError) {
      return reply.status(rawError.statusCode).send(rawError.toJSON());
    }

    const error = rawError as Error & { statusCode?: number; code?: string };
    const status = error.statusCode ?? 500;
    if (status >= 500) request.log.error({ err: error }, "unhandled error");

    return reply.status(status).send({
      error: {
        code:
          error.code ?? (status >= 500 ? "internal_error" : "request_error"),
        message:
          status >= 500 && isProduction
            ? "Internal server error"
            : error.message,
      },
    });
  });

  const healthHandler = async () => ({
    ok: true,
    database: true,
    status: "ok",
  });

  app.get(
    "/health",
    { schema: { tags: ["meta"], summary: "Liveness probe" } },
    healthHandler,
  );
  app.get(
    "/healthz",
    { schema: { tags: ["meta"], summary: "Health probe" } },
    healthHandler,
  );

  const api: FastifyPluginAsyncZod = async (instance, opts) => {
    await authRoutes(instance, opts);
    await userRoutes(instance, opts);
    await contactRoutes(instance, opts);
    await deviceRoutes(instance, opts);
    await alertRoutes(instance, opts);
    await inviteRoutes(instance, opts);
    await locationRoutes(instance, opts);
    await incidentRoutes(instance, opts);
  };

  await app.register(api, { prefix: env.API_PREFIX });

  return app;
}
