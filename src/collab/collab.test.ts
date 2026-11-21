import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import OP from '../core';
import { newKeyText, importKey, seal, open, randomId, toB64, fromB64 } from './crypto';
import { isEmpty, readProject, writeOrder, writeProject } from './ydoc';
import type { Project } from '../types';

const M = OP.model;
const strip = (p: any) => { const c = JSON.parse(JSON.stringify(p)); delete c.nextUid; return c; };
const demo = () => M.normalize(OP.demo()) as Project;
const norm = (p: Project) => strip(M.normalize(JSON.parse(JSON.stringify(p))));

// Two documents that exchange updates, like two people on a relay.
function pair() {
  const a = new Y.Doc(), b = new Y.Doc();
  let live = true;
  a.on('update', (u, o) => { if (live && o !== 'net') Y.applyUpdate(b, u, 'net'); });
  b.on('update', (u, o) => { if (live && o !== 'net') Y.applyUpdate(a, u, 'net'); });
  return { a, b, offline: () => { live = false; }, online: () => { live = true; Y.applyUpdate(a, Y.encodeStateAsUpdate(b), 'net'); Y.applyUpdate(b, Y.encodeStateAsUpdate(a), 'net'); } };
}

describe('crypto', () => {
  it('round-trips data and rejects tampering or the wrong key', async () => {
    const key = await importKey(newKeyText()), other = await importKey(newKeyText());
    const data = new TextEncoder().encode('Secret plan ✓');
    const sealed = await seal(key, data);
    expect(sealed).not.toContain('Secret');
    expect(new TextDecoder().decode(await open(key, sealed))).toBe('Secret plan ✓');
    await expect(open(other, sealed)).rejects.toThrow();
    const bytes = fromB64(sealed); bytes[20] ^= 1;
    await expect(open(key, toB64(bytes))).rejects.toThrow();
    expect(await seal(key, data)).not.toBe(sealed); // fresh IV each time
  });
  it('makes unguessable ids and 256-bit keys', async () => {
    expect(randomId()).toHaveLength(22);
    expect(fromB64(newKeyText())).toHaveLength(32);
    await expect(importKey('abc')).rejects.toThrow();
  });
});

describe('project <-> shared document', () => {
  it('round-trips the sample project exactly', () => {
    const doc = new Y.Doc(), p = demo();
    expect(isEmpty(doc)).toBe(true);
    writeProject(doc, null, p);
    expect(isEmpty(doc)).toBe(false);
    expect(norm(readProject(doc))).toEqual(norm(p));
  });

  it('writes only what changed', () => {
    const doc = new Y.Doc(), p = demo();
    writeProject(doc, null, p);
    const updates: Uint8Array[] = []; doc.on('update', u => updates.push(u));
    const next = JSON.parse(JSON.stringify(p)) as Project; next.tasks[2].name = 'Renamed';
    writeProject(doc, p, next);
    expect(updates).toHaveLength(1);
    expect(updates[0].length).toBeLessThan(80);
    expect(readProject(doc).tasks[2].name).toBe('Renamed');
  });

  it('keeps adds, deletes, moves, links and settings in sync', () => {
    const doc = new Y.Doc(), p = demo();
    writeProject(doc, null, p);
    const next = JSON.parse(JSON.stringify(p)) as Project;
    next.name = 'New name'; next.holidays = ['2026-02-02'];
    const gone = next.tasks.splice(5, 1)[0];
    const moved = next.tasks.splice(1, 1)[0]; next.tasks.splice(8, 0, moved);
    next.tasks.push(M.newTask(next, { name: 'Added', level: 1 }));
    next.tasks[0].preds = [{ uid: moved.uid, type: 'SS', lag: 2 }];
    writeProject(doc, p, next);
    const back = readProject(doc);
    expect(back.tasks.map(t => t.uid)).toEqual(next.tasks.map(t => t.uid));
    expect(back.tasks.some(t => t.uid === gone.uid)).toBe(false);
    expect(back.name).toBe('New name');
    expect(back.holidays).toEqual(['2026-02-02']);
    expect(back.tasks[0].preds).toEqual([{ uid: moved.uid, type: 'SS', lag: 2 }]);
  });

  it('large projects are written in several small messages that rebuild the same plan', () => {
    const p = demo(); const base = p.tasks[1];
    p.tasks = Array.from({ length: 700 }, (_, i) => ({ ...JSON.parse(JSON.stringify(base)), uid: 100 + i, name: 'Task ' + i, level: 1, preds: [] }));
    const doc = new Y.Doc(), updates: Uint8Array[] = []; doc.on('update', u => updates.push(u));
    writeProject(doc, null, p);
    expect(updates.length).toBeGreaterThan(3);
    expect(Math.max(...updates.map(u => u.length))).toBeLessThan(150_000);
    const fresh = new Y.Doc(); updates.forEach(u => Y.applyUpdate(fresh, u));
    expect(readProject(fresh).tasks.map(t => t.uid)).toEqual(p.tasks.map(t => t.uid));
  });

  it('order diff gives exactly the wanted order (300 random reshuffles)', () => {
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const arr = new Y.Doc().getArray<number>('o');
    let cur: number[] = Array.from({ length: 12 }, (_, i) => i + 1), nextId = 100;
    writeOrder(arr, cur);
    for (let n = 0; n < 300; n++) {
      const want = cur.filter(() => rnd() > 0.15);
      for (let k = 0; k < 3; k++) if (rnd() > 0.5) want.splice(Math.floor(rnd() * (want.length + 1)), 0, nextId++);
      for (let k = want.length - 1; k > 0; k--) if (rnd() > 0.8) { const j = Math.floor(rnd() * (k + 1)); [want[k], want[j]] = [want[j], want[k]]; }
      writeOrder(arr, want);
      expect(arr.toArray()).toEqual(want);
      cur = want;
    }
  });
});

describe('two people editing at once', () => {
  const setup = () => {
    const { a, b, offline, online } = pair(), p = demo();
    writeProject(a, null, p);
    return { a, b, p, offline, online };
  };
  const edit = (doc: Y.Doc, p: Project, fn: (n: Project) => void) => { const cur = readProject(doc); const next = JSON.parse(JSON.stringify(cur)) as Project; next.nextUid = p.nextUid; fn(next); writeProject(doc, cur, next); };

  it('both see the starting plan', () => { const { a, b, p } = setup(); expect(norm(readProject(b))).toEqual(norm(p)); expect(norm(readProject(a))).toEqual(norm(p)); });

  it('edits to different fields of the same task both survive', () => {
    const { a, b, p, offline, online } = setup(); offline();
    edit(a, p, n => { n.tasks[2].name = 'Name by A'; });
    edit(b, p, n => { n.tasks[2].duration = 9; });
    online();
    for (const d of [a, b]) { const t = readProject(d).tasks[2]; expect([t.name, t.duration]).toEqual(['Name by A', 9]); }
  });

  it('tasks added at the same time both survive, with different ids', () => {
    const { a, b, p, offline, online } = setup(); offline();
    const pa = JSON.parse(JSON.stringify(p)) as Project; pa.nextUid = 5_000_000;
    const pb = JSON.parse(JSON.stringify(p)) as Project; pb.nextUid = 9_000_000;
    for (const [d, q, name] of [[a, pa, 'From A'], [b, pb, 'From B']] as const) { const next = JSON.parse(JSON.stringify(q)) as Project; next.tasks.push(M.newTask(next, { name, level: 1 })); writeProject(d, q, next); }
    online();
    const names = (d: Y.Doc) => readProject(d).tasks.map(t => t.name);
    expect(names(a)).toEqual(names(b));
    expect(names(a)).toContain('From A'); expect(names(a)).toContain('From B'); expect(names(a)).toHaveLength(24);
    expect(new Set(readProject(a).tasks.map(t => t.uid)).size).toBe(24);
  });

  it('one deletes a task while the other edits another', () => {
    const { a, b, p, offline, online } = setup(); offline();
    edit(a, p, n => { n.tasks.splice(10, 1); });
    edit(b, p, n => { n.tasks[3].percent = 60; });
    online();
    const ra = readProject(a), rb = readProject(b); expect(ra.tasks.length).toBe(21); expect(rb.tasks.map(t => t.uid)).toEqual(ra.tasks.map(t => t.uid));
    expect(ra.tasks[3].percent).toBe(60);
  });

  it('the same task moved by both ends up once, in the same place for both', () => {
    const { a, b, p, offline, online } = setup(); offline();
    edit(a, p, n => { const t = n.tasks.splice(3, 1)[0]; n.tasks.splice(10, 0, t); });
    edit(b, p, n => { const t = n.tasks.splice(3, 1)[0]; n.tasks.splice(15, 0, t); });
    online();
    const ua = readProject(a).tasks.map(t => t.uid), ub = readProject(b).tasks.map(t => t.uid);
    expect(ua).toEqual(ub); expect(new Set(ua).size).toBe(22);
  });

  it('per-person undo only undoes that person\'s own change', () => {
    const { a, b, p } = setup();
    const um = new Y.UndoManager([a.getMap('meta'), a.getMap('tasks'), a.getArray('order'), a.getMap('res'), a.getArray('rorder')], { trackedOrigins: new Set(['local']), captureTimeout: 0 });
    edit(a, p, n => { n.tasks[1].name = 'A1'; });
    edit(b, p, n => { n.tasks[2].name = 'B1'; });
    edit(a, p, n => { n.tasks[1].name = 'A2'; });
    um.undo();
    expect(readProject(a).tasks[1].name).toBe('A1'); expect(readProject(a).tasks[2].name).toBe('B1');
    um.undo(); um.undo();
    expect(readProject(a).tasks[1].name).toBe(p.tasks[1].name); expect(readProject(a).tasks[2].name).toBe('B1');
    expect(readProject(b).tasks[2].name).toBe('B1');
  });
});
