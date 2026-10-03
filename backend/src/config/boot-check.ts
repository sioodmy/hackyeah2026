/**
 * Imported by tests/env.test.ts in a child process, purely to prove that `env`
 * accepts or rejects a given environment. Not part of the running app.
 */
import { apnsConfigured, env, fcmConfigured } from './env.js';

console.log(
  JSON.stringify({
    port: env.PORT,
    apnsConfigured,
    fcmConfigured,
    escalateDangerAfter: env.ESCALATE_DANGER_AFTER_MINUTES,
  }),
);