import OP from '../core';
import type { ImportResult } from './importTable';

const M = OP.model, U = OP.util;

/*
 * Reads a plan saved by Microsoft Project (File > Save As > XML) or by ProjectLibre, which use the same
 * documented "MSPDI" format. It does not read the binary .mpp format. Anything that cannot be carried over
 * is reported in `warnings`, so nothing is dropped silently.
 */

const kid = (el: Element, name: string): Element | null => {
  for (const c of Array.from(el.children)) if (c.localName === name) return c;
  return null;
};
const kids = (el: Element | null, name: string): Element[] => (el ? Array.from(el.children).filter(c => c.localName === name) : []);
const txt = (el: Element | null, name: string) => (el ? (kid(el, name)?.textContent ?? '').trim() : '');
const num = (el: Element | null, name: string, d = 0) => { const v = parseFloat(txt(el, name)); return isFinite(v) ? v : d; };
const flag = (el: Element | null, name: string) => { const v = txt(el, name).toLowerCase(); return v === '1' || v === 'true'; };
const dateOf = (s: string) => { const m = /^(\d{4}-\d{2}-\d{2})/.exec(s); return m && U.parseDate(m[1]) != null ? m[1] : ''; };

// "PT16H0M0S" -> 16 hours (P1DT2H is read as 24 + 2 hours).
function hoursOf(s: string): number | null {
  const m = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(s);
  if (!m) return null;
  return (+(m[1] || 0)) * 24 + (+(m[2] || 0)) + (+(m[3] || 0)) / 60 + (+(m[4] || 0)) / 3600;
}

const CONSTRAINTS: Record<string, string> = { '0': 'ASAP', '1': 'ALAP', '2': 'MSO', '3': 'MFO', '4': 'SNET', '5': 'SNLT', '6': 'FNET', '7': 'FNLT' };
const LINKS: Record<string, 'FF' | 'FS' | 'SF' | 'SS'> = { '0': 'FF', '1': 'FS', '2': 'SF', '3': 'SS' };
const TASK_TYPES: Record<string, string> = { '0': 'FixedUnits', '1': 'FixedDuration', '2': 'FixedWork' };
const round2 = (v: number) => Math.round(v * 100) / 100;

export function projectFromMspXml(text: string): ImportResult {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const root = doc.documentElement;
  if (!root || doc.getElementsByTagName('parsererror').length || root.localName !== 'Project' || !kid(root, 'Tasks')) {
    throw new Error('This is not a Microsoft Project XML file. In Microsoft Project, use File › Save As and choose XML.');
  }
  const warnings: string[] = [];
  const warnOnce = (m: string) => { if (!warnings.includes(m)) warnings.push(m); };

  const p = M.blank();
  p.name = txt(root, 'Title') || txt(root, 'Name') || 'Imported plan';
  p.manager = txt(root, 'Manager');
  p.organization = txt(root, 'Company');
  const cur = txt(root, 'CurrencySymbol');
  if (cur) p.currency = cur;
  const code = txt(root, 'CurrencyCode').toUpperCase();
  if (/^[A-Z]{3}$/.test(code) && code !== 'XXX') p.currencyCode = code;
  const mpd = num(root, 'MinutesPerDay', 480) || 480;
  p.hoursPerDay = Math.max(1, Math.min(24, round2(mpd / 60)));
  const hpd = p.hoursPerDay;
  const start = dateOf(txt(root, 'StartDate'));
  if (start) p.start = start;

  // ----- calendar: public holidays and days off -----
  const cals = kids(kid(root, 'Calendars'), 'Calendar');
  const base = cals.find(c => txt(c, 'UID') === txt(root, 'CalendarUID')) || cals.find(c => flag(c, 'IsBaseCalendar'));
  if (base) {
    // The working week starts as Monday to Friday; each WeekDay entry then switches one day on or off.
    // DayType 1 is Sunday, 2 Monday ... 7 Saturday (0 is a dated exception, handled below).
    const week = new Set<number>([1, 2, 3, 4, 5]);
    kids(kid(base, 'WeekDays'), 'WeekDay').forEach(w => {
      const type = Number(txt(w, 'DayType'));
      if (!(type >= 1 && type <= 7)) return;
      const js = type === 1 ? 0 : type - 1;
      if (flag(w, 'DayWorking')) week.add(js); else week.delete(js);
    });
    if (!week.size) warnOnce('the calendar has no working days, so Monday to Friday was used');
    p.workDays = M.weekDays(Array.from(week));
    const hol = new Set<string>();
    kids(kid(base, 'Exceptions'), 'Exception').forEach(e => {
      if (flag(e, 'DayWorking')) return;
      const tp = kid(e, 'TimePeriod'), from = dateOf(txt(tp, 'FromDate')), to = dateOf(txt(tp, 'ToDate')) || from;
      if (!from) return;
      for (let dn = U.parseDate(from)!, end = Math.min(U.parseDate(to)!, dn + 366); dn <= end && hol.size < 800; dn++) {
        const w = U.weekday(dn);
        if (w !== 0 && w !== 6) hol.add(U.iso(dn));
      }
    });
    p.holidays = Array.from(hol).sort();
  }

  // ----- resources -----
  const resUid = new Map<string, number>();
  kids(kid(root, 'Resources'), 'Resource').forEach(r => {
    const name = txt(r, 'Name');
    if (!name || txt(r, 'UID') === '0') return; // UID 0 is Project's "unassigned" placeholder
    const type = txt(r, 'Type');
    const kind = flag(r, 'IsCostResource') || type === '2' ? 'Cost' : type === '0' ? 'Material' : 'Work';
    let rate = num(r, 'StandardRate', 0);
    const fmt = txt(r, 'StandardRateFormat');
    if (kind === 'Work') {
      if (fmt === '1') rate *= 60;
      else if (fmt === '3') rate /= hpd;
      else if (fmt && fmt !== '2') warnOnce('some pay rates are not hourly and were read as hourly');
    }
    const res = M.newResource(p, {
      name, initials: txt(r, 'Initials') || M.initials(name), role: txt(r, 'Group'), kind,
      type: kind === 'Work' ? 'Full-time' : 'Supporter', workDays: p.workDays.slice(),
      maxUnits: Math.max(1, Math.round(num(r, 'MaxUnits', 1) * 100)),
      rate: kind === 'Cost' ? 0 : Math.max(0, round2(rate)), costPerUse: Math.max(0, num(r, 'CostPerUse', 0)),
      materialLabel: kind === 'Material' ? txt(r, 'MaterialLabel') : ''
    });
    p.resources.push(res);
    resUid.set(txt(r, 'UID'), res.uid);
  });

  // ----- tasks -----
  const taskUid = new Map<string, number>(), taskEls: { el: Element; uid: number }[] = [];
  let skipped = 0, hasBaseline = false;
  kids(kid(root, 'Tasks'), 'Task').forEach(el => {
    const level = num(el, 'OutlineLevel', 1);
    const name = txt(el, 'Name');
    if (txt(el, 'UID') === '0' || level < 1) return;             // the project summary row
    if (!name || flag(el, 'IsNull')) return;                     // blank rows
    if (txt(el, 'Active') === '0') { skipped++; return; }        // inactive tasks
    if (kids(el, 'Baseline').some(b => dateOf(txt(b, 'Start')))) hasBaseline = true;
    const milestone = flag(el, 'Milestone');
    let duration = 1;
    if (milestone) duration = 0;
    else {
      const raw = txt(el, 'Duration');
      if (raw) {
        const h = hoursOf(raw);
        if (h == null) warnOnce('some durations were not understood and set to 1 day');
        else duration = Math.max(0, round2(h / hpd));
      }
    }
    const ctype = CONSTRAINTS[txt(el, 'ConstraintType')] || 'ASAP';
    let constraint = ctype, constraintDate = dateOf(txt(el, 'ConstraintDate'));
    if (constraint !== 'ASAP' && constraint !== 'ALAP' && !constraintDate) { constraint = 'ASAP'; constraintDate = ''; warnOnce('some constraints had no date and were dropped'); }
    if (constraint === 'ASAP' || constraint === 'ALAP') constraintDate = '';
    const t = M.newTask(p, {
      name, level, duration, milestone: milestone || duration === 0,
      percent: Math.max(0, Math.min(100, num(el, 'PercentComplete', 0))),
      notes: txt(el, 'Notes'), constraint, constraintDate, deadline: dateOf(txt(el, 'Deadline')),
      type: TASK_TYPES[txt(el, 'Type')] || 'FixedUnits', effortDriven: txt(el, 'EffortDriven') !== '0',
      fixedCost: Math.max(0, num(el, 'FixedCost', 0)), priority: Math.max(0, Math.min(1000, num(el, 'Priority', 500))),
      actualStart: dateOf(txt(el, 'ActualStart')), actualFinish: dateOf(txt(el, 'ActualFinish'))
    });
    p.tasks.push(t);
    taskUid.set(txt(el, 'UID'), t.uid);
    taskEls.push({ el, uid: t.uid });
  });
  if (!p.tasks.length) throw new Error('No tasks were found in this Microsoft Project file.');

  // ----- links between tasks -----
  let badLinks = 0, percentLags = 0, elapsedLags = 0;
  taskEls.forEach(({ el, uid }) => {
    const t = p.tasks.find((x: any) => x.uid === uid)!;
    kids(el, 'PredecessorLink').forEach(l => {
      const from = taskUid.get(txt(l, 'PredecessorUID'));
      if (from == null || from === uid) { badLinks++; return; }
      let lag = 0;
      const raw = num(l, 'LinkLag', 0), fmt = Number(txt(l, 'LagFormat') || 7);
      if (raw) {
        if (fmt === 19 || fmt === 20) percentLags++;
        else { lag = round2(raw / 10 / mpd); if ([4, 6, 8, 10, 12].includes(fmt)) elapsedLags++; }
      }
      t.preds.push({ uid: from, type: LINKS[txt(l, 'Type')] || 'FS', lag });
    });
  });
  if (badLinks) warnings.push(badLinks + ' link' + (badLinks > 1 ? 's' : '') + ' to tasks that could not be found ' + (badLinks > 1 ? 'were' : 'was') + ' skipped');
  if (percentLags) warnings.push(percentLags + ' lag' + (percentLags > 1 ? 's' : '') + ' given as a percentage ' + (percentLags > 1 ? 'were' : 'was') + ' set to 0');
  if (elapsedLags) warnOnce('lags counted in calendar days were read as working days');

  // ----- who does what -----
  let badAssign = 0;
  kids(kid(root, 'Assignments'), 'Assignment').forEach(a => {
    const tUid = taskUid.get(txt(a, 'TaskUID')), rUid = resUid.get(txt(a, 'ResourceUID'));
    if (tUid == null || rUid == null) { if (txt(a, 'ResourceUID') !== '-65535' && txt(a, 'TaskUID') !== '0' && tUid != null) badAssign++; return; }
    const res = p.resources.find((r: any) => r.uid === rUid)!, t = p.tasks.find((x: any) => x.uid === tUid)!;
    const units = num(a, 'Units', 1);
    t.assignments.push({ res: rUid, units: res.kind === 'Work' ? Math.max(1, Math.round(units * 100)) : res.kind === 'Material' ? units : 0 });
  });
  if (badAssign) warnings.push(badAssign + ' assignment' + (badAssign > 1 ? 's' : '') + ' to resources that could not be found ' + (badAssign > 1 ? 'were' : 'was') + ' skipped');

  if (skipped) warnings.push(skipped + ' inactive task' + (skipped > 1 ? 's were' : ' was') + ' left out');
  if (hasBaseline) warnings.push('the baseline was not imported (set a new one in OpenPlan)');

  const project = M.normalize(p);
  return { project, tasks: project.tasks.length, resources: project.resources.length, warnings };
}
