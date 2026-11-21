// Who is in a live session: a name, a colour and the task each person has selected. This is sent as short
// "presence" messages that the relay passes on but never stores, encrypted like everything else. If the relay is
// an older version that ignores them, the plan still works; names and colours simply do not appear.

export interface Person { id: string; name: string; color: string; uid: number | null }

export const NAME_KEY = 'openplan.name';
export const PRESENCE_EVERY_MS = 5000;
export const PRESENCE_EXPIRES_MS = 15000;
export const MAX_PEOPLE = 50;
// Eight colours that read on both the light and the dark theme, and are told apart by more than colour (the name).
export const COLORS = ['#b5532a', '#2f7d6d', '#3d5fa8', '#8a4f9e', '#9a7b12', '#c2417a', '#4d8a2b', '#5d6b78'];

export const colorFor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
};

// Keep a colour unless someone else with a smaller id already has it; then take the next free one. Only one of
// two people with the same colour ever moves, so they cannot keep swapping.
export function pickColor(me: Person, others: Person[]): string {
  const taken = (c: string) => others.some(o => o.id !== me.id && o.color === c && o.id < me.id);
  if (!taken(me.color)) return me.color;
  const start = COLORS.indexOf(me.color);
  for (let i = 1; i < COLORS.length; i++) {
    const c = COLORS[(start + i) % COLORS.length];
    if (!others.some(o => o.id !== me.id && o.color === c)) return c;
  }
  return me.color;
}

// eslint-disable-next-line no-control-regex
export const cleanName = (v: unknown) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30);
export const initialsOf = (name: string) => {
  const w = cleanName(name).split(' ').filter(Boolean);
  return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || '?').slice(0, 2)).toUpperCase();
};

// A message from another person is untrusted: keep only well-formed fields.
export function readPerson(raw: unknown): Person | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{4,40}$/.test(r.id)) return null;
  const color = typeof r.color === 'string' && COLORS.includes(r.color) ? r.color : colorFor(r.id);
  const uid = typeof r.uid === 'number' && Number.isFinite(r.uid) ? r.uid : null;
  return { id: r.id, name: cleanName(r.name) || 'Someone', color, uid };
}

// The people last heard from, dropping anyone silent for too long (closed their tab, lost connection).
export class Roster {
  private seen = new Map<string, { person: Person; at: number }>();
  update(p: Person, now = Date.now()) {
    if (!this.seen.has(p.id) && this.seen.size >= MAX_PEOPLE) return false;
    const old = this.seen.get(p.id);
    this.seen.set(p.id, { person: p, at: now });
    return !old || JSON.stringify(old.person) !== JSON.stringify(p);
  }
  prune(now = Date.now()) {
    let gone = false;
    this.seen.forEach((v, id) => { if (now - v.at > PRESENCE_EXPIRES_MS) { this.seen.delete(id); gone = true; } });
    return gone;
  }
  list(): Person[] { return [...this.seen.values()].map(v => v.person).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)); }
  clear() { this.seen.clear(); }
}
