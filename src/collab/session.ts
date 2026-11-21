import * as Y from 'yjs';
import OP from '../core';
import { S, useStore, setCollabHooks, syncProject, PREV_STORE } from '../store';
import { COLLAB_URL, SESSION_KEY } from './config';
import { COLLAB_OFF, type CollabInfo } from './types';
import { importKey, newKeyText, open, randomId, seal } from './crypto';
import { ROOT_TYPES, isEmpty, parts, readProject, writeProject } from './ydoc';

type Mode = 'create' | 'join' | 'rejoin';
const COMPACT_AT = 200;   // ask the relay to merge its history once it holds this many entries
const ERRORS: Record<string, string> = {
  full: 'This live session has used up its storage. Save a file, then start a new session.',
  big: 'The plan is too large to share live.',
  slow: 'Too many changes at once. Slow down a little.'
};

const setInfo = (patch: Partial<CollabInfo>) => useStore.setState({ collab: { ...useStore.getState().collab, ...patch } });

class Session {
  doc = new Y.Doc();
  um: Y.UndoManager | null = null;
  ws: WebSocket | null = null;
  seq = 0; logLen = 0; synced = false; closed = false; failures = 0; timer = 0; queued = false;
  chain: Promise<void> = Promise.resolve();
  myNext: number;

  constructor(public room: string, public keyText: string, public key: CryptoKey, public mode: Mode) {
    // Every person allocates task and resource numbers from their own range, so two people adding a task
    // at the same moment can never pick the same number.
    this.myNext = (1 + Math.floor(Math.random() * (2 ** 20 - 1))) * 1_000_000;
    this.doc.on('update', (u: Uint8Array, origin: unknown) => { if (origin !== 'net') this.push(u); });
    this.doc.on('afterTransaction', tr => { if (this.synced && tr.origin !== 'local' && tr.origin !== 'seed') this.queueRebuild(); });
  }

  link() { return location.origin + location.pathname + '#collab=' + this.room + '.' + this.keyText; }

  start() {
    setInfo({ status: 'connecting', peers: 0, link: this.link() });
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ room: this.room, key: this.keyText })); } catch { /* storage unavailable */ }
    this.connect();
  }

  connect() {
    if (this.closed) return;
    const ws = new WebSocket(COLLAB_URL.replace(/^http/, 'ws') + '/room/' + this.room);
    this.ws = ws;
    ws.onmessage = e => { this.chain = this.chain.then(() => this.handle(String(e.data))).catch(() => { /* a bad message must not stop the rest */ }); };
    ws.onclose = () => {
      if (this.closed || this.ws !== ws) return;
      this.sendable = false;
      setInfo({ status: this.synced ? 'offline' : 'connecting', peers: 0 });
      this.failures++;
      if (!this.synced && this.failures >= 4) { this.fail('Could not reach the live-session server. Check your connection and try again.'); return; }
      this.timer = window.setTimeout(() => this.connect(), Math.min(30_000, 1000 * 2 ** Math.min(this.failures, 5)));
    };
  }

  async push(update: Uint8Array) {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1 || !this.sendable) return;
    ws.send(JSON.stringify({ t: 'u', d: await seal(this.key, update) }));
  }
  sendable = false;

  async handle(text: string) {
    const m = JSON.parse(text);
    if (m.t === 'u') {
      Y.applyUpdate(this.doc, await open(this.key, m.d), 'net');
      this.seq = Math.max(this.seq, m.seq); this.logLen++;
      this.maybeCompact();
    } else if (m.t === 'a') {
      this.seq = Math.max(this.seq, m.seq); this.logLen++;
      this.maybeCompact();
    } else if (m.t === 'ready') {
      this.sendable = true;
      this.failures = 0;
      this.logLen = m.count;
      await this.ready();
    } else if (m.t === 'n') {
      setInfo({ peers: m.n });
    } else if (m.t === 'err') {
      S().toast(ERRORS[m.m] || 'The live session reported a problem.', true);
    }
  }

  async ready() {
    if (this.synced) {
      // Reconnected: send everything, so changes made while offline reach the others.
      this.push(Y.encodeStateAsUpdate(this.doc));
      setInfo({ status: 'live' });
      return;
    }
    if (isEmpty(this.doc)) {
      if (this.mode === 'join') { this.fail('This live session has ended, or the link is wrong. Ask for a new link.'); return; }
      // A new session, or an old one that expired: start it from the plan on this computer.
      const mine = JSON.parse(JSON.stringify(S().p));
      writeProject(this.doc, null, mine, 'seed');
    } else if (this.mode !== 'create') {
      // Joining: keep the plan that was open so it can be brought back (unless it is the same plan).
      const strip = (p: any) => { const c = JSON.parse(JSON.stringify(OP.model.normalize(p))); delete c.nextUid; return JSON.stringify(c); };
      if (strip(JSON.parse(JSON.stringify(S().p))) !== strip(readProject(this.doc))) {
        try { localStorage.setItem(PREV_STORE, JSON.stringify(S().p)); } catch { /* storage unavailable */ }
      }
    }
    // Pick a number range that nothing in the plan already uses.
    const used = readProject(this.doc);
    const top = Math.max(0, ...used.tasks.map(t => t.uid), ...used.resources.map(r => r.uid));
    if (top >= this.myNext && top < this.myNext + 1_000_000) this.myNext = top + 1;
    const p = parts(this.doc);
    this.um = new Y.UndoManager(ROOT_TYPES.map(k => p[k]) as Y.AbstractType<any>[], { trackedOrigins: new Set(['local']), captureTimeout: 0 });
    const mirror = () => useStore.setState({ undo: new Array(this.um!.undoStack.length).fill(''), redo: new Array(this.um!.redoStack.length).fill('') });
    for (const ev of ['stack-item-added', 'stack-item-popped', 'stack-cleared'] as const) this.um.on(ev, mirror);
    this.synced = true;
    setCollabHooks({
      onCommit: (prev, next) => { writeProject(this.doc, prev, next, 'local'); this.myNext = next.nextUid; },
      undo: () => { this.um?.undo(); }, redo: () => { this.um?.redo(); }
    });
    this.rebuild();
    setInfo({ status: 'live' });
    S().toast(this.mode === 'create' ? 'Live session started. Share the invite link.' : this.mode === 'rejoin' ? 'Reconnected to the live session' : 'Joined the live session');
    this.maybeCompact();
  }

  queueRebuild() {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => { this.queued = false; this.rebuild(); });
  }

  rebuild() {
    const p = readProject(this.doc);
    OP.model.normalize(p);
    p.nextUid = this.myNext;
    syncProject(p);
  }

  maybeCompact() {
    if (this.logLen < COMPACT_AT || !this.synced || !this.ws || this.ws.readyState !== 1 || this.seq <= 0) return;
    const upTo = this.seq, ws = this.ws;
    this.logLen = 1;
    seal(this.key, Y.encodeStateAsUpdate(this.doc)).then(d => { if (ws.readyState === 1) ws.send(JSON.stringify({ t: 's', upTo, d })); });
  }

  fail(message: string) {
    S().toast(message, true);
    this.leave();
  }

  leave() {
    this.closed = true;
    clearTimeout(this.timer);
    try { this.ws?.close(); } catch { /* already closed */ }
    setCollabHooks(null);
    this.um?.destroy();
    this.doc.destroy();
    try { localStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ }
    if (current === this) current = null;
    useStore.setState({ collab: COLLAB_OFF, undo: [], redo: [] });
  }
}

let current: Session | null = null;

export async function startSession() {
  if (current) return;
  const keyText = newKeyText();
  current = new Session(randomId(), keyText, await importKey(keyText), 'create');
  current.start();
}

export async function joinSession(room: string, keyText: string, mode: Exclude<Mode, 'create'> = 'join') {
  if (current && current.room === room) return;
  current?.leave();
  let key: CryptoKey;
  try { key = await importKey(keyText); } catch { S().toast('This invite link is damaged. Ask for it again.', true); return; }
  current = new Session(room, keyText, key, mode);
  current.start();
}

export function leaveSession() {
  current?.leave();
  S().toast('Left the live session. The plan stays on this computer.');
}
