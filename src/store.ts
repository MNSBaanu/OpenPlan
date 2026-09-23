import { create } from 'zustand';
import OP from './core';
import type { Project, Schedule, ViewName } from './types';

const STORE = 'openplan.project';
const UISTORE = 'openplan.ui';

export const DEFAULT_COLS = ['id', 'ind', 'name', 'duration', 'start', 'finish', 'preds', 'res', 'cost'];
export const ZOOMS = ['day', 'week', 'month', 'quarter'] as const;
export const VIEW_NAMES: Record<ViewName, string> = {
  gantt: 'Gantt Chart', network: 'Network Diagram', wbs: 'WBS Chart', resources: 'Resource Sheet',
  org: 'Team Chart', workload: 'Resource Usage', budget: 'Cost & Budget', reports: 'Reports'
};
const VIEW_TABS: Partial<Record<ViewName, string>> = {
  gantt: 'task', resources: 'resource', org: 'resource', workload: 'resource', reports: 'report', budget: 'report'
};

export interface UIState {
  view: ViewName;
  zoom: string;
  critical: boolean;
  gridW: number;
  drawer: boolean;
  netScope: string;
  netDates: boolean;
  netZoom: number;
  wbsDepth: number;
  filter: string;
  group: string;
  sort: string;
  cols: string[];
  showBaseline: boolean;
  report: string;
  tab: string;
  timeline: boolean;
  ribbonMin: boolean;
  theme: 'light' | 'dark';
  bars: string;
}

const UI_DEFAULTS: UIState = {
  view: 'gantt', zoom: 'week', critical: true, gridW: 600, drawer: window.innerWidth > 1100, netScope: 'all', netDates: false,
  netZoom: 1, wbsDepth: 99, filter: 'all', group: 'none', sort: 'id', cols: DEFAULT_COLS.slice(), showBaseline: true,
  report: 'overview', tab: 'task', timeline: true, ribbonMin: false, theme: 'light', bars: 'blue'
};
const PERSISTED_UI: (keyof UIState)[] = ['view', 'zoom', 'critical', 'gridW', 'drawer', 'netDates', 'wbsDepth', 'filter', 'group', 'sort', 'cols', 'showBaseline', 'report', 'tab', 'timeline', 'theme', 'bars'];

export interface Dialog { type: string; props?: any }

export interface Store extends UIState {
  p: Project;
  s: Schedule;
  undo: string[];
  redo: string[];
  saved: boolean;
  sel: number[];
  anchor: number | null;
  collapsed: Record<string, boolean>;
  backstage: boolean;
  bsPage: string;
  menu: string | null;
  dialog: Dialog | null;
  toastMsg: { text: string; err: boolean; id: number } | null;
  pendingFocus: string | null;

  setUI: (patch: Partial<Store>) => void;
  setView: (view: ViewName) => void;
  commit: (fn: (p: Project) => void | false) => boolean;
  undoAct: () => void;
  redoAct: () => void;
  replaceProject: (p: Project, msg?: string) => void;
  select: (uids: number[], anchor?: number | null) => void;
  toast: (text: string, err?: boolean) => void;
  openDialog: (type: string, props?: any) => void;
  closeDialog: () => void;
}

function loadUI(): Partial<UIState> {
  try {
    const ui = JSON.parse(localStorage.getItem(UISTORE) || '{}');
    const out: any = {};
    PERSISTED_UI.forEach(k => { if (ui[k] != null) out[k] = ui[k]; });
    return out;
  } catch {
    return {};
  }
}

function saveUI(st: Store) {
  try {
    const ui: any = {};
    PERSISTED_UI.forEach(k => { ui[k] = st[k]; });
    localStorage.setItem(UISTORE, JSON.stringify(ui));
  } catch { /* storage unavailable */ }
}

function persist(json: string): boolean {
  try { localStorage.setItem(STORE, json); return true; } catch { return false; }
}

function loadProject(): Project {
  try {
    const saved = localStorage.getItem(STORE);
    const p = saved ? OP.io.fromJSON(saved) : OP.demo();
    return OP.model.normalize(p);
  } catch {
    return OP.model.normalize(OP.demo());
  }
}

const initial = loadProject();
let toastId = 0;

export const useStore = create<Store>((set, get) => ({
  ...UI_DEFAULTS,
  ...loadUI(),
  p: initial,
  s: OP.schedule(initial),
  undo: [],
  redo: [],
  saved: persist(JSON.stringify(initial)),
  sel: [],
  anchor: null,
  collapsed: {},
  backstage: false,
  bsPage: 'info',
  menu: null,
  dialog: null,
  toastMsg: null,
  pendingFocus: null,

  setUI: patch => {
    set(patch);
    if (Object.keys(patch).some(k => (PERSISTED_UI as string[]).includes(k))) saveUI(get());
  },

  setView: view => {
    const tab = VIEW_TABS[view] || get().tab;
    get().setUI({ view, tab, netZoom: 1, backstage: false, menu: null });
  },

  // Every change to the project goes through commit() so it can be undone.
  commit: fn => {
    const before = JSON.stringify(get().p);
    const next: Project = JSON.parse(before);
    if (fn(next) === false) return false;
    const after = JSON.stringify(next);
    if (after === before) return false;
    const undo = get().undo.concat([before]).slice(-100);
    set({ p: next, s: OP.schedule(next), undo, redo: [], saved: persist(after) });
    return true;
  },

  undoAct: () => {
    const { undo, redo, p } = get();
    if (!undo.length) return;
    const prev = JSON.parse(undo[undo.length - 1]);
    set({ p: prev, s: OP.schedule(prev), undo: undo.slice(0, -1), redo: redo.concat([JSON.stringify(p)]), saved: persist(JSON.stringify(prev)) });
  },

  redoAct: () => {
    const { undo, redo, p } = get();
    if (!redo.length) return;
    const next = JSON.parse(redo[redo.length - 1]);
    set({ p: next, s: OP.schedule(next), redo: redo.slice(0, -1), undo: undo.concat([JSON.stringify(p)]), saved: persist(JSON.stringify(next)) });
  },

  replaceProject: (p, msg) => {
    OP.model.normalize(p);
    set({ p, s: OP.schedule(p), undo: get().undo.concat([JSON.stringify(get().p)]), redo: [], sel: [], collapsed: {}, saved: persist(JSON.stringify(p)) });
    if (msg) get().toast(msg);
  },

  select: (uids, anchor = null) => set({ sel: uids, anchor: anchor ?? (uids[0] ?? null) }),

  toast: (text, err = false) => set({ toastMsg: { text, err, id: ++toastId } }),
  openDialog: (type, props) => set({ dialog: { type, props }, menu: null }),
  closeDialog: () => set({ dialog: null })
}));

// Non-reactive access for event handlers and helpers.
export const S = () => useStore.getState();

export function taskByUid(uid: number) { return S().p.tasks.find(t => t.uid === uid) || null; }
export function resByUid(uid: number) { return S().p.resources.find(r => r.uid === uid) || null; }
export function rowByUid(uid: number) { return S().s.rows.find((r: any) => r.task.uid === uid) || null; }

// Focus an element by its data-fk key once React has rendered.
export function focusKey(fk: string, select = true) {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLInputElement>('[data-fk="' + fk + '"]');
    if (!el) return;
    el.focus();
    if (select && el.select) try { el.select(); } catch { /* not selectable */ }
  });
}
