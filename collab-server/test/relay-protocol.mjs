// Protocol test for the relay. Start it first with `npm run dev -- --var ALLOWED_ORIGINS:http://localhost:4173`, then run `npm test`.
const BASE = 'ws://localhost:8787/room/';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { const r = await fn(); pass++; console.log('PASS', name, r ? '→ ' + r : ''); } catch (e) { fail++; console.log('FAIL', name, '→', e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' got ' + JSON.stringify(a) + ' want ' + JSON.stringify(b)); };
const room = () => 'r' + Math.random().toString(36).slice(2).padEnd(20, 'x');
function client(id, origin = 'http://localhost:4173') {
  return new Promise((res, rej) => {
    const ws = new WebSocket(BASE + id, { headers: { Origin: origin } }); const msgs = [], waiters = [];
    ws.onmessage = e => { const m = JSON.parse(e.data); msgs.push(m); waiters.splice(0).forEach(w => w()); };
    ws.onerror = e => rej(new Error('ws error ' + (e.message || ''))); ws.onclose = e => { ws.closed = e.code; };
    ws.onopen = () => res({ ws, msgs, send: o => ws.send(typeof o === 'string' ? o : JSON.stringify(o)),
      until: async (pred, ms = 3000) => { const end = Date.now() + ms; for (;;) { const f = msgs.find(pred); if (f) return f; if (Date.now() > end) throw new Error('timeout waiting; got ' + JSON.stringify(msgs.map(m => m.t))); await new Promise(r => { waiters.push(r); setTimeout(r, 100); }); } } });
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const enc = s => Buffer.from(s).toString('base64url');

await t('new room: ready with 0 entries and 1 person', async () => { const a = await client(room()); const r = await a.until(m => m.t === 'ready'); eq(r.count, 0); const n = await a.until(m => m.t === 'n'); eq(n.n, 1); a.ws.close(); });
await t('update is acked, forwarded to the other person (not echoed back)', async () => {
  const id = room(), a = await client(id), b = await client(id); await a.until(m => m.t === 'ready'); await b.until(m => m.t === 'ready');
  a.send({ t: 'u', d: enc('hello') }); const ack = await a.until(m => m.t === 'a'); const got = await b.until(m => m.t === 'u'); eq([ack.seq, got.seq, got.d], [1, 1, enc('hello')]);
  await wait(200); eq(a.msgs.filter(m => m.t === 'u').length, 0, 'echo'); a.ws.close(); b.ws.close(); return 'seq ' + ack.seq; });
await t('late joiner replays history in order, then ready', async () => {
  const id = room(), a = await client(id); await a.until(m => m.t === 'ready'); for (let i = 1; i <= 5; i++) a.send({ t: 'u', d: enc('m' + i) }); await a.until(m => m.t === 'a' && m.seq === 5);
  const b = await client(id); const r = await b.until(m => m.t === 'ready'); const ups = b.msgs.filter(m => m.t === 'u'); eq(ups.map(u => u.seq), [1, 2, 3, 4, 5]); eq(r.count, 5); a.ws.close(); b.ws.close(); });
await t('people count follows joins and leaves', async () => {
  const id = room(), a = await client(id); await a.until(m => m.t === 'ready'); const b = await client(id); await a.until(m => m.t === 'n' && m.n === 2); b.ws.close(); await a.until(m => m.t === 'n' && m.n === 1); a.ws.close(); });
await t('snapshot replaces older entries and keeps newer ones', async () => {
  const id = room(), a = await client(id); await a.until(m => m.t === 'ready'); for (let i = 1; i <= 6; i++) a.send({ t: 'u', d: enc('m' + i) }); await a.until(m => m.t === 'a' && m.seq === 6);
  a.send({ t: 's', upTo: 4, d: enc('SNAP') }); await wait(300); const b = await client(id); await b.until(m => m.t === 'ready'); const ups = b.msgs.filter(m => m.t === 'u'); eq(ups.map(u => [u.seq, u.d]), [[4, enc('SNAP')], [5, enc('m5')], [6, enc('m6')]]); a.ws.close(); b.ws.close(); });
await t('new updates keep counting up after a snapshot', async () => {
  const id = room(), a = await client(id); await a.until(m => m.t === 'ready'); for (let i = 1; i <= 3; i++) a.send({ t: 'u', d: enc('m' + i) }); await a.until(m => m.t === 'a' && m.seq === 3); a.send({ t: 's', upTo: 3, d: enc('S') }); await wait(200); a.send({ t: 'u', d: enc('m4') }); const k = await a.until(m => m.t === 'a' && m.seq > 3); a.ws.close(); return 'seq ' + k.seq; });
await t('message over the size limit is refused, room unharmed', async () => {
  const id = room(), a = await client(id); await a.until(m => m.t === 'ready'); a.send({ t: 'u', d: 'x'.repeat(950_000) }); await a.until(m => m.t === 'err' && m.m === 'big'); a.send({ t: 'u', d: enc('ok') }); await a.until(m => m.t === 'a'); a.ws.close(); });
await t('room full at ~5 MB is refused with "full"', async () => {
  const id = room(), a = await client(id); await a.until(m => m.t === 'ready'); const chunk = 'y'.repeat(800_000); let full = false;
  for (let i = 0; i < 8 && !full; i++) { a.send({ t: 'u', d: chunk }); await wait(150); full = a.msgs.some(m => m.t === 'err' && m.m === 'full'); } if (!full) throw new Error('never refused'); a.ws.close(); });
await t('flooding is rate limited', async () => {
  const id = room(), a = await client(id); await a.until(m => m.t === 'ready'); for (let i = 0; i < 700; i++) a.send({ t: 'u', d: enc('f' + i) }); await a.until(m => m.t === 'err' && m.m === 'slow', 6000); a.ws.close(); });
await t('garbage input is ignored without crashing', async () => {
  const id = room(), a = await client(id); await a.until(m => m.t === 'ready'); a.send('not json'); a.send({ t: 'u' }); a.send({ t: 's', upTo: -5, d: 'x' }); a.send({ t: 'zzz', d: 'x' }); a.send({ t: 'u', d: enc('still works') }); await a.until(m => m.t === 'a'); a.ws.close(); });
await t('wrong website origin is rejected (403)', async () => { try { await client(room(), 'https://evil.example'); throw new Error('connected!'); } catch (e) { if (/connected!/.test(e.message)) throw e; } });
await t('bad room name is rejected; plain GET shows the health text', async () => { try { await client('short'); throw new Error('connected!'); } catch (e) { if (/connected!/.test(e.message)) throw e; } const r = await fetch('http://localhost:8787/'); eq(r.status, 200); });
await t('rooms are isolated from each other', async () => { const a = await client(room()), b = await client(room()); await a.until(m => m.t === 'ready'); await b.until(m => m.t === 'ready'); a.send({ t: 'u', d: enc('private') }); await a.until(m => m.t === 'a'); await wait(300); eq(b.msgs.filter(m => m.t === 'u').length, 0); a.ws.close(); b.ws.close(); });
console.log(`\nSUMMARY pass=${pass} fail=${fail}`); process.exit(fail ? 1 : 0);
