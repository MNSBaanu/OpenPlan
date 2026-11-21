import OP from '../core';
import type { Project } from '../types';

const U = OP.util;

/*
 * Writes a plan as Microsoft Project XML (the documented "MSPDI" format), so it can be opened in Microsoft
 * Project, ProjectLibre and other planners. Elements are written in the order the official schema requires.
 * Calculated values such as cost, work and slack are left out: the other program works them out again.
 */

const CONSTRAINT_CODE: Record<string, number> = { ASAP: 0, ALAP: 1, MSO: 2, MFO: 3, SNET: 4, SNLT: 5, FNET: 6, FNLT: 7 };
const LINK_CODE: Record<string, number> = { FF: 0, FS: 1, SF: 2, SS: 3 };
const TASK_TYPE_CODE: Record<string, number> = { FixedUnits: 0, FixedDuration: 1, FixedWork: 2 };
const round2 = (v: number) => Math.round(v * 100) / 100;

// The format wants a three-letter ISO 4217 code. A project may carry one; otherwise it is guessed from the symbol,
// and XXX ("no currency") is used when the symbol could be any of several currencies, such as "Rs.".
const SYMBOL_CODES: Record<string, string> = { '$': 'USD', 'US$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR', 'A$': 'AUD', 'C$': 'CAD', 'CHF': 'CHF', 'kr': 'SEK', 'R': 'ZAR', '₩': 'KRW' };
export const currencyCodeOf = (p: Project) => {
  const code = String((p as any).currencyCode || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : SYMBOL_CODES[(p.currency || '').trim()] || 'XXX';
};

// Text for an XML element: control characters are not allowed in XML, and markup characters are escaped.
// eslint-disable-next-line no-control-regex
const text = (v: unknown) => U.esc(String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''));
const el = (name: string, value: unknown) => '<' + name + '>' + text(value) + '</' + name + '>';
const flag = (v: boolean) => (v ? '1' : '0');

function clock(hours: number) {
  const min = Math.round(hours * 60), h = Math.min(23, Math.floor(min / 60)), m = min % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':00';
}

export function projectToMspXml(p: Project, s: any): string {
  const hpd = Math.max(1, Math.min(24, +p.hoursPerDay || 8));
  const mpd = Math.round(hpd * 60);
  const workDays: number[] = OP.model.weekDays(p.workDays);
  const dayStart = 8, dayEnd = Math.min(24, dayStart + hpd);
  const at = (dn: number, end = false) => U.iso(dn) + 'T' + clock(end ? dayEnd : dayStart);
  const duration = (days: number) => { const min = Math.round(days * mpd); return 'PT' + Math.floor(min / 60) + 'H' + (min % 60) + 'M0S'; };

  const out: string[] = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>', '<Project xmlns="http://schemas.microsoft.com/project">'];
  const add = (s2: string) => out.push(s2);

  // ----- project -----
  add(el('SaveVersion', 12));
  add(el('Name', U.slug(p.name) + '.xml'));
  add(el('Title', p.name));
  if (p.organization) add(el('Company', p.organization));
  if (p.manager) add(el('Manager', p.manager));
  add(el('CreationDate', new Date().toISOString().slice(0, 19)));
  add(el('ScheduleFromStart', 1));
  add(el('StartDate', at(s.startDn)));
  add(el('FinishDate', at(s.finishDn, true)));
  add(el('CurrencyDigits', 2));
  add(el('CurrencySymbol', p.currency || ''));
  add(el('CurrencyCode', currencyCodeOf(p)));
  add(el('CalendarUID', 1));
  add(el('DefaultStartTime', clock(dayStart)));
  add(el('DefaultFinishTime', clock(dayEnd)));
  add(el('MinutesPerDay', mpd));
  add(el('MinutesPerWeek', mpd * workDays.length));
  add(el('DaysPerMonth', 20));
  if (U.parseDate(p.statusDate) != null) add(el('StatusDate', p.statusDate + 'T' + clock(dayEnd)));

  // ----- calendar: the working week and each holiday -----
  add('<Calendars><Calendar>' + el('UID', 1) + el('Name', 'Standard') + el('IsBaseCalendar', 1) + '<WeekDays>');
  for (let day = 1; day <= 7; day++) {
    const jsDay = day === 1 ? 0 : day - 1;             // DayType 1 is Sunday, 2 is Monday ... 7 is Saturday
    const working = workDays.includes(jsDay);
    add('<WeekDay>' + el('DayType', day) + el('DayWorking', flag(working)) +
      (working ? '<WorkingTimes><WorkingTime>' + el('FromTime', clock(dayStart)) + el('ToTime', clock(dayEnd)) + '</WorkingTime></WorkingTimes>' : '') + '</WeekDay>');
  }
  add('</WeekDays>');
  const hol = (p.holidays || []).filter(h => U.parseDate(h) != null).sort();
  if (hol.length) {
    add('<Exceptions>');
    hol.forEach((h, i) => add('<Exception>' + el('EnteredByOccurrences', 0) + '<TimePeriod>' + el('FromDate', h + 'T00:00:00') + el('ToDate', h + 'T23:59:00') + '</TimePeriod>' +
      el('Name', 'Holiday ' + (i + 1)) + el('DayWorking', 0) + '</Exception>'));
    add('</Exceptions>');
  }
  add('</Calendar></Calendars>');

  // ----- tasks (UID 0 is the project summary row, as Microsoft Project writes it) -----
  const uid = new Map<number, number>();
  s.rows.forEach((r: any) => uid.set(r.task.uid, r.id));
  add('<Tasks>');
  add('<Task>' + el('UID', 0) + el('ID', 0) + el('Name', p.name) + el('Type', 1) + el('OutlineNumber', 0) + el('OutlineLevel', 0) +
    el('Start', at(s.startDn)) + el('Finish', at(s.finishDn, true)) + el('Duration', duration(s.duration)) + el('DurationFormat', 7) +
    el('Milestone', 0) + el('Summary', 1) + '</Task>');
  s.rows.forEach((r: any) => {
    const t = r.task, milestone = !r.summary && (t.milestone || r.duration === 0);
    const parts: string[] = [el('UID', r.id), el('ID', r.id), el('Name', t.name), el('Type', TASK_TYPE_CODE[t.type] ?? 0), el('WBS', r.wbs), el('OutlineNumber', r.wbs),
      el('OutlineLevel', t.level), el('Priority', Math.round(+t.priority || 500)),
      el('Start', at(r.startDn)), el('Finish', milestone ? at(r.startDn) : at(r.finishDn, true)), el('Duration', duration(milestone ? 0 : r.duration)), el('DurationFormat', 7)];
    if (!r.summary) parts.push(el('EffortDriven', flag(!!t.effortDriven)));
    parts.push(el('Milestone', flag(milestone)), el('Summary', flag(!!r.summary)), el('Critical', flag(!!r.critical)));
    if (+t.fixedCost) parts.push(el('FixedCost', round2(+t.fixedCost)));
    if (!r.summary) parts.push(el('PercentComplete', Math.round(+t.percent || 0)));
    if (U.parseDate(t.actualStart) != null) parts.push(el('ActualStart', t.actualStart + 'T' + clock(dayStart)));
    if (U.parseDate(t.actualFinish) != null) parts.push(el('ActualFinish', t.actualFinish + 'T' + clock(dayEnd)));
    const ctype = CONSTRAINT_CODE[t.constraint] ?? 0;
    parts.push(el('ConstraintType', ctype));
    if (ctype >= 2 && U.parseDate(t.constraintDate) != null) parts.push(el('ConstraintDate', t.constraintDate + 'T' + clock(dayStart)));
    if (U.parseDate(t.deadline) != null) parts.push(el('Deadline', t.deadline + 'T' + clock(dayEnd)));
    if (t.notes) parts.push(el('Notes', t.notes));
    (t.preds || []).forEach((l: any) => {
      const from = uid.get(l.uid);
      if (from == null) return;
      parts.push('<PredecessorLink>' + el('PredecessorUID', from) + el('Type', LINK_CODE[l.type] ?? 1) + el('LinkLag', Math.round((+l.lag || 0) * mpd * 10)) + el('LagFormat', 7) + '</PredecessorLink>');
    });
    add('<Task>' + parts.join('') + '</Task>');
  });
  add('</Tasks>');

  // ----- resources -----
  const rid = new Map<number, number>();
  p.resources.forEach((r, i) => rid.set(r.uid, i + 1));
  add('<Resources>');
  p.resources.forEach((r, i) => {
    // The 2007 schema has two resource types, Material (0) and Work (1); a cost resource is a Work resource with a flag.
    const kind = r.kind === 'Material' ? 0 : r.kind === 'Cost' ? 2 : 1, typeCode = kind === 0 ? 0 : 1;
    const parts = [el('UID', i + 1), el('ID', i + 1), el('Name', r.name || 'Resource ' + (i + 1)), el('Type', typeCode)];
    if (r.initials) parts.push(el('Initials', r.initials));
    if (kind === 0 && r.materialLabel) parts.push(el('MaterialLabel', r.materialLabel));
    if (r.role) parts.push(el('Group', r.role));
    parts.push(el('MaxUnits', round2((+r.maxUnits || 100) / 100)));
    if (kind !== 2) parts.push(el('StandardRate', round2(+r.rate || 0)), el('StandardRateFormat', 2));
    if (+r.costPerUse) parts.push(el('CostPerUse', round2(+r.costPerUse)));
    if (kind === 2) parts.push(el('IsCostResource', 1));
    add('<Resource>' + parts.join('') + '</Resource>');
  });
  add('</Resources>');

  // ----- who does what -----
  add('<Assignments>');
  let n = 0;
  s.rows.forEach((r: any) => r.task.assignments.forEach((a: any) => {
    const res = rid.get(a.res);
    if (res == null) return;
    const kind = p.resources.find(x => x.uid === a.res)!.kind;
    const units = kind === 'Work' ? round2((+a.units || 0) / 100) : kind === 'Material' ? round2(+a.units || 0) : 1;
    add('<Assignment>' + el('UID', ++n) + el('TaskUID', r.id) + el('ResourceUID', res) + el('Units', units) + '</Assignment>');
  }));
  add('</Assignments>');

  add('</Project>');
  return out.join('\n');
}
