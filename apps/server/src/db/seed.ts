import { randomUUID } from "node:crypto";

import { config } from "../config.js";
import { db, sql } from "./client.js";
import { friendships, locations, users } from "./schema.js";

/**
 * Two demo identities that are already friends, so two handsets can be pointed
 * at each other without scanning anything during the demo.
 */
const DEMO_USERS = [
  { id: "demo-anna", displayName: "Anna" },
  { id: "demo-marta", displayName: "Marta" },
];

const WARSAW = { lat: 52.2297, lng: 21.0122 };

async function main(): Promise<void> {
  if (!config.isDevAuth) {
    console.warn("Seed działa na DEV_AUTH — Clerk nie jest skonfigurowany.");
  }

  for (const user of DEMO_USERS) {
    await db
      .insert(users)
      .values(user)
      .onConflictDoUpdate({
        target: users.id,
        set: { displayName: user.displayName, updatedAt: new Date() },
      });

    await db
      .insert(locations)
      .values({
        userId: user.id,
        ...WARSAW,
        accuracy: 12,
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  const [anna, marta] = DEMO_USERS;
  if (anna && marta) {
    await db
      .insert(friendships)
      .values([
        { ownerId: anna.id, friendId: marta.id, status: "accepted" },
        { ownerId: marta.id, friendId: anna.id, status: "accepted" },
      ])
      .onConflictDoNothing();

    await db
      .insert(friendships)
      .values({ ownerId: "dev-local-user", friendId: anna.id })
      .onConflictDoNothing();
  }

  const total = await sql<
    { count: string }[]
  >`SELECT count(*)::text AS count FROM users`;
  console.log(`Gotowe. Użytkowników w bazie: ${total[0]?.count ?? "?"}.`);
  console.log(`Zaproszenie demonstracyjne: ${randomUUID().slice(0, 8)}`);

  await sql.end({ timeout: 5 });
}

main().catch((error: unknown) => {
  console.error("Seed nie powiódł się:", error);
  process.exit(1);
});
