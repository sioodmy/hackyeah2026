import { z } from "zod";

const bool = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === "string" ? value === "1" || value === "true" : value,
  );

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z
    .string()
    .default("postgres://safecall:safecall@localhost:5432/safecall"),
  CLERK_SECRET_KEY: z.string().default(""),
  DEV_AUTH: bool.default(false),
  INVITE_SIGNING_SECRET: z.string().default("safe-call-dev-invite-secret"),
  EXPO_ACCESS_TOKEN: z.string().default(""),
  CORS_ORIGIN: z.string().default("*"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Nieprawidłowe zmienne środowiskowe:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  isDevAuth: parsed.data.DEV_AUTH || parsed.data.CLERK_SECRET_KEY.length === 0,
} as const;
