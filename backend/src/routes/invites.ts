import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { env } from '../config/env.js';
import type { InviteCode } from '../db/schema.js';
import { BadRequestError, NotFoundError } from '../core/errors.js';
import {
  createInviteBody,
  friendParams,
  friendRequestIdParams,
  friendshipSchema,
  friendRequestSchema,
  inviteCodeParams,
  inviteCodeSchema,
  inviteLinkSchema,
  listRequestsQuery,
  redeemInviteBody,
  requestFriendSchema,
  updateFriendBody,
} from '../schemas.js';
import {
  createInviteCode,
  isRedeemable,
  listInviteCodes,
  peekInviteCode,
  revokeInviteCode,
} from '../services/invite.service.js';
import { buildInviteLinks, extractCode } from '../services/invite-link.service.js';
import {
  acceptRequest,
  cancelRequest,
  countRequests,
  declineRequest,
  listIncoming,
  listOutgoing,
  requestFriendship,
} from '../services/friend-request.service.js';
import {
  listFriendships,
  removeFriend,
  updateFriendSettings,
} from '../services/invite.service.js';

const errorResponse = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

function publicCode(code: InviteCode, inviterName?: string | null) {
  const base = env.PUBLIC_BASE_URL ?? 'https://api.safetyapp.example';

  return {
    id: code.id,
    code: code.code,
    maxUses: code.maxUses,
    usedCount: code.usedCount,
    requiresApproval: code.requiresApproval,
    expiresAt: code.expiresAt,
    revokedAt: code.revokedAt,
    redeemable: isRedeemable(code),
    /** Exactly what to render as the QR image. */
    qrPayload: `${base}/api/v1/invites/redeem/${code.code}`,
    /** Web and deep links, for sending the invite over SMS or chat. */
    links: buildInviteLinks({
      baseUrl: base,
      code: code.code,
      appScheme: env.APP_LINK_SCHEME,
      inviterName,
    }),
  };
}

export const inviteRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Creates a code to show as a QR image or send as a link. Scanning it files a
   * request; the two of them become friends only once the owner accepts.
   */
  app.post(
    '/invites',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Create an invite code',
        description: [
          'Returns the short code, the string to render as a QR code, and web',
          'and deep links for sending the invite over SMS, chat or email.',
          '',
          'Single-use and valid for 24 hours by default: a photo of the screen',
          'should not stay useful forever. Pass `maxUses` to share one code with',
          'several people, and `requiresApproval: false` to skip the accept step.',
        ].join('\n'),
        body: createInviteBody,
        response: { 201: inviteCodeSchema, 400: errorResponse },
      },
    },
    async (request, reply) => {
      const code = await createInviteCode(request.user.id, request.body);
      return reply.status(201).send(publicCode(code, request.user.name));
    },
  );

  app.get(
    '/invites',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'List own invite codes',
        response: { 200: z.array(inviteCodeSchema) },
      },
    },
    async (request) => {
      const codes = await listInviteCodes(request.user.id);
      return codes.map((code) => publicCode(code, request.user.name));
    },
  );

  /** A ready-made link pair for an existing code, for the share sheet. */
  app.post(
    '/invites/:codeId/links',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Get shareable links for a code',
        description: 'For the share sheet, without creating a new code.',
        params: inviteCodeParams,
        response: { 200: inviteLinkSchema, 404: errorResponse },
      },
    },
    async (request) => {
      const codes = await listInviteCodes(request.user.id);
      const code = codes.find((row) => row.id === request.params.codeId);
      if (!code) throw new BadRequestError('Invite code not found');

      return buildInviteLinks({
        baseUrl: env.PUBLIC_BASE_URL ?? 'https://api.safetyapp.example',
        code: code.code,
        appScheme: env.APP_LINK_SCHEME,
        inviterName: request.user.name,
      });
    },
  );

  app.delete(
    '/invites/:codeId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Cancel an invite code',
        description: 'Stops anyone else from using it. Existing friends are unaffected.',
        params: inviteCodeParams,
      },
    },
    async (request, reply) => {
      await revokeInviteCode(request.user.id, request.params.codeId);
      return reply.status(204).send();
    },
  );

  /**
   * Redeems a scanned or pasted code.
   *
   * Files a request rather than linking immediately: an invite is also a request
   * for access to someone's live location, so the owner decides.
   *
   * Accepts the bare code, the full web link, or the deep link, because people
   * paste all three.
   */
  app.post(
    '/invites/redeem',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Redeem an invite code',
        description: [
          'Files a friend request. Nothing is shared until the code owner',
          'accepts it, which they do from their pending list.',
          '',
          'Accepts a bare code (`K7M2XPQ4`), the web link, or the deep link.',
          'Re-scanning while a request is pending returns the same request',
          'rather than creating a duplicate.',
        ].join('\n'),
        body: redeemInviteBody,
        response: {
          200: requestFriendSchema,
          400: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    async (request) => {
      const code = extractCode(request.body.code);
      if (!code) {
        throw new BadRequestError('That does not look like an invite code or link');
      }

      const result = await requestFriendship(
        request.user.id,
        code,
        request.body.message,
      );

      return {
        request: result.request,
        alreadyRequested: result.alreadyRequested,
        status: result.request.request.status,
      };
    },
  );

  /**
   * Deep-link target: confirm a code is live before committing to it.
   *
   * The code is a query parameter, not a path segment, because a pasted web
   * link contains slashes and a scheme that cannot survive a single path
   * segment.
   */
  app.get(
    '/invites/preview',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Look up an invite code',
        description:
          'Lets the app show "Jane wants you as an emergency contact" with a confirm button, before filing the request.',
        querystring: z.object({ code: z.string().min(4).max(512) }),
        response: {
          200: z.object({
            code: z.string(),
            redeemable: z.boolean(),
            requiresApproval: z.boolean(),
            owner: z.object({
              id: z.uuid(),
              name: z.string(),
              avatarUrl: z.string().nullable(),
            }),
          }),
          400: errorResponse,
          404: errorResponse,
        },
      },
    },
    async (request) => {
      const code = extractCode(request.query.code);
      if (!code) {
        throw new BadRequestError('That does not look like an invite code or link');
      }
      const invite = await peekInviteCode(code);

      return {
        code: invite.code,
        redeemable: isRedeemable(invite),
        requiresApproval: invite.requiresApproval,
        owner: {
          id: invite.ownerId,
          name: invite.ownerName,
          avatarUrl: invite.ownerAvatarUrl,
        },
      };
    },
  );

  /* ------------------------------------------------------ friend requests -- */

  app.get(
    '/friends/requests',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'List friend requests',
        description: '`direction=incoming` is the inbox to answer; `outgoing` is what you are waiting on.',
        querystring: listRequestsQuery,
        response: { 200: z.array(friendRequestSchema) },
      },
    },
    async (request) => {
      const { direction, status } = request.query;
      const view = direction === 'incoming' ? listIncoming : listOutgoing;
      return view(request.user.id, status);
    },
  );

  app.get(
    '/friends/requests/count',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Count pending requests',
        description: 'For the badge on the friends tab.',
        response: {
          200: z.object({ incoming: z.number(), outgoing: z.number() }),
        },
      },
    },
    async (request) => {
      const incoming = await countRequests(request.user.id, 'incoming');
      const outgoing = await countRequests(request.user.id, 'outgoing');
      return { incoming, outgoing };
    },
  );

  /** Accepting is what actually creates the two-way alert link. */
  app.post(
    '/friends/requests/:requestId/accept',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Accept a friend request',
        description:
          'Only the person who received the request can accept. Creates the link in both directions.',
        params: friendRequestIdParams,
        response: { 200: z.object({ friendship: friendshipSchema }), 403: errorResponse, 404: errorResponse, 409: errorResponse },
      },
    },
    async (request) => {
      const result = await acceptRequest(request.params.requestId, request.user.id);

      // Shape the friend the same way the friend list does, so the client sees
      // one consistent object rather than two shapes for the same person.
      const friendships = await listFriendships(request.user.id);
      const friendship = friendships.find((item) => item.friend.id === result.friend.id);
      if (!friendship) throw new NotFoundError('Friend not found');

      return { friendship };
    },
  );

  app.post(
    '/friends/requests/:requestId/decline',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Decline a friend request',
        params: friendRequestIdParams,
        response: { 200: friendRequestSchema, 403: errorResponse, 404: errorResponse, 409: errorResponse },
      },
    },
    async (request) => {
      await declineRequest(request.params.requestId, request.user.id);
      // Re-read so the response is the same shape the list endpoint returns.
      // Declining is something the addressee does, so read the incoming list.
      const views = await listIncoming(request.user.id, 'declined');
      const mine = views.find((view) => view.request.id === request.params.requestId);
      if (!mine) throw new NotFoundError('Friend request not found');
      return mine;
    },
  );

  /** The requester can withdraw; same effect as a decline, different intent. */
  app.post(
    '/friends/requests/:requestId/cancel',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Withdraw a request you sent',
        params: friendRequestIdParams,
        // A 204 has no body, so no response schema: the Zod serializer has
        // nothing to compile and Fastify rejects a null type here.
      },
    },
    async (request, reply) => {
      await cancelRequest(request.params.requestId, request.user.id);
      return reply.status(204).send();
    },
  );

  /* -------------------------------------------------------------- friends -- */

  app.get(
    '/friends',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'List friends who receive your alerts',
        response: { 200: z.array(friendshipSchema) },
      },
    },
    async (request) => listFriendships(request.user.id),
  );

  app.patch(
    '/friends/:friendId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Update a friend',
        description: [
          'Sets the local nickname, the notification threshold, and the address',
          'that danger alerts are emailed to.',
          '',
          '`nickname` is only ever shown to you, never sent to them.',
        ].join('\n'),
        params: friendParams,
        body: updateFriendBody,
        response: { 200: friendshipSchema, 404: errorResponse },
      },
    },
    async (request) => {
      await updateFriendSettings(request.user.id, request.params.friendId, request.body);

      // Re-read rather than echoing input, so the response reflects what was
      // actually stored (for example a defaulted field).
      const all = await listFriendships(request.user.id);
      const updated = all.find(
        (item) => item.friend.id === request.params.friendId,
      );
      if (!updated) {
        throw new NotFoundError('Friend not found');
      }
      return updated;
    },
  );

  app.delete(
    '/friends/:friendId',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['friends'],
        summary: 'Remove a friend',
        description: 'Symmetric: you stop seeing each other\'s alerts.',
        params: friendParams,
      },
    },
    async (request, reply) => {
      await removeFriend(request.user.id, request.params.friendId);
      return reply.status(204).send();
    },
  );
};