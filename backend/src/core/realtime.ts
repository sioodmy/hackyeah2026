/**
 * In-memory WebSocket connection registry and fan-out.
 *
 * Design constraints
 * ------------------
 * * One process (see README). The registry therefore lives in process memory —
 *   no Redis, no sticky sessions. Running a second API process needs a shared
 *   broker; the queue-of-one behaviour below is what stops a slow phone from
 *   building a backlog, and that part matters more than the transport.
 * * Each connection gets an outbound queue of size 1 holding only the *newest*
 *   location. A phone on a bad network drops stale coordinates instead of
 *   replaying minutes-old positions, which is exactly what you do not want when
 *   someone is being followed.
 */

/**
 * The subset of a `ws` socket this module uses.
 *
 * Declared structurally rather than imported: Fastify does not re-export the
 * WebSocket type, and pinning one `ws` version here would leak into the public
 * signature for no benefit.
 */
export interface SocketLike {
  readonly readyState: number;
  readonly OPEN: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface WireFrame {
  type: string;
  [key: string]: unknown;
}

export class Subscriber {
  queue: WireFrame[] = [];

  constructor(
    readonly userId: string,
    private readonly socket: SocketLike,
  ) {}

  /**
   * Publish the newest frame, evicting anything already queued.
   *
   * Deliberately lossy: under a bad connection the freshest position is the
   * only one worth having.
   */
  offer(frame: WireFrame): void {
    if (this.queue.length > 0) this.queue.shift();
    this.queue.push(frame);
  }
}

class ConnectionRegistry {
  private readonly byUser = new Map<string, Set<Subscriber>>();

  subscribe(userId: string, socket: SocketLike): Subscriber {
    const sub = new Subscriber(userId, socket);
    const peers = this.byUser.get(userId) ?? new Set<Subscriber>();
    peers.add(sub);
    this.byUser.set(userId, peers);
    return sub;
  }

  unsubscribe(sub: Subscriber): void {
    const peers = this.byUser.get(sub.userId);
    if (!peers) return;
    peers.delete(sub);
    if (peers.size === 0) this.byUser.delete(sub.userId);
  }

  isConnected(userId: string): boolean {
    return this.byUser.has(userId);
  }

  connectionCount(): number {
    let total = 0;
    for (const peers of this.byUser.values()) total += peers.size;
    return total;
  }

  /**
   * Deliver to every live socket of the given users, skipping the sender.
   *
   * A user with two devices open gets two copies, which is correct: both
   * screens should follow.
   */
  fanout(
    userIds: Iterable<string>,
    payload: WireFrame,
    except?: string,
  ): number {
    let delivered = 0;
    for (const id of userIds) {
      if (id === except) continue;
      const peers = this.byUser.get(id);
      if (!peers) continue;
      for (const sub of peers) {
        sub.offer(payload);
        delivered += 1;
      }
    }
    return delivered;
  }
}

export const registry = new ConnectionRegistry();

/**
 * Drain a subscriber's queue onto its socket.
 *
 * Ends quietly when the socket dies — a closed connection should not take the
 * server down or spin a reconnect loop of its own.
 */
export async function pump(sub: Subscriber, socket: SocketLike): Promise<void> {
  try {
    for (;;) {
      const frame = sub.queue.shift();
      if (!frame) {
        // Nothing queued: park until the next fan-out rather than spinning.
        await new Promise<void>((resolve) => setTimeout(resolve, 250));
        continue;
      }
      if (socket.readyState !== socket.OPEN) return;
      socket.send(JSON.stringify(frame));
    }
  } catch {
    // Socket closed mid-send; the route's finally block unsubscribes.
  }
}
