import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import OP from '../core';
import { useStore, S } from '../store';
import { downloadXml } from '../lib/actions';
import * as ops from '../lib/taskOps';
import Icon from './Icon';
import type { Resource } from '../types';

const U = OP.util;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Modal({ title, children, onSubmit, okLabel = 'Save', cancelLabel = 'Cancel', noOk }: {
  title: string; children: ReactNode; onSubmit?: (fd: FormData) => boolean | void; okLabel?: ReactNode; cancelLabel?: string; noOk?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => S().closeDialog();
  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
  }, []);
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onSubmit && onSubmit(new FormData(e.currentTarget)) === false) return;
    close();
  };
  return (
    <dialog ref={ref} onClose={close} onCancel={e => { e.preventDefault(); close(); }}>
      <form onSubmit={submit}>
        <div className="dlg-head"><h2>{title}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={close}><Icon name="x" /></button></div>
        <div className="dlg-body">{children}</div>
        <div className="dlg-foot">
          <button type="button" className="btn" onClick={close}>{cancelLabel}</button>
          {!noOk && <button type="submit" className="btn primary">{okLabel}</button>}
        </div>
      </form>
    </dialog>
  );
}

function F({ label, name, value, type = 'text', ...rest }: { label: string; name: string; value?: any; type?: string; [k: string]: any }) {
  return <label className="field"><span>{label}</span><input className="inp" name={name} type={type} defaultValue={value ?? ''} {...rest} /></label>;
}

function parseDates(text: FormDataEntryValue | null, bad: string[]) {
  return String(text || '').split(/[\s,]+/).filter(Boolean).filter(d => {
    if (U.parseDate(d) == null) { bad.push(d); return false; }
    return true;
  });
}

function SettingsDialog() {
  const st = useStore(), p = st.p;
  const cf = p.customFields.map(f => f.name + (f.type === 'number' ? ' : number' : '')).join('\n');
  return (
    <Modal title="Project information" onSubmit={fd => {
      const bad: string[] = [];
      const hol = parseDates(fd.get('holidays'), bad);
      if (bad.length) st.toast('Ignored invalid holiday dates: ' + bad.join(', '), true);
      const lines = String(fd.get('custom') || '').split('\n').map(l => l.trim()).filter(Boolean);
      st.commit(pp => {
        pp.name = String(fd.get('name')).trim() || 'Untitled project';
        pp.organization = String(fd.get('organization'));
        pp.manager = String(fd.get('manager'));
        pp.status = String(fd.get('status'));
        pp.issueDate = String(fd.get('issueDate'));
        pp.start = String(fd.get('start')) || pp.start;
        pp.statusDate = String(fd.get('statusDate'));
        pp.hoursPerDay = Math.max(1, Math.min(24, +fd.get('hoursPerDay')! || 8));
        pp.budget = Math.max(0, +fd.get('budget')! || 0);
        pp.currency = String(fd.get('currency')).trim();
        pp.holidays = hol;
        const old = pp.customFields;
        pp.customFields = lines.map((l, k) => {
          const m = /^(.*?)\s*:\s*number$/i.exec(l), name = m ? m[1] : l;
          const prev = old.find(f => f.name === name) || old[k];
          return { id: prev ? prev.id : 'c' + Date.now().toString(36) + k, name, type: m ? 'number' : 'text' };
        });
      });
    }}>
      <F label="Project name" name="name" value={p.name} />
      <div className="row2"><F label="Issuing organisation" name="organization" value={p.organization} /><F label="Project manager" name="manager" value={p.manager} /></div>
      <div className="row2">
        <label className="field"><span>Status</span><select className="sel" name="status" defaultValue={p.status}>
          {['Draft', 'In review', 'Approved', 'Baselined', 'Final'].map(s => <option key={s}>{s}</option>)}
        </select></label>
        <F label="Date of issue" name="issueDate" value={p.issueDate} type="date" />
      </div>
      <div className="row2"><F label="Project start date" name="start" value={p.start} type="date" required /><F label="Status date (for tracking)" name="statusDate" value={p.statusDate} type="date" /></div>
      <div className="row3">
        <F label="Budget" name="budget" value={p.budget} type="number" min={0} step={1000} />
        <F label="Currency symbol" name="currency" value={p.currency} />
        <F label="Hours per working day" name="hoursPerDay" value={p.hoursPerDay} type="number" min={1} max={24} step={0.5} />
      </div>
      <label className="field"><span>Holidays (one date per line, YYYY-MM-DD) — non-working days besides weekends</span>
        <textarea className="inp" name="holidays" rows={3} defaultValue={(p.holidays || []).join('\n')} /></label>
      <label className="field"><span>Custom task fields (one per line; add “: number” for numeric fields)</span>
        <textarea className="inp" name="custom" rows={3} placeholder={'Owner\nStory points : number'} defaultValue={cf} /></label>
    </Modal>
  );
}

function RecurringDialog() {
  const st = useStore();
  return (
    <Modal title="Recurring task" okLabel="Create" onSubmit={fd => {
      const name = String(fd.get('name')).trim(), first = U.parseDate(String(fd.get('first')));
      if (!name || first == null) return false;
      ops.createRecurring({
        name, first, duration: Math.max(0, +fd.get('duration')! || 0),
        count: Math.max(1, Math.min(104, +fd.get('count')! || 1)), every: Math.max(1, +fd.get('every')! || 1), unit: String(fd.get('unit'))
      });
      st.setView('gantt');
    }}>
      <F label="Task name" name="name" value="Sprint review" required />
      <div className="row3">
        <F label="Duration (days)" name="duration" value={1} type="number" min={0} step={0.5} />
        <F label="First occurrence" name="first" value={U.iso(st.s.startDn)} type="date" required />
        <F label="Occurrences" name="count" value={4} type="number" min={1} max={104} />
      </div>
      <div className="row2">
        <label className="field"><span>Repeat</span><select className="sel" name="unit" defaultValue="week">
          <option value="week">Weekly</option><option value="month">Monthly</option><option value="day">Daily (working days)</option>
        </select></label>
        <F label="Every" name="every" value={2} type="number" min={1} max={52} />
      </div>
      <p className="muted small">Creates a summary task with one subtask per occurrence, each fixed with a “Start no earlier than” date.</p>
    </Modal>
  );
}

function ResourceDialog({ uid }: { uid: number }) {
  const st = useStore(), r = st.p.resources.find(x => x.uid === uid) as Resource;
  if (!r) return null;
  const rates = (r.rates || []).map(e => e.from + ' ' + e.rate).join('\n');
  return (
    <Modal title={r.name || 'Resource'} onSubmit={fd => {
      const bad: string[] = [];
      const vac = parseDates(fd.get('vacations'), bad);
      const rateList: { from: string; rate: number }[] = [];
      String(fd.get('rates') || '').split('\n').forEach(line => {
        const m = /^\s*(\d{4}-\d{2}-\d{2})[\s,;]+(\d+(?:\.\d+)?)\s*$/.exec(line);
        if (m) rateList.push({ from: m[1], rate: +m[2] });
        else if (line.trim()) bad.push(line.trim());
      });
      if (bad.length) st.toast('Ignored: ' + bad.join(', '), true);
      st.commit(p => {
        const x = p.resources.find(y => y.uid === uid)!;
        if (x.kind === 'Work') {
          x.workDays = fd.getAll('wd').map(Number).sort();
          x.vacations = vac;
          x.rates = rateList.sort((a, b) => (a.from < b.from ? -1 : 1));
        }
        if (x.kind === 'Material') x.materialLabel = String(fd.get('materialLabel') || '');
        if (x.kind !== 'Cost') x.costPerUse = Math.max(0, +fd.get('costPerUse')! || 0);
      });
    }}>
      {r.kind === 'Work' && <>
        <label className="field"><span>Working days</span><div className="chk-row">
          {[1, 2, 3, 4, 5, 6, 0].map(d => <label key={d} className="chk"><input type="checkbox" name="wd" value={d} defaultChecked={r.workDays.includes(d)} />{DAY_NAMES[d]}</label>)}
        </div></label>
        <label className="field"><span>Vacations / days off (one date per line, YYYY-MM-DD)</span><textarea className="inp" name="vacations" rows={3} defaultValue={r.vacations.join('\n')} /></label>
        <label className="field"><span>Rate changes (one per line: effective date and new hourly rate)</span><textarea className="inp" name="rates" rows={3} placeholder="2026-04-01 8500" defaultValue={rates} /></label>
        <p className="muted small">Working days and vacations set when this person is available: they drive overallocation warnings and resource leveling.</p>
      </>}
      {r.kind === 'Material' && <F label="Material label (unit)" name="materialLabel" value={r.materialLabel} placeholder="e.g. licences, servers" />}
      {r.kind !== 'Cost'
        ? <F label={'Cost per use (' + st.p.currency + ')'} name="costPerUse" value={r.costPerUse} type="number" min={0} step={100} />
        : <p className="muted">Cost resources (travel, licences, fees) have no rate: enter the amount on each task assignment.</p>}
    </Modal>
  );
}

function ConvertDialog({ kind }: { kind: 'mpp' | 'pod' }) {
  const st = useStore(), mpp = kind === 'mpp';
  return (
    <Modal title={mpp ? 'Export to MS Project (.mpp)' : 'Export to ProjectLibre (.pod)'} cancelLabel="Close"
      okLabel={<><Icon name="download" />Download XML</>}
      onSubmit={() => { downloadXml(); st.toast('XML downloaded — now open it in ' + (mpp ? 'MS Project' : 'ProjectLibre') + ' and Save As .' + kind); }}>
      <p>{mpp ? '.mpp is Microsoft’s closed file format' : '.pod is ProjectLibre’s internal Java format'}, so a web page cannot write it directly.
        OpenPlan saves an MS Project XML file that {mpp ? 'MS Project' : 'ProjectLibre'} opens without losing tasks, links, resources, costs or the baseline.</p>
      <ol className="steps">
        <li>Click <b>Download XML</b> below.</li>
        <li>Open the file in {mpp ? 'Microsoft Project' : 'ProjectLibre (free, projectlibre.com)'} (File › Open, choose the .xml).</li>
        <li>Choose <b>File › Save As</b> and pick <b>{mpp ? 'Project (*.mpp)' : 'ProjectLibre (*.pod)'}</b>.</li>
      </ol>
    </Modal>
  );
}

function AboutDialog() {
  return (
    <Modal title="About OpenPlan" cancelLabel="Close" noOk>
      <p>OpenPlan is a free, browser-based project planner: WBS, Gantt chart, critical path, network diagram, resources, leveling, baselines, tracking, earned value, budget and reports. Your project is stored only in this browser; use <b>File › Save</b> to keep a copy.</p>
      <div className="logos"><img src="./assets/openplan-logo.png" alt="OpenPlan" height={40} /></div>
      <p><b>Keyboard</b><br /><kbd>Enter</kbd>/<kbd>↑</kbd><kbd>↓</kbd> move between rows · <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>→</kbd>/<kbd>←</kbd> indent/outdent · <kbd>Ins</kbd> new task · <kbd>Del</kbd> delete selected · <kbd>Ctrl</kbd>+<kbd>Z</kbd>/<kbd>Y</kbd> undo/redo · <kbd>Ctrl</kbd>+<kbd>S</kbd> save file</p>
      <p><b>Gantt chart</b><br />Drag a bar to move it (sets a “Start no earlier than” constraint), drag its right edge to change the duration, or drag it up/down onto another bar to link the two.</p>
      <p><b>Predecessors</b><br />Type task IDs separated by commas. Link types: FS (default), SS, FF, SF, with optional lag, e.g. <code>3, 5SS+2d, 7FF-1d</code>.</p>
      <p><b>MS Project and ProjectLibre files</b><br />.mpp and .pod are closed binary formats that a browser cannot read or write. OpenPlan exchanges plans through MS Project XML, which both programs open and save.</p>
    </Modal>
  );
}

function ConfirmDialog({ title, message, okLabel, onOk }: { title: string; message: string; okLabel: string; onOk: () => void }) {
  return (
    <Modal title={title} okLabel={okLabel} onSubmit={() => { S().closeDialog(); onOk(); return false; }}>
      <p className="confirm-msg">{message}</p>
    </Modal>
  );
}

export default function DialogHost() {
  const dialog = useStore(s => s.dialog);
  if (!dialog) return null;
  switch (dialog.type) {
    case 'settings': return <SettingsDialog />;
    case 'recurring': return <RecurringDialog />;
    case 'resource': return <ResourceDialog uid={dialog.props.uid} />;
    case 'convert': return <ConvertDialog kind={dialog.props.kind} />;
    case 'about': return <AboutDialog />;
    case 'confirm': return <ConfirmDialog {...dialog.props} />;
    default: return null;
  }
}
