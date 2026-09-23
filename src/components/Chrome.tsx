import { useEffect } from 'react';
import OP from '../core';
import { useStore, VIEW_NAMES, ZOOMS } from '../store';
import { hasImage, runAction } from '../lib/actions';
import Icon from './Icon';
import type { ViewName } from '../types';

const U = OP.util;
const LOGO_MARK = './assets/openplan-mark.svg';

/* ---------- title bar ---------- */

export function TitleBar() {
  const st = useStore();
  useEffect(() => { document.title = st.p.name + ' - OpenPlan'; }, [st.p.name]);
  return (
    <header className="titlebar">
      <div className="qat">
        <img className="app-icon" src={LOGO_MARK} alt="" />
        <button className="qat-btn" title="Save (Ctrl+S)" aria-label="Save" onClick={() => runAction('save')}><Icon name="save" /></button>
        <button className="qat-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!st.undo.length} onClick={st.undoAct}><Icon name="undo" /></button>
        <button className="qat-btn" title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!st.redo.length} onClick={st.redoAct}><Icon name="redo" /></button>
      </div>
      <div className="title">{st.p.name} - OpenPlan</div>
      <div className="tb-right">
        <button className="qat-btn" title="Dark / light" aria-label="Toggle dark mode" onClick={() => st.setUI({ theme: st.theme === 'dark' ? 'light' : 'dark' })}>
          <Icon name={st.theme === 'dark' ? 'sun' : 'moon'} />
        </button>
        <button className="qat-btn" title="About OpenPlan" aria-label="About" onClick={() => st.openDialog('about')}><Icon name="info" /></button>
      </div>
    </header>
  );
}

/* ---------- status bar ---------- */

const SB_VIEWS: [ViewName, string][] = [['gantt', 'gantt'], ['resources', 'users'], ['network', 'network'], ['reports', 'report']];

export function StatusBar() {
  const st = useStore();
  const zi = ZOOMS.indexOf(st.zoom as any);
  const setZoom = (i: number) => st.setUI({ zoom: ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, i))] });
  return (
    <footer className="statusbar">
      <span>Ready</span>
      <span className="sb-sep" />
      <span className="hide-sm">New Tasks : Auto Scheduled</span>
      <span className="sb-sep hide-sm" />
      <span className="save-state">
        {st.saved ? <><Icon name="check" />Saved in this browser</> : <span style={{ color: 'var(--warn)' }}><Icon name="alert" />Browser storage unavailable — use File › Save</span>}
      </span>
      <span className="spacer" />
      <div className="sb-views">
        {SB_VIEWS.map(([v, icon]) => (
          <button key={v} className={st.view === v ? 'active' : ''} title={VIEW_NAMES[v]} aria-label={VIEW_NAMES[v]} onClick={() => st.setView(v)}><Icon name={icon} /></button>
        ))}
      </div>
      <div className="sb-zoom" title="Timescale zoom">
        <span className="z-btn" onClick={() => setZoom(zi - 1)}>−</span>
        <input type="range" min={0} max={3} step={1} value={zi} aria-label="Timescale zoom" onChange={e => setZoom(+e.target.value)} />
        <span className="z-btn" onClick={() => setZoom(zi + 1)}>+</span>
      </div>
    </footer>
  );
}

/* ---------- toast ---------- */

export function Toast() {
  const msg = useStore(s => s.toastMsg);
  const setUI = useStore(s => s.setUI);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setUI({ toastMsg: null }), msg.err ? 4200 : 2600);
    return () => clearTimeout(t);
  }, [msg]);
  return <div className={'toast' + (msg ? ' show' : '') + (msg && msg.err ? ' err' : '')} role="status" aria-live="polite">{msg ? msg.text : ''}</div>;
}

/* ---------- File backstage ---------- */

const PAGES: [string, string][] = [['info', 'Info'], ['new', 'New'], ['open', 'Open'], ['save', 'Save'], ['export', 'Export'], ['print', 'Print'], ['about', 'About']];

function Tile({ icon, title, sub, act, disabled }: { icon: string; title: string; sub: string; act: string; disabled?: boolean }) {
  return (
    <button className="bs-tile" disabled={disabled} onClick={() => runAction(act)}>
      <Icon name={icon} /><div><b>{title}</b><span>{sub}</span></div>
    </button>
  );
}

export function Backstage() {
  const st = useStore();
  useEffect(() => {
    if (!st.backstage) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') st.setUI({ backstage: false }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [st.backstage]);
  if (!st.backstage) return null;
  const p = st.p, s = st.s, page = st.bsPage, img = hasImage(st), viewName = VIEW_NAMES[st.view];
  let body: JSX.Element;
  if (page === 'new') {
    body = <><h1>New</h1><div className="bs-cards">
      <button className="bs-card" onClick={() => runAction('new')}><div className="bs-thumb blank" /><b>Blank Project</b></button>
      <button className="bs-card" onClick={() => runAction('sample')}><div className="bs-thumb sample"><i /><i /><i /></div><b>Sample Project</b></button>
    </div></>;
  } else if (page === 'open') {
    body = <><h1>Open</h1>
      <Tile icon="upload" title="Browse…" sub="OpenPlan (.openplan, .json) or MS Project XML (.xml) files" act="open" />
      <Tile icon="layers" title="Insert as Subproject…" sub="Add another project file under a new summary task" act="insert" />
      <p className="bs-note">To open an .mpp or .pod file, open it in MS Project or ProjectLibre first and save it as XML.</p></>;
  } else if (page === 'save') {
    body = <><h1>Save</h1>
      <Tile icon="save" title="Save" sub="Save to an OpenPlan (.openplan) file on your computer; Ctrl+S saves back to the same file" act="save" />
      <Tile icon="save" title="Save As…" sub="Save a copy under a new name or location" act="saveas" />
      <p className="bs-note">{st.saved ? 'Your work is also saved automatically in this browser.' : 'Browser storage is unavailable: download a project file to keep your work.'}</p></>;
  } else if (page === 'export') {
    body = <><h1>Export</h1>
      <Tile icon="file" title="MS Project XML (.xml)" sub="Opens in MS Project, ProjectLibre and Project Plan 365" act="xml" />
      <Tile icon="file" title="MS Project (.mpp)" sub="Saves XML plus the steps to convert it in MS Project" act="mpp" />
      <Tile icon="file" title="ProjectLibre (.pod)" sub="Saves XML plus the steps to convert it in ProjectLibre" act="pod" />
      <Tile icon="table" title="Excel (.csv)" sub="Task table with dates, costs and slack" act="csv" />
      <Tile icon="image" title={'Picture of the ' + viewName + ' (.png)'} sub={img ? 'For Word reports' : 'Switch to Gantt, Network, WBS or Team Chart first'} act="png" disabled={!img} />
      <Tile icon="image" title="Vector picture (.svg)" sub="Sharp at any size" act="svg" disabled={!img} /></>;
  } else if (page === 'print') {
    body = <><h1>Print</h1><Tile icon="printer" title={'Print ' + viewName} sub="Use “Save as PDF” in the print dialog to create a PDF" act="print" /></>;
  } else if (page === 'about') {
    body = <><h1>About</h1><img src="./assets/openplan-logo.svg" alt="OpenPlan" height={48} />
      <p className="bs-note">Free, browser-based project planning: Gantt chart, critical path, network diagram, WBS, resources, leveling, baselines, tracking, earned value and reports.</p>
      <Tile icon="info" title="Keyboard shortcuts and help" sub="Editing tips for the task table and Gantt chart" act="about" /></>;
  } else {
    const props: [string, string][] = [
      ['Start', U.fmtLong(s.startDn)], ['Finish', U.fmtLong(s.finishDn)], ['Duration', U.num(s.duration) + ' days'],
      ['Cost', U.money(s.totalCost, p.currency)], ['Budget', p.budget ? U.money(p.budget, p.currency) : '—'], ['Work', U.num(s.totalWork) + ' hrs'],
      ['Tasks', String(p.tasks.length)], ['Resources', String(p.resources.length)], ['Status', p.status], ['Manager', p.manager || '—'], ['Organisation', p.organization || '—']
    ];
    body = <><h1>Info</h1><div className="bs-cols">
      <div><h2>{p.name}</h2>
        <Tile icon="info" title="Project Information" sub="Name, start date, status date, budget, calendar and custom fields" act="settings" />
        <button className="bs-tile" onClick={() => st.setUI({ backstage: false, tab: 'project' })}>
          <Icon name="layers" /><div><b>{p.baseline ? 'Baseline saved' : 'No baseline'}</b>
            <span>{p.baseline ? 'Saved ' + U.fmtLong(U.parseDate(p.baseline.savedAt.slice(0, 10))) : 'Project › Set Baseline saves the current plan for tracking'}</span></div>
        </button>
      </div>
      <div className="bs-props"><h3>Project Properties</h3>{props.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
    </div></>;
  }
  return (
    <div className="backstage">
      <nav className="bs-nav">
        <button className="bs-back" aria-label="Back" onClick={() => st.setUI({ backstage: false })}><Icon name="up" /></button>
        {PAGES.map(([k, label]) => <button key={k} className={'bs-item' + (page === k ? ' on' : '')} onClick={() => st.setUI({ bsPage: k })}>{label}</button>)}
      </nav>
      <div className="bs-body">{body}</div>
    </div>
  );
}
