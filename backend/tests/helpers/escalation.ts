import { eq } from 'drizzle-orm';

import { alerts } from '../../src/db/schema.js';
import type { TestDatabaseHandle } from './test-db.js';

/**
 * Ages an alert so the escalation sweep considers it overdue.
 *
 * The worker normally runs on a 60s timer, so tests move created_at instead of
 * waiting for the clock.
 */
export async function backdateAlert(
  testDb: TestDatabaseHandle,
  alertId: string,
  minutes: number,
): Promise<void> {
  await testDb.client.exec(
    `UPDATE alerts SET created_at = now() - interval '${minutes} minutes' WHERE id = '${alertId}'`,
  );
}

/** Reads an alert straight from the database, bypassing HTTP. */
export async function readAlert(
  testDb: TestDatabaseHandle,
  alertId: string,
): Promise<typeof alerts.$inferSelect | undefined> {
  const [row] = await testDb.db.select().from(alerts).where(eq(alerts.id, alertId)).limit(1);
  return row;
}

