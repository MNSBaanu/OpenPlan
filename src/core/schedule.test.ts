import { describe, expect, it } from 'vitest';
import OP from './index';

const M = OP.model, U = OP.util;

// Project start is Monday 5 Jan 2026. Working days are numbered from 0: Mon 5 Jan = 0 ... Fri 9 Jan = 4,
// Mon 12 Jan = 5 ... Fri 16 Jan = 9, Mon 19 Jan = 10.
const START = '2026-01-05';

type Spec = { name: string; duration?: number; preds?: string; level?: number } & Record<string, unknown>;

function plan(specs: Spec[], tweak?: (p: any) => void) {
  let p = M.blank();
  p.start = START;
  tweak?.(p);
  specs.forEach(sp => {
    const { preds, ...fields } = sp;
    void preds;
    p.tasks.push(M.newTask(p, { duration: 1, ...fields }));
  });
  specs.forEach((sp, i) => { if (sp.preds) p.tasks[i].preds = M.parsePreds(p, sp.preds, p.tasks[i].uid).preds; });
  p = M.normalize(p);
  return { p, s: OP.schedule(p) };
}

const row = (s: any, name: string) => s.rows.find((r: any) => r.task.name === name);
const day = (dn: number) => U.iso(dn);

describe('working calendar', () => {
  it('skips weekends when counting working days', () => {
    const { s } = plan([{ name: 'A', duration: 6 }]);
    expect(day(row(s, 'A').startDn)).toBe('2026-01-05');
    expect(day(row(s, 'A').finishDn)).toBe('2026-01-12'); // 5 working days, weekend, then the sixth
  });

  it('starts on the next working day when the project starts on a weekend', () => {
    const { s } = plan([{ name: 'A', duration: 1 }], p => { p.start = '2026-01-10'; });
    expect(day(row(s, 'A').startDn)).toBe('2026-01-12');
  });

  it('skips holidays', () => {
    const { s } = plan([{ name: 'A', duration: 5 }, { name: 'B', duration: 1, preds: '1' }], p => { p.holidays = ['2026-01-12']; });
    expect(day(row(s, 'B').startDn)).toBe('2026-01-13');
  });
});

describe('dependency links', () => {
  it('finish-to-finish links align the finish dates', () => {
    const { s } = plan([{ name: 'A', duration: 3 }, { name: 'B', duration: 2, preds: '1FF' }]);
    expect(row(s, 'B').es).toBe(1);
    expect(row(s, 'B').ef).toBe(3);
  });

  it('start-to-finish links with lag push the successor later', () => {
    const { s } = plan([{ name: 'A', duration: 3 }, { name: 'B', duration: 2, preds: '1SF+4d' }]);
    expect(row(s, 'B').es).toBe(2);
    expect(row(s, 'B').ef).toBe(4);
  });

  it('a start-to-finish link cannot pull a task before the project start', () => {
    const { s } = plan([{ name: 'A', duration: 3 }, { name: 'B', duration: 2, preds: '1SF' }]);
    expect(row(s, 'B').es).toBe(0);
  });

  it('negative lag lets a successor overlap its predecessor', () => {
    const { s } = plan([{ name: 'A', duration: 3 }, { name: 'B', duration: 2, preds: '1FS-1d' }]);
    expect(row(s, 'B').es).toBe(2);
  });

  it('starts a task after its slowest predecessor', () => {
    const { s } = plan([
      { name: 'A', duration: 2 }, { name: 'B', duration: 5 }, { name: 'C', duration: 1, preds: '1, 2' }
    ]);
    expect(row(s, 'C').es).toBe(5);
    expect(row(s, 'A').slack).toBe(3);
    expect(row(s, 'A').freeSlack).toBe(3);
    expect(row(s, 'B').critical).toBe(true);
  });

  it('a link to a summary task applies to all of its subtasks', () => {
    const { s } = plan([
      { name: 'Phase', level: 1 },
      { name: 'A', duration: 3, level: 2 },
      { name: 'B', duration: 2, level: 2 },
      { name: 'C', duration: 1, preds: '1' }
    ]);
    expect(row(s, 'C').es).toBe(3);
  });

  it('ignores a link between a summary task and its own subtask', () => {
    const { s } = plan([
      { name: 'Phase', level: 1 },
      { name: 'A', duration: 3, level: 2, preds: '1' }
    ]);
    expect(s.cycle).toEqual([]);
    expect(row(s, 'A').es).toBe(0);
  });
});

describe('dependency loops', () => {
  it('reports only the tasks in the loop and still schedules everything', () => {
    const { p } = plan([
      { name: 'A', duration: 1 }, { name: 'B', duration: 1, preds: '1' },
      { name: 'C', duration: 1, preds: '2' }, { name: 'D', duration: 1, preds: '3' }
    ]);
    p.tasks[0].preds = [{ uid: p.tasks[2].uid, type: 'FS', lag: 0 }];
    const s = OP.schedule(p);
    expect(s.cycle).toEqual([1, 2, 3]);
    expect(s.rows).toHaveLength(4);
    s.rows.forEach((r: any) => expect(Number.isFinite(r.es)).toBe(true));
  });

  it('rejects a task that depends on itself', () => {
    const { p } = plan([{ name: 'A' }, { name: 'B' }]);
    expect(M.parsePreds(p, '1', p.tasks[0].uid)).toEqual({ preds: [], errors: ['1'] });
  });
});

describe('constraints and deadlines', () => {
  it('start no earlier than delays a task', () => {
    const { s } = plan([{ name: 'A', constraint: 'SNET', constraintDate: '2026-01-19' }]);
    expect(row(s, 'A').es).toBe(10);
    expect(day(row(s, 'A').startDn)).toBe('2026-01-19');
  });

  it('finish no earlier than delays a task so it finishes on or after the date', () => {
    const { s } = plan([{ name: 'A', duration: 2, constraint: 'FNET', constraintDate: '2026-01-16' }]);
    expect(day(row(s, 'A').finishDn)).toBe('2026-01-16');
    expect(day(row(s, 'A').startDn)).toBe('2026-01-15');
  });

  it('must start on places a task on that date', () => {
    const { s } = plan([{ name: 'A', duration: 2, constraint: 'MSO', constraintDate: '2026-01-14' }]);
    expect(day(row(s, 'A').startDn)).toBe('2026-01-14');
  });

  it('flags a must-start-on date that predecessors cannot meet', () => {
    const { s } = plan([
      { name: 'A', duration: 5 },
      { name: 'B', duration: 1, preds: '1', constraint: 'MSO', constraintDate: '2026-01-07' }
    ]);
    expect(row(s, 'B').conflict).toMatch(/earlier than its predecessors allow/);
  });

  it('flags a missed deadline and makes the task critical', () => {
    const { s } = plan([{ name: 'A', duration: 5, deadline: '2026-01-08' }]);
    expect(row(s, 'A').missedDeadline).toBe(true);
    expect(row(s, 'A').critical).toBe(true);
    expect(row(s, 'A').slack).toBeLessThan(0);
  });

  it('does not flag a deadline that is met', () => {
    const { s } = plan([{ name: 'A', duration: 5, deadline: '2026-01-09' }]);
    expect(row(s, 'A').missedDeadline).toBe(false);
  });

  it('as late as possible moves a task right up to where it is needed', () => {
    const { s } = plan([
      { name: 'Long', duration: 5 },
      { name: 'Short', duration: 1, constraint: 'ALAP' }
    ]);
    expect(row(s, 'Short').es).toBe(4);
    expect(row(s, 'Short').ef).toBe(5);
  });
});

describe('milestones, splits and rollups', () => {
  it('treats a zero-duration task as a milestone', () => {
    const { s } = plan([{ name: 'A', duration: 3 }, { name: 'Done', duration: 0, preds: '1' }]);
    expect(row(s, 'Done').milestone).toBe(true);
    expect(row(s, 'Done').es).toBe(3);
  });

  it('a split task takes longer and works in two segments', () => {
    const { s } = plan([{ name: 'A', duration: 4, splits: [{ at: 2, gap: 2 }] }]);
    expect(row(s, 'A').ef).toBe(6);
    expect(row(s, 'A').segs).toEqual([[0, 2], [4, 6]]);
  });

  it('summary tasks span their children and number the WBS', () => {
    const { s } = plan([
      { name: 'Phase', level: 1 },
      { name: 'A', duration: 3, level: 2 },
      { name: 'B', duration: 2, level: 2, preds: '2' }
    ]);
    const phase = row(s, 'Phase');
    expect(phase.summary).toBe(true);
    expect(phase.es).toBe(0);
    expect(phase.ef).toBe(5);
    expect(phase.duration).toBe(5);
    expect(row(s, 'A').wbs).toBe('1.1');
    expect(row(s, 'B').wbs).toBe('1.2');
  });

  it('summary % complete is weighted by duration', () => {
    const { s } = plan([
      { name: 'Phase', level: 1 },
      { name: 'A', duration: 3, level: 2, percent: 100 },
      { name: 'B', duration: 1, level: 2, percent: 0 }
    ]);
    expect(row(s, 'Phase').percent).toBe(75);
  });

  it('an empty project schedules without errors', () => {
    const s = OP.schedule(M.blank());
    expect(s.rows).toEqual([]);
    expect(s.duration).toBe(0);
    expect(s.totalCost).toBe(0);
  });
});

describe('resources and cost', () => {
  function withResource(fields: Record<string, unknown>, units: number, taskFields: Record<string, unknown> = {}, tweak?: (p: any) => void) {
    return plan([{ name: 'A', duration: 2, ...taskFields }], p => {
      const r = M.newResource(p, { name: 'Ann', ...fields });
      p.resources.push(r);
      tweak?.(p);
    });
  }
  const assign = (p: any, units: number, taskIndex = 0) => {
    p.tasks[taskIndex].assignments.push({ res: p.resources[0].uid, units });
    return OP.schedule(p);
  };

  it('costs work resources from rate, hours per day and duration', () => {
    const { p } = withResource({ rate: 10 }, 100);
    const s = assign(p, 100);
    expect(row(s, 'A').cost).toBe(160); // 2 days x 8 h x 10
    expect(row(s, 'A').work).toBe(16);
    expect(s.totalCost).toBe(160);
  });

  it('scales cost by the assigned units', () => {
    const { p } = withResource({ rate: 10 }, 50);
    expect(row(assign(p, 50), 'A').cost).toBe(80);
  });

  it('adds cost per use once', () => {
    const { p } = withResource({ rate: 10, costPerUse: 50 }, 100);
    expect(row(assign(p, 100), 'A').cost).toBe(210);
  });

  it('applies a rate change from its date', () => {
    const { p } = withResource({ rate: 10, rates: [{ from: '2026-01-06', rate: 20 }] }, 100);
    expect(row(assign(p, 100), 'A').cost).toBe(80 + 160); // Monday at 10, Tuesday at 20
  });

  it('costs materials by quantity and cost resources by amount', () => {
    const { p } = plan([{ name: 'A', duration: 2, fixedCost: 100 }], q => {
      q.resources.push(M.newResource(q, { name: 'Bricks', kind: 'Material', rate: 5 }));
      q.resources.push(M.newResource(q, { name: 'Permit', kind: 'Cost' }));
    });
    p.tasks[0].assignments.push({ res: p.resources[0].uid, units: 10 }, { res: p.resources[1].uid, units: 75 });
    const s = OP.schedule(p);
    expect(row(s, 'A').cost).toBe(100 + 50 + 75);
    expect(row(s, 'A').work).toBe(0);
  });

  it('flags overallocation when two parallel tasks share a person', () => {
    const { p } = plan([{ name: 'A', duration: 2 }, { name: 'B', duration: 2 }], q => { q.resources.push(M.newResource(q, { name: 'Ann' })); });
    p.tasks.forEach((t: any) => t.assignments.push({ res: p.resources[0].uid, units: 100 }));
    const s = OP.schedule(p);
    expect(s.resStats[p.resources[0].uid].over).toBe(true);
    expect(s.resStats[p.resources[0].uid].peak).toBe(200);
    expect(row(s, 'A').over).toBe(true);
  });

  it('does not flag a person working one task at a time', () => {
    const { p } = plan([{ name: 'A', duration: 2 }, { name: 'B', duration: 2, preds: '1' }], q => { q.resources.push(M.newResource(q, { name: 'Ann' })); });
    p.tasks.forEach((t: any) => t.assignments.push({ res: p.resources[0].uid, units: 100 }));
    expect(OP.schedule(p).resStats[p.resources[0].uid].over).toBe(false);
  });

  it('counts a vacation day as no capacity', () => {
    const { p } = plan([{ name: 'A', duration: 1 }], q => { q.resources.push(M.newResource(q, { name: 'Ann', vacations: [START] })); });
    p.tasks[0].assignments.push({ res: p.resources[0].uid, units: 100 });
    expect(OP.schedule(p).resStats[p.resources[0].uid].over).toBe(true);
  });
});

describe('resource leveling', () => {
  function shared() {
    const { p } = plan([{ name: 'A', duration: 2 }, { name: 'B', duration: 2 }, { name: 'C', duration: 1, preds: '2' }], q => {
      q.resources.push(M.newResource(q, { name: 'Ann' }));
    });
    p.tasks.slice(0, 2).forEach((t: any) => t.assignments.push({ res: p.resources[0].uid, units: 100 }));
    return p;
  }

  it('delays one of two clashing tasks until the person is free', () => {
    const p = shared();
    const res = OP.level(p);
    expect(res).toEqual({ moved: 1, unresolved: [] });
    const s = OP.schedule(p);
    expect(s.resStats[p.resources[0].uid].over).toBe(false);
    // B has no slack (C follows it), so the leveler keeps B in place and delays A instead.
    expect(row(s, 'B').es).toBe(0);
    expect(row(s, 'A').es).toBe(2);
    expect(row(s, 'C').es).toBe(2); // still follows B
    expect(s.duration).toBe(4);
  });

  it('leaves a plan with no clashes alone', () => {
    const { p } = plan([{ name: 'A', duration: 2 }, { name: 'B', duration: 2, preds: '1' }]);
    expect(OP.level(p)).toEqual({ moved: 0, unresolved: [] });
  });

  it('does not move a task that already has progress', () => {
    const p = shared();
    p.tasks[1].percent = 50;
    OP.level(p);
    expect(p.tasks[1].levelDelay).toBe(0);
  });
});

describe('baseline and earned value', () => {
  // One 4-day task costing 320 (8 h x 4 days x 10). Status date is Wed 7 Jan, so 3 of 4 days should be done.
  function tracked() {
    const { p } = plan([{ name: 'A', duration: 4 }], q => {
      q.resources.push(M.newResource(q, { name: 'Ann', rate: 10 }));
      q.statusDate = '2026-01-07';
    });
    p.tasks[0].assignments.push({ res: p.resources[0].uid, units: 100 });
    OP.setBaseline(p);
    return p;
  }

  it('saves the planned dates and cost as the baseline', () => {
    const p = tracked();
    expect(p.baseline.tasks[p.tasks[0].uid]).toMatchObject({ start: '2026-01-05', finish: '2026-01-08', duration: 4, cost: 320 });
  });

  it('computes earned value for work behind schedule and on budget', () => {
    const p = tracked();
    p.tasks[0].percent = 25;
    const { ev } = OP.schedule(p);
    expect(ev.bac).toBe(320);
    expect(ev.bcws).toBe(240);
    expect(ev.bcwp).toBe(80);
    expect(ev.acwp).toBe(80);
    expect(ev.sv).toBe(-160);
    expect(ev.cv).toBe(0);
    expect(ev.spi).toBeCloseTo(1 / 3);
    expect(ev.cpi).toBe(1);
    expect(ev.eac).toBe(320);
  });

  it('forecasts a cost overrun when the actual rate is higher than the baseline', () => {
    const p = tracked();
    p.tasks[0].percent = 25;
    p.resources[0].rate = 20; // the task now costs 640
    const { ev } = OP.schedule(p);
    expect(ev.acwp).toBe(160);
    expect(ev.cv).toBe(-80);
    expect(ev.cpi).toBe(0.5);
    expect(ev.eac).toBe(640);
    expect(ev.vac).toBe(-320);
  });

  it('shows how far a task has slipped from its baseline', () => {
    const p = tracked();
    p.tasks[0].duration = 6;
    const r = row(OP.schedule(p), 'A');
    expect(r.finishVar).toBe(2);
    expect(r.slipped).toBe(true);
    expect(r.startVar).toBe(0);
  });

  it('has no ratios before a baseline exists', () => {
    const { s } = plan([{ name: 'A' }]);
    expect(s.ev.spi).toBeNull();
    expect(s.ev.cpi).toBeNull();
  });
});

describe('dates, durations and loading', () => {
  it('parses only real calendar dates', () => {
    expect(U.parseDate('2026-02-28')).not.toBeNull();
    expect(U.parseDate('2026-02-30')).toBeNull();
    expect(U.parseDate('not a date')).toBeNull();
    expect(U.parseDate('')).toBeNull();
    expect(U.iso(U.parseDate('2028-02-29'))).toBe('2028-02-29');
  });

  it('reads durations in days, weeks and hours', () => {
    expect(M.parseDuration('5')).toBe(5);
    expect(M.parseDuration('2w')).toBe(10);
    expect(M.parseDuration('4h', 8)).toBe(0.5);
    expect(M.parseDuration('1.5 days')).toBe(1.5);
    expect(M.parseDuration('soon')).toBeNull();
  });

  it('repairs damaged project data when loading', () => {
    const p = M.normalize({
      budget: 'abc', hoursPerDay: 99,
      tasks: [{ uid: 1, name: 5, duration: 2 }, { uid: 1, name: 'dup' }, null, 'junk'],
      resources: 'nope'
    });
    expect(p.budget).toBe(0);
    expect(p.hoursPerDay).toBe(24);
    expect(p.tasks).toHaveLength(2);
    expect(new Set(p.tasks.map((t: any) => t.uid)).size).toBe(2);
    expect(p.tasks[0].name).toBe('5');
    expect(p.resources).toEqual([]);
    expect(() => OP.schedule(p)).not.toThrow();
  });

  it('migrates the old start-no-earlier-than field', () => {
    const p = M.normalize({ tasks: [{ uid: 1, name: 'A', snet: '2026-02-02' }] });
    expect(p.tasks[0]).toMatchObject({ constraint: 'SNET', constraintDate: '2026-02-02' });
  });
});

describe('charts', () => {
  const C = OP.charts;
  const inputs = (p: any) => { const s = OP.schedule(p); return { p, s, rows: s.rows }; };

  it('draw every chart for the sample project', () => {
    const o = inputs(OP.demo());
    expect(C.gantt({ ...o, zoom: 'week', critical: true, table: true }).svg).toMatch(/^<svg/);
    expect(C.network({ ...o, critical: true, dates: true, title: 'Sample' }).svg).toMatch(/^<svg/);
    expect(C.wbs({ ...o, depth: 3 }).svg).toMatch(/^<svg/);
    expect(C.costChart({ p: o.p, data: C.monthlyCost(o.p, o.s), kind: 'cumulative' })).toMatch(/<svg/);
  });

  it('draw an empty project without throwing', () => {
    const o = inputs(M.blank());
    expect(() => C.gantt({ ...o, zoom: 'week', critical: true, table: true })).not.toThrow();
    expect(() => C.network({ ...o, critical: true, dates: false, title: 'Empty' })).not.toThrow();
    expect(() => C.wbs({ ...o, depth: 3 })).not.toThrow();
  });

  it('escape task names so they cannot inject markup', () => {
    const { p, s } = plan([{ name: '<img src=x onerror=alert(1)>' }]);
    const svg = C.gantt({ p, s, rows: s.rows, zoom: 'week', critical: true, table: true }).svg;
    expect(svg).not.toContain('<img');
    expect(svg).toContain('&lt;img');
  });
});

describe('limits', () => {
  const MAX = M.MAX_DAYS;
  const two = () => plan([{ name: 'A', duration: 1 }, { name: 'B', duration: 1, preds: '1' }]).p;

  it('rejects durations and lags beyond the limit', () => {
    expect(M.parseDuration(String(MAX))).toBe(MAX);
    expect(M.parseDuration(String(MAX + 1))).toBeNull();
    expect(M.parseDuration('99999999')).toBeNull();
    expect(M.parseDuration('9999w')).toBeNull();
    const p = two();
    expect(M.parsePreds(p, '1FS+99999999d', p.tasks[1].uid).errors).toEqual(['1FS+99999999d']);
    expect(M.parsePreds(p, '1FS-' + MAX + 'd', p.tasks[1].uid).errors).toEqual([]);
  });

  it('clamps extreme values in loaded files so the schedule stays small and valid', () => {
    const raw = two();
    raw.tasks[0].duration = 5e7;
    raw.tasks[1].preds[0].lag = 1e9;
    raw.tasks[1].levelDelay = 1e9;
    raw.tasks[1].splits = [{ at: 1, gap: 1e9 }];
    const p = OP.io.fromJSON(JSON.stringify(raw));
    expect(p.tasks[0].duration).toBe(MAX);
    expect(p.tasks[1].preds[0].lag).toBe(MAX);
    expect(p.tasks[1].levelDelay).toBe(MAX);
    expect(p.tasks[1].splits[0].gap).toBe(MAX);
    const t = Date.now(), s = OP.schedule(p);
    expect(Date.now() - t).toBeLessThan(2000);
    expect(U.iso(s.finishDn)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    raw.tasks[1].preds[0].lag = -1e9;
    expect(OP.io.fromJSON(JSON.stringify(raw)).tasks[1].preds[0].lag).toBe(-MAX);
  });
});

describe('working week', () => {
  const fin = (days: number[] | undefined, dur: number, start = START) => {
    const { s } = plan([{ name: 'A', duration: dur }], p => { if (days) p.workDays = days; p.start = start; });
    return [day(row(s, 'A').startDn), day(row(s, 'A').finishDn)];
  };

  it('is Monday to Friday unless the project says otherwise', () => {
    expect(M.blank().workDays).toEqual([1, 2, 3, 4, 5]);
    expect(fin(undefined, 5)).toEqual(['2026-01-05', '2026-01-09']);
  });

  it('can include Saturday: a six-day week', () => {
    expect(fin([1, 2, 3, 4, 5, 6], 6)).toEqual(['2026-01-05', '2026-01-10']);
  });

  it('can be Sunday to Thursday: Friday and Saturday are days off', () => {
    expect(fin([0, 1, 2, 3, 4], 5)).toEqual(['2026-01-05', '2026-01-11']);   // Mon, Tue, Wed, Thu, then Sunday
  });

  it('moves a start date that falls on a day off to the next working day', () => {
    expect(fin([2, 3], 1, '2026-01-05')).toEqual(['2026-01-06', '2026-01-06']);   // Monday is off, Tuesday is the first working day
  });

  it('still skips holidays that fall on working days', () => {
    const { s } = plan([{ name: 'A', duration: 3 }], p => { p.workDays = [0, 1, 2, 3, 4]; p.holidays = ['2026-01-06']; });
    expect(day(row(s, 'A').finishDn)).toBe('2026-01-08');      // Mon, (Tue is a holiday), Wed, Thu
  });

  it('repairs a bad list: never empty, whole numbers 0-6, no repeats', () => {
    for (const [bad, fixed] of [[[], [1, 2, 3, 4, 5]], [[9, -1, 2.5], [1, 2, 3, 4, 5]], [[3, 3, 1, 1], [1, 3]], [['2', 0], [0, 2]], [undefined, [1, 2, 3, 4, 5]], ['x', [1, 2, 3, 4, 5]]] as [any, number[]][]) {
      const p = M.blank(); (p as any).workDays = bad; expect(M.normalize(p).workDays).toEqual(fixed);
    }
  });

  it('shades the days off on the Gantt chart', () => {
    const { p, s } = plan([{ name: 'A', duration: 10 }], q => { q.workDays = [0, 1, 2, 3, 4]; });
    const svg = OP.charts.gantt({ p, s, rows: s.rows, zoom: 'day', critical: true, table: false }).svg;
    expect((svg.match(/class="wk"/g) || []).length).toBeGreaterThan(2);
  });
});
