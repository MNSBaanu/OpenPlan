// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import OP from '../core';
import { projectFromMspXml } from './importMsp';

const wrap = (body: string, head = '') => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project"><Name>plan.xml</Name>${head}${body}</Project>`;

const task = (uid: number, name: string, level: number, extra = '') =>
  `<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${name}</Name><OutlineLevel>${level}</OutlineLevel>${extra}</Task>`;
const dur = (h: number) => `<Duration>PT${h}H0M0S</Duration>`;
const link = (uid: number, type: number, lag = 0, fmt = 7) => `<PredecessorLink><PredecessorUID>${uid}</PredecessorUID><Type>${type}</Type><LinkLag>${lag}</LinkLag><LagFormat>${fmt}</LagFormat></PredecessorLink>`;

const FULL = wrap(`
<Calendars><Calendar><UID>1</UID><Name>Standard</Name><IsBaseCalendar>1</IsBaseCalendar>
  <WeekDays>
    <WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>
    ${[2, 3, 4, 5, 6].map(d => `<WeekDay><DayType>${d}</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>08:00:00</FromTime><ToTime>17:00:00</ToTime></WorkingTime></WorkingTimes></WeekDay>`).join('')}
    <WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay>
  </WeekDays>
  <Exceptions>
    <Exception><EnteredByOccurrences>0</EnteredByOccurrences><TimePeriod><FromDate>2026-04-03T00:00:00</FromDate><ToDate>2026-04-03T23:59:00</ToDate></TimePeriod><DayWorking>0</DayWorking></Exception>
    <Exception><EnteredByOccurrences>0</EnteredByOccurrences><TimePeriod><FromDate>2026-05-04T00:00:00</FromDate><ToDate>2026-05-06T23:59:00</ToDate></TimePeriod><DayWorking>0</DayWorking></Exception>
  </Exceptions></Calendar></Calendars>
<Tasks>
  ${task(0, 'Website Launch', 0, '<Summary>1</Summary>')}
  ${task(1, 'Plan', 1, '<Summary>1</Summary>' + dur(40))}
  ${task(2, 'Write brief', 2, dur(16) + '<PercentComplete>100</PercentComplete><Notes>Agreed with client</Notes><ConstraintType>4</ConstraintType><ConstraintDate>2026-03-02T08:00:00</ConstraintDate>')}
  ${task(3, 'Approve brief', 2, '<Milestone>1</Milestone>' + dur(0) + link(2, 1))}
  ${task(4, 'Build', 1, '<Summary>1</Summary>')}
  ${task(5, 'Design pages', 2, dur(32) + link(3, 1, 4800) + '<Baseline><Number>0</Number><Start>2026-03-05T08:00:00</Start></Baseline>')}
  ${task(6, 'Write copy', 2, dur(24) + link(3, 3) + '<Deadline>2026-03-27T17:00:00</Deadline><Priority>700</Priority><FixedCost>250</FixedCost><Type>1</Type>')}
  ${task(7, 'Launch', 1, dur(8) + link(5, 1) + link(6, 0, -4800) + link(99, 1))}
  ${task(8, 'Old idea', 1, '<Active>0</Active>' + dur(8))}
</Tasks>
<Resources>
  <Resource><UID>0</UID><ID>0</ID><Type>1</Type></Resource>
  <Resource><UID>1</UID><ID>1</ID><Name>Ana Silva</Name><Initials>AS</Initials><Group>Designer</Group><Type>1</Type><MaxUnits>1</MaxUnits><StandardRate>40</StandardRate><StandardRateFormat>2</StandardRateFormat></Resource>
  <Resource><UID>2</UID><ID>2</ID><Name>Ben Lee</Name><Type>1</Type><MaxUnits>0.5</MaxUnits><StandardRate>400</StandardRate><StandardRateFormat>3</StandardRateFormat></Resource>
  <Resource><UID>3</UID><ID>3</ID><Name>Concrete</Name><Type>0</Type><MaterialLabel>m3</MaterialLabel><StandardRate>120</StandardRate></Resource>
</Resources>
<Assignments>
  <Assignment><UID>1</UID><TaskUID>5</TaskUID><ResourceUID>1</ResourceUID><Units>1</Units></Assignment>
  <Assignment><UID>2</UID><TaskUID>6</TaskUID><ResourceUID>2</ResourceUID><Units>0.5</Units></Assignment>
  <Assignment><UID>3</UID><TaskUID>6</TaskUID><ResourceUID>3</ResourceUID><Units>4</Units></Assignment>
  <Assignment><UID>4</UID><TaskUID>5</TaskUID><ResourceUID>-65535</ResourceUID><Units>1</Units></Assignment>
  <Assignment><UID>5</UID><TaskUID>5</TaskUID><ResourceUID>77</ResourceUID><Units>1</Units></Assignment>
</Assignments>`,
`<Title>Website Launch</Title><Company>Acme</Company><Manager>Sam Rowe</Manager><CurrencySymbol>$</CurrencySymbol><StartDate>2026-03-02T08:00:00</StartDate><MinutesPerDay>480</MinutesPerDay><CalendarUID>1</CalendarUID>`);

describe('Microsoft Project XML import', () => {
  const res = projectFromMspXml(FULL), p = res.project;
  const t = (name: string) => p.tasks.find((x: any) => x.name === name)!;
  const uidOf = (name: string) => t(name).uid;

  it('reads the project settings', () => {
    expect([p.name, p.organization, p.manager, p.currency, p.start, p.hoursPerDay]).toEqual(['Website Launch', 'Acme', 'Sam Rowe', '$', '2026-03-02', 8]);
  });

  it('turns calendar exceptions into holidays (one day and a range, weekdays only)', () => {
    expect(p.holidays).toEqual(['2026-04-03', '2026-05-04', '2026-05-05', '2026-05-06']);
  });

  it('keeps the outline, skips the project summary row and inactive tasks', () => {
    expect(p.tasks.map((x: any) => x.name)).toEqual(['Plan', 'Write brief', 'Approve brief', 'Build', 'Design pages', 'Write copy', 'Launch']);
    expect(p.tasks.map((x: any) => x.level)).toEqual([1, 2, 2, 1, 2, 2, 1]);
  });

  it('converts durations from hours to working days, and reads milestones', () => {
    expect([t('Write brief').duration, t('Design pages').duration, t('Write copy').duration, t('Launch').duration]).toEqual([2, 4, 3, 1]);
    expect([t('Approve brief').milestone, t('Approve brief').duration]).toEqual([true, 0]);
  });

  it('reads progress, notes, constraints, deadlines, priority, cost and task type', () => {
    expect([t('Write brief').percent, t('Write brief').notes]).toEqual([100, 'Agreed with client']);
    expect([t('Write brief').constraint, t('Write brief').constraintDate]).toEqual(['SNET', '2026-03-02']);
    const c = t('Write copy');
    expect([c.deadline, c.priority, c.fixedCost, c.type]).toEqual(['2026-03-27', 700, 250, 'FixedDuration']);
  });

  it('reads link types and lag in working days', () => {
    expect(t('Approve brief').preds).toEqual([{ uid: uidOf('Write brief'), type: 'FS', lag: 0 }]);
    expect(t('Design pages').preds).toEqual([{ uid: uidOf('Approve brief'), type: 'FS', lag: 1 }]);
    expect(t('Write copy').preds).toEqual([{ uid: uidOf('Approve brief'), type: 'SS', lag: 0 }]);
    expect(t('Launch').preds).toEqual([{ uid: uidOf('Design pages'), type: 'FS', lag: 0 }, { uid: uidOf('Write copy'), type: 'FF', lag: -1 }]);
  });

  it('reads people, rates (hourly and daily), availability and materials', () => {
    const [ana, ben, concrete] = p.resources;
    expect([ana.name, ana.initials, ana.role, ana.kind, ana.rate, ana.maxUnits]).toEqual(['Ana Silva', 'AS', 'Designer', 'Work', 40, 100]);
    expect([ben.rate, ben.maxUnits, ben.initials]).toEqual([50, 50, 'BL']);
    expect([concrete.kind, concrete.rate, concrete.materialLabel]).toEqual(['Material', 120, 'm3']);
  });

  it('reads who does what', () => {
    const [ana, ben, concrete] = p.resources;
    expect(t('Design pages').assignments).toEqual([{ res: ana.uid, units: 100 }]);
    expect(t('Write copy').assignments).toEqual([{ res: ben.uid, units: 50 }, { res: concrete.uid, units: 4 }]);
  });

  it('reports everything it could not carry over, and nothing else', () => {
    expect(res.warnings.join(' | ')).toMatch(/1 link to tasks that could not be found was skipped/);
    expect(res.warnings.join(' | ')).toMatch(/1 assignment to resources that could not be found was skipped/);
    expect(res.warnings.join(' | ')).toMatch(/1 inactive task was left out/);
    expect(res.warnings.join(' | ')).toMatch(/baseline was not imported/);
    expect(res.warnings).toHaveLength(4);
    expect([res.tasks, res.resources]).toEqual([7, 3]);
  });

  it('produces a plan the scheduler can run, with the links respected', () => {
    const s = OP.schedule(p);
    expect(s.cycle).toEqual([]);
    const row = (n: string) => s.rows.find((r: any) => r.task.name === n);
    expect(row('Design pages').es).toBeGreaterThan(row('Approve brief').ef - 1);   // finish-to-start with one day of lag
    expect(row('Launch').es).toBeGreaterThanOrEqual(row('Design pages').ef);
    expect(s.finishDn).toBeGreaterThan(s.startDn);
    expect(s.holidays ?? p.holidays).toBeTruthy();
  });
});

describe('Microsoft Project XML import: edge cases', () => {
  it('rejects files that are not Microsoft Project XML', () => {
    for (const bad of ['not xml at all', '{"tasks":[]}', '<Other><Tasks/></Other>', '<Project xmlns="http://schemas.microsoft.com/project"><Name>x</Name></Project>']) {
      expect(() => projectFromMspXml(bad)).toThrow(/Microsoft Project/);
    }
  });

  it('rejects a file with no tasks', () => {
    expect(() => projectFromMspXml(wrap('<Tasks>' + task(0, 'Only the summary', 0) + '</Tasks>'))).toThrow(/No tasks were found/);
  });

  it('warns about percentage lags, elapsed lags, odd working weeks and non-hourly rates', () => {
    const xml = wrap(`<Calendars><Calendar><UID>1</UID><IsBaseCalendar>1</IsBaseCalendar><WeekDays><WeekDay><DayType>7</DayType><DayWorking>1</DayWorking></WeekDay></WeekDays></Calendar></Calendars>
      <Tasks>${task(1, 'A', 1, dur(8))}${task(2, 'B', 1, dur(8) + link(1, 1, 1000, 19))}${task(3, 'C', 1, dur(8) + link(1, 1, 4800, 8))}</Tasks>
      <Resources><Resource><UID>1</UID><Name>X</Name><Type>1</Type><StandardRate>9</StandardRate><StandardRateFormat>5</StandardRateFormat></Resource></Resources>`, '<CalendarUID>1</CalendarUID>');
    const r = projectFromMspXml(xml);
    const w = r.warnings.join(' | ');
    expect(w).toMatch(/working week is not Monday to Friday/);
    expect(w).toMatch(/1 lag given as a percentage was set to 0/);
    expect(w).toMatch(/calendar days were read as working days/);
    expect(w).toMatch(/pay rates are not hourly/);
    expect(r.project.tasks[1].preds[0].lag).toBe(0);
    expect(r.project.tasks[2].preds[0].lag).toBe(1);
  });

  it('copes with missing optional data, odd durations and a constraint without a date', () => {
    const xml = wrap(`<Tasks>${task(1, 'A', 1, '<Duration>soon</Duration><ConstraintType>2</ConstraintType>')}${task(2, 'B', 1)}</Tasks>`);
    const r = projectFromMspXml(xml);
    expect(r.project.tasks.map((x: any) => [x.duration, x.constraint])).toEqual([[1, 'ASAP'], [1, 'ASAP']]);
    expect(r.warnings.join(' | ')).toMatch(/durations were not understood/);
    expect(r.warnings.join(' | ')).toMatch(/constraints had no date/);
    expect(r.project.name).toBe('plan.xml');
  });

  it('handles a large plan quickly', () => {
    const many = Array.from({ length: 3000 }, (_, i) => task(i + 1, 'Task ' + (i + 1), 1, dur(8) + (i ? link(i, 1) : ''))).join('');
    const t0 = Date.now(), r = projectFromMspXml(wrap('<Tasks>' + many + '</Tasks>'));
    expect(r.tasks).toBe(3000);
    expect(r.project.tasks[2999].preds).toHaveLength(1);
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});
