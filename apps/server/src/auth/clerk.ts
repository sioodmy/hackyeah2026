import { verifyToken } from "@clerk/backend";
import { eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";

import { config } from "../config.js";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";

export interface Principal {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    principal: Principal;
  }
}

function bearer(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

/**
 * Accepts either a Clerk session JWT or, in dev mode, a plain `x-dev-user`
 * header. The dev path exists so two phones can be demoed without provisioning
 * Clerk keys.
 */
async function identify(request: FastifyRequest): Promise<Principal | null> {
  if (config.isDevAuth) {
    const header = request.headers["x-dev-user"];
    const id = typeof header === "string" ? header : undefined;
    if (!id) return null;

    const nameHeader = request.headers["x-dev-user-name"];
    const name = typeof nameHeader === "string" ? nameHeader : null;

    return upsertUser(id, name);
  }

  const token = bearer(request);
  if (!token) return null;

  try {
    const claims = await verifyToken(token, {
      secretKey: config.CLERK_SECRET_KEY,
    });

    return upsertUser(
      claims.sub,
      typeof claims.nickname === "string" ? claims.nickname : claimName(claims),
    );
  } catch {
    return null;
  }
}

function claimName(claims: Record<string, unknown>): string | null {
  for (const key of ["first_name", "name", "username"]) {
    const value = claims[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

async function upsertUser(
  id: string,
  displayName: string | null,
): Promise<Principal> {
  const existing = await db.query.users.findFirst({ where: eq(users.id, id) });

  const name = displayName?.trim() || existing?.displayName || "Anonimowa";

  const [row] = await db
    .insert(users)
    .values({ id, displayName: name, avatarUrl: existing?.avatarUrl ?? null })
    .onConflictDoUpdate({
      target: users.id,
      set: { displayName: name, updatedAt: new Date() },
    })
    .returning();

  if (!row) throw new Error("Nie udało się zapisać użytkownika");

  return {
    id: row.id,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  };
}

export async function requireUser(request: FastifyRequest): Promise<Principal> {
  if (request.principal) return request.principal;

  const principal = await identify(request);
  if (!principal) {
    const error = new Error("Brak uwierzytelnienia") as Error & {
      statusCode: number;
      code: string;
    };
    error.statusCode = 401;
    error.code = "unauthorized";
    throw error;
  }

  request.principal = principal;
  return principal;
}

/** Auth for the websocket upgrade, where the token may arrive as a query param. */
export async function identifyUpgrade(
  tokenFromQuery: string | undefined,
  request: FastifyRequest,
): Promise<Principal | null> {
  if (tokenFromQuery && !config.isDevAuth) {
    try {
      const claims = await verifyToken(tokenFromQuery, {
        secretKey: config.CLERK_SECRET_KEY,
      });
      return upsertUser(claims.sub, claimName(claims));
    } catch {
      return null;
    }
  }

  return identify(request);
}
