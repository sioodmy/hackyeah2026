import {
  WsClientEvent,
  WsServerEvent,
  type AlertClearedWsPayload,
  type AlertWsPayload,
  type Contact,
  type DecoyCallWsPayload,
  type DispatchAckWsPayload,
  type LocationUpdate,
  type LocationsWsPayload,
  type WsEnvelope,
} from "@safecall/shared";

import { config } from "./env";

export interface RealtimeHandlers {
  onLocations?: (contacts: Contact[]) => void;
  onAlert?: (payload: AlertWsPayload) => void;
  onAlertCleared?: (payload: AlertClearedWsPayload) => void;
  onContactUpsert?: (contact: Contact) => void;
  onDispatchAck?: (payload: DispatchAckWsPayload) => void;
  onDecoyCall?: (payload: DecoyCallWsPayload) => void;
  onStatus?: (connected: boolean) => void;
}

const BACKOFF_MS = [500, 1000, 2000, 4000, 8000, 15000] as const;
const HEARTBEAT_MS = 20_000;

/**
 * Self-healing websocket wrapper. React Native ships a global WebSocket, so no
 * socket.io client is needed. Reconnects with capped exponential backoff and
 * replays the last known location so a reconnecting client never looks stale.
 */
export class RealtimeClient {
  private socket: WebSocket | null = null;
  private handlers: RealtimeHandlers = {};
  private attempt = 0;
  private token: string | null = null;
  private closedByUs = false;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastLocation: LocationUpdate | null = null;

  setHandlers(handlers: RealtimeHandlers): void {
    this.handlers = handlers;
  }

  connect(token: string | null): void {
    this.token = token;
    this.closedByUs = false;
    this.open();
  }

  disconnect(): void {
    this.closedByUs = true;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
    this.handlers.onStatus?.(false);
  }

  /** Drops the current socket and reconnects immediately, e.g. after re-login. */
  reconnect(): void {
    if (!this.closedByUs) this.open();
  }

  sendLocation(location: LocationUpdate): void {
    this.lastLocation = location;
    this.send(WsClientEvent.LocationPing, location);
  }

  private open(): void {
    this.clearTimers();
    this.socket?.close();

    const query = this.token ? `?token=${encodeURIComponent(this.token)}` : "";
    const socket = new WebSocket(`${config.wsUrl}${query}`);
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      this.handlers.onStatus?.(true);
      if (this.lastLocation)
        this.send(WsClientEvent.LocationPing, this.lastLocation);
      this.heartbeat = setInterval(
        () => this.send(WsClientEvent.Ping, { at: new Date().toISOString() }),
        HEARTBEAT_MS,
      );
    };

    socket.onmessage = (event) => this.receive(event.data);

    socket.onerror = () => {
      this.handlers.onStatus?.(false);
    };

    socket.onclose = () => {
      this.clearTimers();
      this.handlers.onStatus?.(false);
      if (this.closedByUs) return;
      const delay =
        BACKOFF_MS[Math.min(this.attempt, BACKOFF_MS.length - 1)] ?? 1000;
      this.attempt += 1;
      this.reconnectTimer = setTimeout(() => this.open(), delay);
    };
  }

  private receive(raw: unknown): void {
    if (typeof raw !== "string") return;

    let envelope: WsEnvelope<unknown>;
    try {
      envelope = JSON.parse(raw) as WsEnvelope<unknown>;
    } catch {
      return;
    }

    switch (envelope.type) {
      case WsServerEvent.Locations:
        this.handlers.onLocations?.(
          (envelope.payload as LocationsWsPayload).contacts,
        );
        break;
      case WsServerEvent.Alert:
        this.handlers.onAlert?.(envelope.payload as AlertWsPayload);
        break;
      case WsServerEvent.AlertCleared:
        this.handlers.onAlertCleared?.(
          envelope.payload as AlertClearedWsPayload,
        );
        break;
      case WsServerEvent.ContactUpsert:
        this.handlers.onContactUpsert?.(envelope.payload as Contact);
        break;
      case WsServerEvent.DispatchAck:
        this.handlers.onDispatchAck?.(envelope.payload as DispatchAckWsPayload);
        break;
      case WsServerEvent.DecoyCall:
        this.handlers.onDecoyCall?.(envelope.payload as DecoyCallWsPayload);
        break;
      default:
        break;
    }
  }

  private send<T>(type: string, payload: T): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== 1) return;

    const envelope: WsEnvelope<T> = {
      type,
      at: new Date().toISOString(),
      payload,
    };
    socket.send(JSON.stringify(envelope));
  }

  private clearTimers(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.heartbeat = null;
    this.reconnectTimer = null;
  }
}

export const realtime = new RealtimeClient();
