import { DurableObject } from 'cloudflare:workers';
import { parseJoin, type Join } from './join';

// Number Crew tablet relay: one room per classroom screen. The classroom screen joins as the host; each tablet joins as one player's pad.
// Pad messages go to the host tagged with the player; host messages addressed to a player go to that pad. Nothing is stored, and nothing is logged.
const MAX_MESSAGE = 512;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const join = parseJoin(new URL(request.url), request.headers.get('Origin'));
    if (!join) return new Response('Number Crew tablet relay', { status: new URL(request.url).pathname === '/' ? 200 : 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    return env.ROOMS.getByName(join.room).fetch(request);
  },
} satisfies ExportedHandler<Env>;

export class Room extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const join = parseJoin(new URL(request.url), request.headers.get('Origin'))!;
    const tag = join.role === 'host' ? 'host' : `pad${join.player}`;
    // The newest connection for a seat wins: a reloaded classroom screen, or a second tablet scanning the same code, takes over.
    for (const old of this.ctx.getWebSockets(tag)) old.close(4000, 'replaced');
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, [tag]);
    server.serializeAttachment(join);
    if (join.role === 'host') server.send(JSON.stringify({ t: 'pads', players: this.players() }));
    else {
      this.toHost({ t: 'join', p: join.player });
      server.send(JSON.stringify({ t: 'host', on: this.ctx.getWebSockets('host').length > 0 }));
    }
    if (join.role === 'host') this.toPads({ t: 'host', on: true });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE) return;
    const join = ws.deserializeAttachment() as Join;
    if (join.role === 'pad') { this.toHost({ t: 'pad', p: join.player, m: message }); return; }
    let parsed: { to?: unknown; m?: unknown };
    try { parsed = JSON.parse(message); } catch { return; }
    if (typeof parsed.m !== 'string') return;
    const targets = parsed.to === 'all' ? [0, 1, 2, 3] : Number.isInteger(parsed.to) && (parsed.to as number) >= 0 && (parsed.to as number) <= 3 ? [parsed.to as number] : [];
    for (const player of targets) for (const pad of this.ctx.getWebSockets(`pad${player}`)) pad.send(parsed.m);
  }

  async webSocketClose(ws: WebSocket): Promise<void> { this.left(ws); }
  async webSocketError(ws: WebSocket): Promise<void> { this.left(ws); }

  private left(ws: WebSocket): void {
    const join = ws.deserializeAttachment() as Join | null;
    if (!join) return;
    if (join.role === 'pad' && !this.ctx.getWebSockets(`pad${join.player}`).some(other => other !== ws)) this.toHost({ t: 'leave', p: join.player });
    if (join.role === 'host' && !this.ctx.getWebSockets('host').some(other => other !== ws)) this.toPads({ t: 'host', on: false });
  }
  private players(): number[] { return [0, 1, 2, 3].filter(player => this.ctx.getWebSockets(`pad${player}`).length > 0); }
  private toHost(message: object): void { for (const host of this.ctx.getWebSockets('host')) host.send(JSON.stringify(message)); }
  private toPads(message: object): void { for (let player = 0; player < 4; player++) for (const pad of this.ctx.getWebSockets(`pad${player}`)) pad.send(JSON.stringify(message)); }
}
