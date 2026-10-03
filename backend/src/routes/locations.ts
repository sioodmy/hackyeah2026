import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import type { WebSocket } from 'ws';
import { z } from 'zod';

import { verifyClerkToken } from '../core/clerk.js';
import { registry, type WireFrame } from '../core/realtime.js';
import {
  friendsWithAccounts,
  profileOf,
  replayFor,
  snapshotFor,
  storePing,
  toFrame,
} from '../services/location.service.js';
import { upsertFromClerk } from '../services/user.service.js';

const locationIn = z.object({
  type: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  acc: z.number().nonnegative().nullish(),
  bearing: z.number().min(-360).max(360).nullish(),
  seq: z.number().int().nonnegative().nullish(),
  ts: z.number().nullish(),
  alertId: z.string().uuid().nullish(),
});

const locationSchema = z.object({
  userId: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  acc: z.number().nullable(),
  bearing: z.number().nullable(),
  seq: z.number().nullable(),
  ts: z.number().nullable(),
  lastUpdate: z.string(),
});

const errorResponse = {
  400: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
  401: z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
};

/** 1008 = policy violation, the code the handshake uses for auth failures. */
const WS_CLOSE_UNAUTHORIZED = 1008;

export const locationRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * HTTP fallback for the socket.
   *
   * The WebSocket is the normal path, but a captive portal or a sleeping phone
   * can block the upgrade. Posting the position still moves the marker, so the
   * map degrades instead of going blank.
   */
  app.post(
    '/locations/ping',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['locations'],
        summary: 'Submit a live position',
        description: [
          'Fallback for when the WebSocket cannot be established. Fans the',
          'position out to accepted contacts exactly as the socket would.',
        ].join('\n'),
        body: locationIn,
        response: { 202: z.object({ ok: z.boolean(), id: z.number() }), ...errorResponse },
      },
    },
    async (request, reply) => {
      const ping = await storePing(request.user.id, request.body);
      const profile = await profileOf(request.user.id);
      const friends = await friendsWithAccounts(request.user.id);
      registry.fanout(friends, toFrame(request.user.id, ping, profile), request.user.id);

      return reply.status(202).send({ ok: true, id: ping.id });
    },
  );

  app.get(
    '/locations/snapshot',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['locations'],
        summary: 'Last known position of every contact',
        description: [
          'One position per accepted contact, newest first. A contact who has',
          'never sent a ping is absent rather than returned as "safe", so this',
          'response cannot be used to enumerate people.',
        ].join('\n'),
        response: { 200: z.object({ locations: z.array(locationSchema) }), ...errorResponse },
      },
    },
    async (request) => ({ locations: await snapshotFor(request.user.id) }),
  );

  /**
   * Live positions over a native WebSocket.
   *
   * Auth arrives as `?token=<clerk session jwt>` because React Native's
   * WebSocket cannot be relied on to send custom headers.
   *
   * Protocol (JSON text frames):
   *
   *   client -> server
   *     {"type":"location","lat":52.23,"lng":21.01,"acc":12,"seq":7,"ts":1730.0}
   *     {"type":"pong"}
   *
   *   server -> client
   *     {"type":"hello","self":"…","friends":[…],"friendIds":[…],"serverTs":…}
   *     {"type":"ack","seq":7}
   *     {"type":"location","userId":"…","lat":…,"lng":…}
   *     {"type":"ping"}
   */
  app.get('/ws/locations', { websocket: true }, (socket: WebSocket, request) => {
    void serveSocket(socket, request.query as { token?: string }).catch(() => {
      socket.close(1011, 'internal error');
    });
  });
};

/**
 * Socket lifecycle.
 *
 * Separate from the route handler so a test can drive it with a fake socket
 * instead of standing up a real server.
 */
export async function serveSocket(
  socket: WebSocket,
  query: { token?: string } | undefined,
): Promise<void> {
  if (!query?.token) {
    socket.close(WS_CLOSE_UNAUTHORIZED, 'missing token');
    return;
  }

  let userId: string;
  try {
    const claims = await verifyClerkToken(query.token);
    const { user } = await upsertFromClerk(claims);
    userId = user.id;
  } catch {
    socket.close(WS_CLOSE_UNAUTHORIZED, 'unauthorized');
    return;
  }

  const sub = registry.subscribe(userId, socket);
  const send = (frame: WireFrame) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(frame));
  };

  const heartbeat = setInterval(() => send({ type: 'ping', ts: Date.now() / 1000 }), 25_000);

  try {
    const friends = await friendsWithAccounts(userId);
    const profiles = await Promise.all(friends.map(async (id) => ({ id, ...(await profileOf(id)) })));

    send({
      type: 'hello',
      self: userId,
      friends: profiles.map((p) => ({
        id: p.id,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
      })),
      friendIds: friends,
      serverTs: Date.now() / 1000,
    });

    // Replay so a reconnecting phone does not show an empty map until the next
    // ping interval.
    for (const location of await replayFor(userId, 20)) {
      send({ type: 'location', ...location });
    }
  } catch (error) {
    socket.close(1011, 'friend lookup failed');
    return;
  } finally {
    registry.unsubscribe(sub);
  }

  const onMessage = (data: unknown) => {
    void handleFrame(userId, String(data), send);
  };

  socket.on('message', onMessage);

  await new Promise<void>((resolve) => {
    socket.once('close', resolve);
    socket.once('error', resolve);
  }).finally(() => {
    clearInterval(heartbeat);
    socket.off('message', onMessage);
    registry.unsubscribe(sub);
  });
}

/**
 * Handle one inbound frame.
 *
 * Split out from the socket lifecycle so the ping path is testable without a
 * real WebSocket.
 */
export async function handleFrame(
  userId: string,
  raw: string,
  send: (frame: WireFrame) => void,
): Promise<void> {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    send({ type: 'error', message: 'invalid frame' });
    return;
  }

  const kind = (decoded as { type?: unknown } | null)?.type;
  if (kind === 'pong') return;

  if (kind !== 'location') {
    send({ type: 'error', message: `unknown type ${String(kind)}` });
    return;
  }

  const parsed = locationIn.safeParse(decoded);
  if (!parsed.success) {
    send({ type: 'error', message: 'invalid frame' });
    return;
  }

  try {
    const ping = await storePing(userId, parsed.data);
    const profile = await profileOf(userId);
    const friends = await friendsWithAccounts(userId);
    // Ack first so the client knows the sample was stored, not just queued.
    send({ type: 'ack', seq: ping.seq });
    registry.fanout(friends, toFrame(userId, ping, profile), userId);
  } catch {
    send({ type: 'error', message: 'could not store position' });
  }
}