import { signal } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { environment } from '../../../environments/environment';

export type LiveSocketState = 'CONNECTING' | 'OPEN' | 'CLOSED';

export interface TransportClose { code: number; reason: string; }

export interface LiveSocketHandlers {
  onTransportClose: (close: TransportClose) => void;
  onStompError?: (headers: Record<string, string>, body: string) => void;
}

/**
 * One live STOMP connection over SockJS. The JWT travels as the `token` query
 * param (WebSocketHandshakeInterceptor) — it must NEVER appear in app URLs.
 *
 * kind: 'live'       -> /ws/live/{code}      (teacher, host JWT)
 *       'assessment' -> /ws/assessment/{code} (student, student JWT)
 *
 * One fresh instance per (re)connection attempt: reconnection is owned by the
 * page because a student rejoin mints a NEW token (the handshake rejects the
 * superseded one), and a teacher reconnect must re-verify host ownership.
 */
export class LiveSocket {
  readonly state = signal<LiveSocketState>('CONNECTING');

  private client?: Client;
  private disposed = false;
  private readonly pending: Array<{ destination: string; handler: (message: unknown) => void }> = [];
  private readonly active: StompSubscription[] = [];

  constructor(
    private readonly kind: 'live' | 'assessment',
    private readonly code: string,
    private readonly token: string,
    private readonly handlers: LiveSocketHandlers,
  ) {}

  connect(): void {
    const client = new Client({
      // Static /ws SockJS base; kind/code/token ride along as query params
      // (sockjs-client preserves them on every transport request).
      webSocketFactory: () =>
        new SockJS(
          `${environment.backendUrl}/ws?kind=${this.kind}&code=${this.code}&token=${encodeURIComponent(this.token)}`,
        ),
      reconnectDelay: 0,
      onConnect: () => {
        for (const s of this.pending.splice(0)) this.doSubscribe(s.destination, s.handler);
        this.state.set('OPEN');
      },
      onWebSocketClose: (evt) => {
        if (this.disposed) return;
        this.state.set('CLOSED');
        this.handlers.onTransportClose({ code: evt.code, reason: evt.reason ?? '' });
      },
      onStompError: (frame) => this.handlers.onStompError?.(frame.headers, frame.body),
    });
    this.client = client;
    client.activate();
  }

  /** Safe to call before the connection is open — queued and flushed on connect. */
  subscribe(destination: string, handler: (message: unknown) => void): void {
    if (this.client?.connected) this.doSubscribe(destination, handler);
    else this.pending.push({ destination, handler });
  }

  /** Destination used verbatim — @MessageMapping targets start with `/app/`. */
  publish(destination: string, body: unknown): void {
    const client = this.client;
    if (!client?.connected) return;
    client.publish({ destination, body: JSON.stringify(body ?? {}) });
  }

  disconnect(): void {
    this.disposed = true;
    for (const s of this.active) s.unsubscribe();
    this.active.length = 0;
    void this.client?.deactivate();
    this.client = undefined;
  }

  private doSubscribe(destination: string, handler: (message: unknown) => void): void {
    const sub = this.client!.subscribe(destination, (message: IMessage) => {
      let parsed: unknown;
      try { parsed = message.body ? JSON.parse(message.body) : null; }
      catch { parsed = message.body; }
      handler(parsed);
    });
    this.active.push(sub);
  }
}
