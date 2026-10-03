/**
 * Test-only push credentials.
 *
 * `env.ts` snapshots process.env at import time, so keys have to be in place
 * before the app is imported. Generating real keys here means the APNs
 * provider-token signing and the FCM OAuth2 assertion are genuinely exercised
 * rather than stubbed.
 */
import { exportPKCS8, generateKeyPair } from 'jose';

let installed = false;

export async function installPushCredentials(): Promise<void> {
  if (installed) return;

  // APNs signs with ES256; FCM's JWT-bearer assertion uses RS256.
  const ec = await generateKeyPair('ES256', { extractable: true });
  const rsa = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });

  process.env.APNS_KEY_ID = 'TESTKEYID';
  process.env.APNS_TEAM_ID = 'TESTTEAMID';
  process.env.APNS_BUNDLE_ID = 'com.example.safety.test';
  process.env.APNS_PRIVATE_KEY = await exportPKCS8(ec.privateKey);

  process.env.FCM_PROJECT_ID = 'safety-test';
  process.env.FCM_CLIENT_EMAIL = 'test@safety-test.iam.gserviceaccount.com';
  process.env.FCM_PRIVATE_KEY = await exportPKCS8(rsa.privateKey);

  installed = true;
}