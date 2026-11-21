/*
 * OpenPlan live-session relay.
 *
 * Every message is encrypted in the browser with a key that never reaches this server, so all it can do is
 * store and forward scrambled bytes. One Durable Object holds one room: an append-only log of updates that
 * a new person replays to catch up, plus the people currently connected.
 *
 * Protocol (JSON text messages)
 *   client -> server  {t:"u", d}             append update d and send it to everyone else
 *   client -> server  {t:"s", upTo, d}       replace log entries 1..upTo with one snapshot d
 *   client -> server  {t:"p", d}            presence (who is here): sent to everyone else, never stored
 *   server -> client  {t:"u", seq, d}        an update (the stored history is sent this way on connect)
 *   server -> client  {t:"p", d}            someone's presence
 *   server -> client  {t:"a", seq}           your update was stored with this sequence number
 *   server -> client  {t:"ready", count}     the stored history has been sent (count = entries)
 *   server -> client  {t:"n", n}             people connected right now
 *   server -> client  {t:"err", m}           "full", "big" or "slow"
 */

const ID = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_MESSAGE = 900_000;          // bytes; Cloudflare allows 1 MiB per WebSocket message
const MAX_ROOM_BYTES = 5_000_000;     // stored per room
const EXPIRE_MS = 30 * 24 * 3600 * 1000; // a room with no activity for 30 days is deleted
const RATE_WINDOW_MS = 10_000, RATE_MAX = 600;

function originAllowed(request, env) {
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.includes('*')) return true;
  const origin = request.headers.get('Origin');
  return !!origin && allowed.includes(origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const m = /^\/room\/([^/]+)$/.exec(url.pathname);
    if (!m) return new Response('OpenPlan live-session relay', { status: 200 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    if (!ID.test(m[1])) return new Response('Bad room', { status: 400 });
    if (!originAllowed(request, env)) return new Response('Origin not allowed', { status: 403 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(request);
  }
};

export class Room {
  constructor(ctx) {
    this.ctx = ctx;
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS log (seq INTEGER PRIMARY KEY AUTOINCREMENT, d TEXT NOT NULL)');
    this.rate = new Map();
  }

  open() { return this.ctx.getWebSockets().filter(s => s.readyState === 1); }

  announce() {
    const msg = JSON.stringify({ t: 'n', n: this.open().length });
    for (const s of this.open()) s.send(msg);
  }

  async touch() { await this.ctx.storage.setAlarm(Date.now() + EXPIRE_MS); }

  async fetch() {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    let count = 0;
    for (const row of this.sql.exec('SELECT seq, d FROM log ORDER BY seq')) { server.send(JSON.stringify({ t: 'u', seq: row.seq, d: row.d })); count++; }
    server.send(JSON.stringify({ t: 'ready', count }));
    this.announce();
    await this.touch();
    return new Response(null, { status: 101, webSocket: client });
  }

  allow(ws) {
    const now = Date.now(), r = this.rate.get(ws) || { start: now, n: 0 };
    if (now - r.start > RATE_WINDOW_MS) { r.start = now; r.n = 0; }
    r.n++; this.rate.set(ws, r);
    return r.n <= RATE_MAX;
  }

  bytes() { return this.sql.exec('SELECT COALESCE(SUM(LENGTH(d)), 0) AS n FROM log').one().n; }

  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > MAX_MESSAGE) { ws.send(JSON.stringify({ t: 'err', m: 'big' })); return; }
    if (!this.allow(ws)) { ws.send(JSON.stringify({ t: 'err', m: 'slow' })); return; }
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg.d !== 'string') return;
    if (msg.t === 'u') {
      if (this.bytes() + msg.d.length > MAX_ROOM_BYTES) { ws.send(JSON.stringify({ t: 'err', m: 'full' })); return; }
      const seq = this.sql.exec('INSERT INTO log (d) VALUES (?) RETURNING seq', msg.d).one().seq;
      ws.send(JSON.stringify({ t: 'a', seq }));
      const out = JSON.stringify({ t: 'u', seq, d: msg.d });
      for (const s of this.open()) if (s !== ws) s.send(out);
      await this.touch();
    } else if (msg.t === 'p') {
      if (msg.d.length > 2000) return;   // a name and a colour: anything bigger is not presence
      const out = JSON.stringify({ t: 'p', d: msg.d });
      for (const s of this.open()) if (s !== ws) s.send(out);
    } else if (msg.t === 's' && Number.isInteger(msg.upTo) && msg.upTo > 0) {
      this.sql.exec('DELETE FROM log WHERE seq <= ?', msg.upTo);
      this.sql.exec('INSERT INTO log (seq, d) VALUES (?, ?)', msg.upTo, msg.d);
      await this.touch();
    }
  }

  async webSocketClose(ws) { this.rate.delete(ws); this.announce(); }
  async webSocketError(ws) { this.rate.delete(ws); this.announce(); }

  async alarm() {
    for (const s of this.ctx.getWebSockets()) { try { s.close(1000, 'Room expired'); } catch { /* already closed */ } }
    await this.ctx.storage.deleteAll();
  }
}
