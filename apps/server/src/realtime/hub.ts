import {
  WsServerEvent,
  type Alert,
  type AlertWsPayload,
  type DispatchAckWsPayload,
  type WsEnvelope,
} from "@safecall/shared";
import type { WebSocket } from "ws";

const HEARTBEAT_MS = 45_000;

interface Connection {
  socket: WebSocket;
  alive: boolean;
}

/**
 * Fan-out registry. One user may hold several sockets (phone + tablet), and a
 * single alert is delivered to each of a friend's sockets exactly once.
 */
export class RealtimeHub {
  private readonly byUser = new Map<string, Set<Connection>>();

  add(userId: string, socket: WebSocket): void {
    const existing = this.byUser.get(userId) ?? new Set<Connection>();
    const connection: Connection = { socket, alive: true };
    existing.add(connection);
    this.byUser.set(userId, existing);

    socket.on("pong", () => {
      connection.alive = true;
    });

    socket.on("close", () => {
      existing.delete(connection);
      if (existing.size === 0) this.byUser.delete(userId);
    });
  }

  send<T>(userId: string, type: string, payload: T): void {
    const connections = this.byUser.get(userId);
    if (!connections) return;

    const envelope: WsEnvelope<T> = {
      type,
      at: new Date().toISOString(),
      payload,
    };
    const data = JSON.stringify(envelope);

    for (const connection of connections) {
      if (connection.socket.readyState !== connection.socket.OPEN) continue;
      connection.socket.send(data);
    }
  }

  sendFriendAlert(
    userId: string,
    alert: Alert,
    contact: AlertWsPayload["contact"],
    options: { dispatched: boolean; callMe: boolean },
  ): void {
    this.send(userId, WsServerEvent.Alert, {
      alert,
      contact,
      dispatched: options.dispatched,
      callMe: options.callMe,
    } satisfies AlertWsPayload);
  }

  sendDispatchAck(userId: string, payload: DispatchAckWsPayload): void {
    this.send(userId, WsServerEvent.DispatchAck, payload);
  }

  broadcast(type: string, payload: unknown): void {
    for (const userId of this.byUser.keys()) {
      this.send(userId, type, payload);
    }
  }

  /** Drops sockets that have not answered a ping within the heartbeat window. */
  sweep(): void {
    for (const connections of this.byUser.values()) {
      for (const connection of connections) {
        if (!connection.alive) {
          connection.socket.terminate();
          continue;
        }
        connection.alive = false;
        connection.socket.ping();
      }
    }
  }

  isOnline(userId: string): boolean {
    return this.byUser.has(userId);
  }

  get connectionCount(): number {
    let total = 0;
    for (const connections of this.byUser.values()) total += connections.size;
    return total;
  }
}

export const hub = new RealtimeHub();

export const startHeartbeat = (): NodeJS.Timeout => {
  const timer = setInterval(() => hub.sweep(), HEARTBEAT_MS);
  timer.unref();
  return timer;
};
