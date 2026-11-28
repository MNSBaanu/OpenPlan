// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import OP from '../../core';
import { projectToMspXml } from './exportMsp';
import { projectFromMspXml } from './importMsp';

// The order the official schema (mspdi_pj12.xsd) requires for the elements this exporter writes.
const ORDER = {
  Project: ['SaveVersion', 'Name', 'Title', 'Company', 'Manager', 'CreationDate', 'ScheduleFromStart', 'StartDate', 'FinishDate', 'CurrencyDigits', 'CurrencySymbol', 'CurrencyCode',
    'CalendarUID', 'DefaultStartTime', 'DefaultFinishTime', 'MinutesPerDay', 'MinutesPerWeek', 'DaysPerMonth', 'StatusDate', 'Calendars', 'Tasks', 'Resources', 'Assignments'],
  Task: ['UID', 'ID', 'Name', 'Type', 'WBS', 'OutlineNumber', 'OutlineLevel', 'Priority', 'Start', 'Finish', 'Duration', 'DurationFormat', 'EffortDriven', 'Milestone', 'Summary',
    'Critical', 'FixedCost', 'PercentComplete', 'ActualStart', 'ActualFinish', 'ConstraintType', 'ConstraintDate', 'Deadline', 'Notes', 'PredecessorLink'],
  PredecessorLink: ['PredecessorUID', 'Type', 'LinkLag', 'LagFormat'],
  Resource: ['UID', 'ID', 'Name', 'Type', 'Initials', 'MaterialLabel', 'Group', 'MaxUnits', 'StandardRate', 'StandardRateFormat', 'CostPerUse', 'IsCostResource'],
  Assignment: ['UID', 'TaskUID', 'ResourceUID', 'Units'],
  Calendar: ['UID', 'Name', 'IsBaseCalendar', 'WeekDays', 'Exceptions'],
  WeekDay: ['DayType', 'DayWorking', 'WorkingTimes'],
  Exception: ['EnteredByOccurrences', 'TimePeriod', 'Name', 'DayWorking']
} as Record<string, string[]>;

const M = OP.model;
const demo = () => { const p = M.normalize(OP.demo()); p.holidays = ['2026-01-26']; p.statusDate = '2026-01-30'; return p; };
const exportOf = (p: any) => projectToMspXml(p, OP.schedule(p));
const doc = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');

describe('Microsoft Project XML export', () => {
  it('is well-formed XML with the Microsoft Project root', () => {
    const d = doc(exportOf(demo()));
    expect(d.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(d.documentElement.localName).toBe('Project');
    expect(d.documentElement.namespaceURI).toBe('http://schemas.microsoft.com/project');
  });

  it('writes every element in the order the schema requires', () => {
    const d = doc(exportOf(demo()));
    const bad: string[] = [];
    d.querySelectorAll('*').forEach(node => {
      const order = ORDER[node.localName];
      if (!order) return;
      let last = -1;
      Array.from(node.children).forEach(c => {
        const i = order.indexOf(c.localName);
        if (i < 0 && !['WeekDays', 'Exceptions', 'WorkingTimes', 'TimePeriod'].includes(c.localName)) bad.push(node.localName + ' has unexpected ' + c.localName);
        if (i < last) bad.push(node.localName + ': ' + c.localName + ' is out of order');
        if (i >= 0) last = i;
      });
    });
    expect(bad).toEqual([]);
  });

  it('keeps the project settings, the project summary row and one row per task', () => {
    const p = demo(), d = doc(exportOf(p));
    const txt = (el: Element, n: string) => Array.from(el.children).find(c => c.localName === n)?.textContent;
    expect([txt(d.documentElement, 'Title'), txt(d.documentElement, 'MinutesPerDay'), txt(d.documentElement, 'CalendarUID')]).toEqual([p.name, String(p.hoursPerDay * 60), '1']);
    const tasks = Array.from(d.getElementsByTagName('Tasks')[0].children);
    expect(tasks).toHaveLength(p.tasks.length + 1);
    expect([txt(tasks[0], 'UID'), txt(tasks[0], 'OutlineLevel'), txt(tasks[0], 'Summary')]).toEqual(['0', '0', '1']);
  });

  it('escapes markup and drops characters XML cannot hold', () => {
    const p = demo(); p.tasks[1].name = 'Fish & <chips> "quoted" \u0001end'; p.tasks[1].notes = "O'Neil & Sons";
    const xml = exportOf(p), d = doc(xml);
    expect(d.getElementsByTagName('parsererror')).toHaveLength(0);
    const names = Array.from(d.getElementsByTagName('Name')).map(n => n.textContent);
    expect(names).toContain('Fish & <chips> "quoted" end');
  });

  it('survives a round trip: export, then import, gives the same plan', () => {
    const p = demo(), back = projectFromMspXml(exportOf(p));
    expect(back.warnings).toEqual([]);
    const q = back.project;
    expect([q.name, q.currency, q.hoursPerDay, q.start]).toEqual([p.name, p.currency, p.hoursPerDay, p.start]);
    expect(q.holidays).toEqual(p.holidays);
    expect(q.tasks.map((t: any) => [t.name, t.level])).toEqual(p.tasks.map((t: any) => [t.name, t.level]));
    // the schedule is identical: every task starts and finishes on the same day, and the project ends the same day
    const s1 = OP.schedule(p), s2 = OP.schedule(q);
    expect(s2.cycle).toEqual([]);
    expect(s2.rows.map((r: any) => [r.startDn, r.finishDn])).toEqual(s1.rows.map((r: any) => [r.startDn, r.finishDn]));
    expect(s2.finishDn).toBe(s1.finishDn);
    // links, resources and assignments
    const label = (pp: any) => pp.tasks.map((t: any) => t.preds.map((l: any) => pp.tasks.findIndex((x: any) => x.uid === l.uid) + 1 + l.type + l.lag).sort().join(','));
    expect(label(q)).toEqual(label(p));
    expect(q.resources.map((r: any) => [r.name, r.kind, r.rate, r.maxUnits, r.initials])).toEqual(p.resources.map((r: any) => [r.name, r.kind, r.rate, r.maxUnits, r.initials]));
    const who = (pp: any) => pp.tasks.map((t: any) => t.assignments.map((a: any) => pp.resources.findIndex((r: any) => r.uid === a.res) + ':' + a.units).join(','));
    expect(who(q)).toEqual(who(p));
    expect(s2.totalCost).toBeCloseTo(s1.totalCost, 0);
  });

  it('round-trips constraints, deadlines, progress, notes, milestones and fixed cost', () => {
    const p = demo();
    Object.assign(p.tasks[2], { constraint: 'SNET', constraintDate: '2026-01-07', deadline: '2026-01-20', percent: 40, notes: 'Check with client', fixedCost: 500, actualStart: '2026-01-07' });
    p.tasks[4].milestone = true; p.tasks[4].duration = 0;
    const q = projectFromMspXml(exportOf(p)).project, a = q.tasks[2], b = p.tasks[2];
    expect([a.constraint, a.constraintDate, a.deadline, a.percent, a.notes, a.fixedCost, a.actualStart]).toEqual([b.constraint, b.constraintDate, b.deadline, b.percent, b.notes, b.fixedCost, b.actualStart]);
    expect([q.tasks[4].milestone, q.tasks[4].duration]).toEqual([true, 0]);
  });

  it('writes the project currency code, guesses a safe one from the symbol, and reads it back', () => {
    const code = (p: any) => doc(exportOf(p)).getElementsByTagName('CurrencyCode')[0].textContent;
    const p = demo();
    expect(code(p)).toBe('XXX');                                            // "Rs." could be several currencies
    p.currency = '£'; expect(code(p)).toBe('GBP');
    p.currency = 'Rs.'; (p as any).currencyCode = 'lkr'; expect(code(p)).toBe('LKR');
    const q = projectFromMspXml(exportOf(p)).project;
    expect([q.currency, q.currencyCode]).toEqual(['Rs.', 'LKR']);
    p.currencyCode = ''; p.currency = 'Rs.'; expect(projectFromMspXml(exportOf(p)).project.currencyCode).toBe('');   // XXX is not kept
  });

  it('round-trips a custom working week with the same dates', () => {
    const p = demo(); p.workDays = [0, 1, 2, 3, 4]; p.resources.forEach((r: any) => { r.workDays = [0, 1, 2, 3, 4]; });
    const xml = exportOf(p), d = doc(xml);
    const flags = Array.from(d.getElementsByTagName('WeekDay')).map(w => w.getElementsByTagName('DayWorking')[0].textContent);
    expect(flags).toEqual(['1', '1', '1', '1', '1', '0', '0']);     // Sunday to Saturday: Sunday to Thursday work
    expect(d.getElementsByTagName('MinutesPerWeek')[0].textContent).toBe('2400');
    const q = projectFromMspXml(xml).project;
    expect(q.workDays).toEqual([0, 1, 2, 3, 4]);
    expect(OP.schedule(q).rows.map((r: any) => [r.startDn, r.finishDn])).toEqual(OP.schedule(p).rows.map((r: any) => [r.startDn, r.finishDn]));
  });

  it('round-trips material and cost resources', () => {
    const p = demo();
    p.resources.push(M.newResource(p, { name: 'Gravel', kind: 'Material', materialLabel: 'tonne', rate: 12.5, costPerUse: 40 }), M.newResource(p, { name: 'Travel', kind: 'Cost' }));
    const [gravel, travel] = p.resources.slice(-2);
    p.tasks[6].assignments.push({ res: gravel.uid, units: 3 }, { res: travel.uid, units: 0 });
    const q = projectFromMspXml(exportOf(p)).project, [g2, t2] = q.resources.slice(-2);
    expect([g2.kind, g2.materialLabel, g2.rate, g2.costPerUse, t2.kind]).toEqual(['Material', 'tonne', 12.5, 40, 'Cost']);
    expect(q.tasks[6].assignments.slice(-2)).toEqual([{ res: g2.uid, units: 3 }, { res: t2.uid, units: 0 }]);
  });

  it('exports an empty plan and a plan with no resources without errors', () => {
    const p = M.normalize(M.blank()); p.tasks.push(M.newTask(p, { name: 'Only task', duration: 3 }));
    const q = projectFromMspXml(exportOf(M.normalize(p))).project;
    expect([q.tasks.length, q.resources.length, q.tasks[0].duration]).toEqual([1, 0, 3]);
    expect(doc(projectToMspXml(M.normalize(M.blank()), OP.schedule(M.normalize(M.blank())))).getElementsByTagName('parsererror')).toHaveLength(0);
  });
});
