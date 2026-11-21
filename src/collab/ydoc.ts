import * as Y from 'yjs';
import type { Project } from '../types';

// How a project is stored in a shared Yjs document, so that edits by different people merge field by field:
//   meta      project settings (name, start, budget, holidays, baseline …)
//   tasks     task uid -> a map of that task's fields
//   order     task uids in outline order
//   res       resource uid -> a map of that resource's fields
//   rorder    resource uids in sheet order
// Values are plain JSON, so a task's links or assignments change as one unit; other fields merge independently.
// A task's comments are the exception: each one is its own entry ("c:" + its id) in the task's map, so two people
// commenting on the same task at the same moment both keep their comment.

export const ROOT_TYPES = ['meta', 'tasks', 'order', 'res', 'rorder'] as const;
const SKIP_META = new Set(['version', 'nextUid', 'tasks', 'resources']);
const BATCH = 150;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const CKEY = 'c:';
const cmap = (list: any): Map<string, any> => new Map((Array.isArray(list) ? list : []).filter((c: any) => c && typeof c.id === 'string').map((c: any) => [c.id, c]));

export const parts = (doc: Y.Doc) => ({
  meta: doc.getMap<any>('meta'), tasks: doc.getMap<Y.Map<any>>('tasks'), order: doc.getArray<number>('order'),
  res: doc.getMap<Y.Map<any>>('res'), rorder: doc.getArray<number>('rorder')
});

export function isEmpty(doc: Y.Doc) { return parts(doc).meta.size === 0; }

function writeItems(map: Y.Map<Y.Map<any>>, prev: any[], next: any[]) {
  const before = new Map<number, any>(prev.map(o => [o.uid, o]));
  const keep = new Set(next.map(o => o.uid));
  before.forEach((_, uid) => { if (!keep.has(uid)) map.delete(String(uid)); });
  for (const o of next) {
    const old = before.get(o.uid), key = String(o.uid);
    let m = map.get(key);
    if (!old || !m) {
      m = new Y.Map<any>();
      for (const k in o) if (k !== 'comments' && o[k] !== undefined) m.set(k, o[k]);
      cmap(o.comments).forEach((c, id) => m!.set(CKEY + id, c));
      map.set(key, m);
      continue;
    }
    for (const k in o) if (k !== 'comments' && !same(o[k], old[k])) m.set(k, o[k]);
    for (const k in old) if (k !== 'comments' && !(k in o)) m.delete(k);
    if ('comments' in o || 'comments' in old) {
      const was = cmap(old.comments), now = cmap(o.comments);
      was.forEach((_, id) => { if (!now.has(id)) m!.delete(CKEY + id); });
      now.forEach((c, id) => { if (!was.has(id) || !same(c, was.get(id))) m!.set(CKEY + id, c); });
    }
  }
}

// Make the shared array hold exactly `next` (unique uids) using the fewest inserts and deletes.
export function writeOrder(arr: Y.Array<number>, next: number[]) {
  const want = new Set(next);
  for (let i = arr.length - 1; i >= 0; i--) if (!want.has(arr.get(i))) arr.delete(i, 1);
  for (let i = 0; i < next.length; i++) {
    if (i < arr.length && arr.get(i) === next[i]) continue;
    const cur = arr.toArray();
    const at = cur.indexOf(next[i], i + 1);
    if (at >= 0) arr.delete(at, 1);
    arr.insert(i, [next[i]]);
  }
  if (arr.length > next.length) arr.delete(next.length, arr.length - next.length);
}

// Write the change from `prev` to `next` into the document. With no `prev` the whole project is written,
// in several transactions when it is large so no single message is too big for the relay.
export function writeProject(doc: Y.Doc, prev: Project | null, next: Project, origin: unknown = 'local') {
  const p = parts(doc), old = prev || ({ tasks: [], resources: [] } as unknown as Project);
  const big = !prev && next.tasks.length > BATCH;
  doc.transact(() => {
    for (const k of Object.keys(next)) {
      if (SKIP_META.has(k)) continue;
      const v = (next as any)[k];
      if (!same(v, (old as any)[k]) || !p.meta.has(k)) p.meta.set(k, v);
    }
    writeItems(p.res, old.resources, next.resources);
    writeOrder(p.rorder, next.resources.map(r => r.uid));
    if (!big) {
      writeItems(p.tasks, old.tasks, next.tasks);
      writeOrder(p.order, next.tasks.map(t => t.uid));
    }
  }, origin);
  if (big) {
    for (let i = 0; i < next.tasks.length; i += BATCH) {
      const chunk = next.tasks.slice(i, i + BATCH);
      doc.transact(() => {
        writeItems(p.tasks, [], chunk);
        p.order.insert(p.order.length, chunk.map(t => t.uid));
      }, origin);
    }
  }
}

function readItems(map: Y.Map<Y.Map<any>>, order: Y.Array<number>): any[] {
  const out: any[] = [], seen = new Set<number>();
  const take = (uid: number) => {
    const m = map.get(String(uid));
    if (!m || seen.has(uid)) return;
    seen.add(uid);
    const raw = m.toJSON(), item: any = {}, comments: any[] = [];
    for (const k in raw) { if (k.startsWith(CKEY)) comments.push(raw[k]); else item[k] = raw[k]; }
    if (comments.length) item.comments = comments.sort((a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)));
    out.push(item);
  };
  order.forEach(take);
  // Items that are in the map but missing from the order (an edit that crossed a delete) go last.
  [...map.keys()].map(Number).sort((a, b) => a - b).forEach(take);
  return out;
}

export function readProject(doc: Y.Doc): Project {
  const p = parts(doc), out: any = {};
  p.meta.forEach((v, k) => { out[k] = JSON.parse(JSON.stringify(v)); });
  out.tasks = readItems(p.tasks, p.order);
  out.resources = readItems(p.res, p.rorder);
  return out as Project;
}
