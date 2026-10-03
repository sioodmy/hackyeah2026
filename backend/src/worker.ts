import { closeDatabase } from './db/client.js';
import { escalateDueAlerts } from './services/alert.service.js';

/**
 * The escalation sweep: alerts nobody answered climb a level, and the contacts
 * get told again.
 *
 * This is what protects someone whose phone is asleep — the app holds no
 * connection open, so the backend has to be the thing that keeps watching.
 * Deliberately a plain interval rather than a job queue: the whole job is
 * "every minute, sweep for overdue alerts", which needs no broker, no
 * serialisation and no Redis.
 */

const SWEEP_INTERVAL_MS = 60_000;

/** Overlapping sweeps would double-notify contacts, so only one runs at a time. */
let sweeping = false;

async function sweep(): Promise<void> {
  if (sweeping) {
    console.warn('[worker] previous sweep still running, skipping this tick');
    return;
  }
  sweeping = true;

  try {
    const escalated = await escalateDueAlerts();
    for (const alert of escalated) {
      console.warn(
        `[worker] alert ${alert.escalatedFromId} escalated to level ${alert.level} for user ${alert.userId}`,
      );
    }
    if (escalated.length > 0) {
      console.log(`[worker] escalated ${escalated.length} alert(s)`);
    }
  } catch (error) {
    // Never let one bad sweep kill the loop; the next tick retries.
    console.error('[worker] escalation sweep failed', error);
  } finally {
    sweeping = false;
  }
}

function scheduleNext(): void {
  setTimeout(async () => {
    await sweep();
    scheduleNext();
  }, SWEEP_INTERVAL_MS).unref();
}

async function main(): Promise<void> {
  await sweep();
  scheduleNext();
  console.log(`[worker] escalation sweep running every ${SWEEP_INTERVAL_MS / 1000}s`);

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, shutting down`);
    await closeDatabase();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('[worker] failed to start', error);
  process.exit(1);
});