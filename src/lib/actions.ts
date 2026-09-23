import OP from '../core';
import { S, VIEW_NAMES, type Store } from '../store';
import { gridItems } from './grid';
import type { Project } from '../types';

const U = OP.util, C = OP.charts, IO = OP.io;

const W = window as any;
const FS = !!W.showSaveFilePicker;
const TYPES = [{ description: 'OpenPlan project', accept: { 'application/x-openplan': ['.openplan'] } }];
let handle: any = null;

async function saveFile(as: boolean) {
  const st = S();
  if (!FS) { U.download(U.slug(st.p.name) + '.openplan', IO.toJSON(st.p), 'application/x-openplan'); st.toast('Project file downloaded'); return; }
  try {
    if (as || !handle) handle = await W.showSaveFilePicker({ suggestedName: U.slug(st.p.name) + '.openplan', types: TYPES });
    const w = await handle.createWritable();
    await w.write(IO.toJSON(st.p));
    await w.close();
    st.toast('Saved to ' + handle.name);
  } catch (e: any) {
    if (e.name !== 'AbortError') st.toast('Could not save: ' + e.message, true);
  }
}

async function openHandle(h: any) {
  const file = await h.getFile();
  S().replaceProject(IO.parseAny(await file.text()), 'Opened ' + file.name);
  handle = /\.(openplan|json)$/i.test(file.name) ? h : null;
}

async function openFile() {
  try {
    const [h] = await W.showOpenFilePicker({ types: [{ description: 'Project files', accept: { 'application/x-openplan': ['.openplan'], 'application/json': ['.json'], 'application/xml': ['.xml'] } }] });
    await openHandle(h);
  } catch (e: any) {
    if (e.name !== 'AbortError') S().toast('Could not open file: ' + e.message, true);
  }
}

export function handleLaunchFiles() {
  W.launchQueue?.setConsumer((params: any) => {
    if (params.files?.length) openHandle(params.files[0]).catch((e: any) => S().toast('Could not open file: ' + e.message, true));
  });
}

export function scopeRows(st: Store) {
  if (st.netScope === 'all') return st.s.rows;
  const r = st.s.rows.find((x: any) => String(x.task.uid) === String(st.netScope));
  return r ? r.leaves.map((i: number) => st.s.rows[i]) : st.s.rows;
}

// SVG markup for the current view (null when the view is not a picture).
export function viewSvgString(st: Store): string | null {
  if (st.view === 'gantt') {
    return C.gantt({ p: st.p, s: st.s, rows: gridItems(st), zoom: st.zoom, critical: st.critical, table: true, flat: st.group !== 'none', baseline: st.showBaseline && !!st.p.baseline }).svg;
  }
  if (!st.s.rows.length && st.view !== 'org') return null;
  if (st.view === 'network') {
    const sr = st.netScope === 'all' ? null : st.s.rows.find((x: any) => String(x.task.uid) === String(st.netScope));
    const title = sr ? sr.wbs + ' ' + sr.task.name : st.p.name + ' — activity network';
    return C.network({ p: st.p, s: st.s, rows: scopeRows(st), critical: st.critical, dates: st.netDates, title }).svg;
  }
  if (st.view === 'wbs') return C.wbs({ p: st.p, s: st.s, depth: st.wbsDepth }).svg;
  if (st.view === 'org') {
    const people = st.p.resources.filter(r => r.kind === 'Work');
    return people.length ? C.org({ p: { resources: people, currency: st.p.currency } }).svg : null;
  }
  return null;
}

export const hasImage = (st: Store) => ['gantt', 'network', 'wbs', 'org'].includes(st.view);

function svgElement(str: string): SVGSVGElement {
  return new DOMParser().parseFromString(str, 'image/svg+xml').documentElement as unknown as SVGSVGElement;
}

export function runAction(a: string) {
  const st = S(), name = U.slug(st.p.name);
  st.setUI({ menu: null, backstage: false });
  switch (a) {
    case 'new':
      if (confirm('Start a new blank project? The current one can be restored with Undo.')) { handle = null; st.replaceProject(OP.model.blank(), 'New project created'); }
      break;
    case 'sample': handle = null; st.replaceProject(OP.demo(), 'Sample project loaded'); break;
    case 'open': if (FS) openFile(); else pickFile(false); break;
    case 'insert': pickFile(true); break;
    case 'save': saveFile(false); break;
    case 'saveas': saveFile(true); break;
    case 'xml': U.download(name + '.xml', IO.toMSPDI(st.p), 'application/xml'); st.toast('MS Project XML downloaded — open it in ProjectLibre or MS Project'); break;
    case 'csv': U.download(name + '-tasks.csv', '﻿' + IO.toCSV(st.p), 'text/csv'); st.toast('CSV downloaded'); break;
    case 'mpp': case 'pod': st.openDialog('convert', { kind: a }); break;
    case 'png': case 'svg': {
      const svg = viewSvgString(st);
      if (!svg) { st.toast('Switch to Gantt, Network, WBS or Team Chart to export an image.'); return; }
      if (a === 'png') IO.exportPNG(svgElement(svg), name + '-' + st.view);
      else IO.exportSVG(svgElement(svg), name + '-' + st.view);
      break;
    }
    case 'print': {
      const svg = viewSvgString(st);
      if (svg) IO.printSVG(svgElement(svg), st.p.name + ' — ' + VIEW_NAMES[st.view]);
      else window.print();
      break;
    }
    case 'settings': st.openDialog('settings'); break;
    case 'about': st.openDialog('about'); break;
  }
}

function pickFile(insert: boolean) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.openplan,.json,.xml,application/json,text/xml';
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const st = S();
      try {
        const p: Project = IO.parseAny(String(reader.result));
        if (insert) {
          let uid = 0;
          st.commit(pp => { uid = IO.insertProject(pp, p); });
          st.select([uid], uid);
          st.toast('Inserted ' + file.name + ' as a subproject');
        } else st.replaceProject(p, 'Opened ' + file.name);
      } catch (e: any) {
        st.toast('Could not open file: ' + e.message, true);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

export function downloadXml() {
  const st = S();
  U.download(U.slug(st.p.name) + '.xml', IO.toMSPDI(st.p), 'application/xml');
}
