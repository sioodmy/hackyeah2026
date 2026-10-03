import { and, eq, inArray } from 'drizzle-orm';

import { emailTransport } from '../core/email.js';
import { env } from '../config/env.js';
import {
  alertLevelName,
  notificationPriority,
  devices,
  EMAIL_ALERT_LEVELS,
  type Alert,
  type Contact,
  type Device,
} from '../db/schema.js';
import { db } from '../db/client.js';
import { findById } from './user.service.js';
import { sendApns } from '../core/push/apns.js';
import { sendFcm } from '../core/push/fcm.js';

export type NotificationPriority = 'normal' | 'high' | 'critical';

/**
 * What the mobile app receives. This is the contract: fields can be added,
 * but the mobile team's parsing depends on these names.
 */
export interface AlertPushPayload {
  type: 'ALERT';
  alert_id: string;
  level: number;
  level_name: string;
  sender_name: string;
  sender_phone: string | null;
  location: { lat: number | null; lng: number | null; address: string | null };
  message: string | null;
  created_at: string;
  priority: NotificationPriority;
}

export interface AckPushPayload {
  type: 'ALERT_ACKNOWLEDGED';
  alert_id: string;
  level: number;
  contact_name: string;
  priority: 'high';
}

export function buildAlertPayload(
  alert: Alert,
  sender: { name: string; phone: string | null },
): AlertPushPayload {
  return {
    type: 'ALERT',
    alert_id: alert.id,
    level: alert.level,
    level_name: alertLevelName(alert.level),
    sender_name: sender.name || 'Someone',
    sender_phone: sender.phone,
    location: { lat: alert.lat, lng: alert.lng, address: alert.address },
    message: alert.message,
    created_at: alert.createdAt.toISOString(),
    priority: notificationPriority(alert.level),
  };
}

/** Human text for the notification body, since the app may not be running. */
export function notificationText(
  payload: AlertPushPayload | AckPushPayload,
): { title: string; body: string } {
  if (payload.type === 'ALERT_ACKNOWLEDGED') {
    return {
      title: 'Someone is on the way',
      body: `${payload.contact_name} acknowledged your alert.`,
    };
  }

  const title = `${payload.sender_name} needs help`;
  switch (payload.level) {
    case 4:
      return { title, body: payload.message ?? 'EMERGENCY - immediate help needed' };
    case 3:
      return { title, body: payload.message ?? 'Someone is following her. Real danger.' };
    case 2:
      return { title, body: payload.message ?? 'She does not feel safe. Please check on her.' };
    default:
      return {
        title,
        body: payload.message ?? 'She feels uncomfortable and asked you to call her.',
      };
  }
}

/**
 * Fans one alert out to every contact that has an account with the app.
 * Push failures are logged, never thrown: the alert is already recorded.
 */
export async function notifyContactsOfAlert(
  alert: Alert,
  contacts: Contact[],
): Promise<void> {
  const sender = await findById(alert.userId);
  const payload = buildAlertPayload(alert, {
    name: sender?.name ?? '',
    phone: sender?.phone ?? null,
  });

  const recipients = new Set(
    contacts.map((contact) => contact.contactUserId).filter((id): id is string => Boolean(id)),
  );
  for (const recipient of recipients) {
    await pushToUser(recipient, payload);
  }

  await emailContactsOfDangerAlert(alert, contacts, payload);

  if (alert.level === 4) {
    await callEmergencyWebhook(payload);
  }
}

/**
 * Danger and omega alerts also go out by email.
 *
 * Push is useless when the phone is off, in a dead zone or on a dead battery,
 * which is precisely when an emergency alert is worth sending. Email reaches the
 * device over the carrier network, and a link in the message opens the app.
 */
async function emailContactsOfDangerAlert(
  alert: Alert,
  contacts: Contact[],
  payload: AlertPushPayload,
): Promise<void> {
  if (!EMAIL_ALERT_LEVELS.has(alert.level)) return;

  const addresses = new Set<string>();
  for (const contact of contacts) {
    // Prefer the address chosen for this contact; fall back to their own.
    const address = contact.notifyEmail ?? contact.email ?? null;
    if (address) addresses.add(address);
  }
  if (addresses.size === 0) return;

  const text = dangerAlertEmail(payload);
  const subject = `${payload.sender_name} - ${ALERT_EMAIL_SUBJECTS[payload.level]}`;

  const transport = emailTransport(env);
  await Promise.all(
    [...addresses].map(async (to) => {
      try {
        await transport.send({ to, subject, text });
      } catch (error) {
        // A refused email must not undo the push that already went out.
        console.error(`[email] danger alert to ${to} failed`, error);
      }
    }),
  );
}

const ALERT_EMAIL_SUBJECTS: Record<number, string> = {
  3: 'is in real danger',
  4: 'needs help NOW',
};

function dangerAlertEmail(payload: AlertPushPayload): string {
  const where = payload.location.address
    ? payload.location.address
    : payload.location.lat !== null && payload.location.lng !== null
      ? `${payload.location.lat}, ${payload.location.lng}`
      : 'her location is not available';

  const lines = [
    `${payload.sender_name} raised a level ${payload.level} alert (${payload.level_name}).`,
    '',
    `Where: ${where}`,
  ];
  if (payload.message) lines.push(`She wrote: ${payload.message}`);
  if (payload.sender_phone) lines.push(`Call her: ${payload.sender_phone}`);

  lines.push(
    '',
    'Open the app to acknowledge and follow her location.',
    `Alert raised at ${payload.created_at}.`,
    '',
    'You are receiving this because you are a trusted contact.',
  );

  return lines.join('\n');
}

/**
 * Pushes to every active device of a user.
 *
 * Delivery is best-effort by design: the alert row is already saved, and a
 * broken or unconfigured push provider must never turn a 201 into a 500. The
 * person who pressed the button has to get her response either way.
 */
export async function pushToUser(
  userId: string,
  payload: AlertPushPayload | AckPushPayload,
): Promise<void> {
  const tokens = await db.query.devices.findMany({
    where: and(eq(devices.userId, userId), eq(devices.isActive, true)),
  });
  if (tokens.length === 0) return;

  const critical = payload.priority === 'critical';
  const body = {
    ...payload,
    ...notificationText(payload),
  };

  const dead: string[] = [];
  await Promise.all(
    tokens.map(async (device) => {
      const result = await deliver(device, body, critical);
      if (result.tokenInvalid) dead.push(device.token);
    }),
  );

  if (dead.length > 0) await deactivateTokens(dead);
}

async function deliver(
  device: Device,
  body: Record<string, unknown>,
  critical: boolean,
): Promise<{ tokenInvalid: boolean }> {
  try {
    return device.platform === 'ios'
      ? await sendApns(device.token, body, critical)
      : await sendFcm(device.token, body, critical);
  } catch (error) {
    // Missing credentials, an outage, a malformed key: the token stays
    // registered, because the cause is ours and not the device's.
    console.error(`[push] ${device.platform} delivery to ${device.token} failed`, error);
    return { tokenInvalid: false };
  }
}

export async function deactivateTokens(tokens: string[]): Promise<void> {
  await db
    .update(devices)
    .set({ isActive: false })
    .where(inArray(devices.token, tokens));
}

/**
 * Optional integration point for omega alerts: a service that can dispatch
 * a real responder. Best-effort, never blocks the response.
 */
async function callEmergencyWebhook(payload: AlertPushPayload): Promise<void> {
  if (!env.EMERGENCY_WEBHOOK_URL) return;
  try {
    await fetch(env.EMERGENCY_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(env.EMERGENCY_WEBHOOK_SECRET && {
          'x-webhook-secret': env.EMERGENCY_WEBHOOK_SECRET,
        }),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    console.error('[push] emergency webhook failed', error);
  }
}