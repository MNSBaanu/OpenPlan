// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import OP from '../core';
import { fold, icsEventCount, icsText, projectToIcs } from './exportIcs';

const NOW = new Date('2026-11-22T10:00:00Z');
const build = (edit?: (p: any) => void) => {
  const p: any = OP.model.normalize(OP.demo());
  edit?.(p);
  const s = OP.schedule(p);
  return { p, s, text: projectToIcs(p, s, { now: NOW }) };
};
const events = (text: string) => text.replace(/\r\n /g, '').split('BEGIN:VEVENT').slice(1).map(e => Object.fromEntries(e.split('\r\n').filter(l => l.includes(':')).map(l => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1)])));

describe('iCalendar export', () => {
  it('is a calendar with the right frame, CRLF line ends and a final CRLF', () => {
    const { text } = build();
    expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:')).toBe(true);
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);          // no bare line breaks
    expect((text.match(/BEGIN:VEVENT/g) || []).length).toBe((text.match(/END:VEVENT/g) || []).length);
  });

  it('writes each milestone as an all-day event on its date', () => {
    const { s, text } = build();
    const ms = s.rows.filter((r: any) => !r.summary && (r.task.milestone || r.duration === 0));
    expect(ms.length).toBeGreaterThan(0);
    const ev = events(text).filter(e => e.UID.startsWith('milestone-'));
    expect(ev).toHaveLength(ms.length);
    const first = ev[0], r = ms[0], d = OP.util.iso(r.startDn).replace(/-/g, ''), next = OP.util.iso(r.startDn + 1).replace(/-/g, '');
    expect(first['DTSTART;VALUE=DATE']).toBe(d);
    expect(first['DTEND;VALUE=DATE']).toBe(next);                       // all-day events end the next day
    expect(first.SUMMARY).toBe(icsText(r.task.name));
    expect(first.TRANSP).toBe('TRANSPARENT');                           // they do not mark you busy
  });

  it('writes a task deadline as its own event', () => {
    const { text } = build(p => { p.tasks[2].deadline = '2026-03-04'; });
    const dl = events(text).filter(e => e.UID.startsWith('deadline-'));
    expect(dl).toHaveLength(1);
    expect(dl[0]['DTSTART;VALUE=DATE']).toBe('20260304');
    expect(dl[0].SUMMARY).toMatch(/^Deadline: /);
  });

  it('counts the events, and a plan with none gives a calendar with no events', () => {
    const { p, s } = build(p => { p.tasks.forEach((t: any) => { t.milestone = false; if (t.duration === 0) t.duration = 1; t.deadline = ''; }); });
    expect(icsEventCount(p, s)).toBe(0);
    expect(projectToIcs(p, s)).not.toContain('BEGIN:VEVENT');
  });

  it('keeps the same event ids between exports, so a calendar updates instead of duplicating', () => {
    const a = events(build().text).map(e => e.UID), b = events(build().text).map(e => e.UID);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
    expect(a.every(u => /^(milestone|deadline)-\d+-[0-9a-z]+@openplan$/.test(u))).toBe(true);
    const other = events(build(p => { p.name = 'Another plan'; }).text).map(e => e.UID);
    expect(other).not.toEqual(a);                                       // two plans never share ids
  });

  it('stamps the file with the time it was made', () => {
    expect(build().text).toContain('DTSTAMP:20261122T100000Z');
  });

  it('escapes commas, semicolons, backslashes and line breaks in names', () => {
    const { text } = build(p => { const m = p.tasks.find((t: any) => t.milestone || t.duration === 0); m.name = 'Sign off; ship, \\ done\nnow'; });
    expect(events(text).some(e => e.SUMMARY === 'Sign off\\; ship\\, \\\\ done\\nnow')).toBe(true);
  });
});

describe('icsText and fold', () => {
  it('escapes the characters the format reserves and drops control characters', () => {
    expect(icsText('a,b;c\\d')).toBe('a\\,b\\;c\\\\d');
    expect(icsText('one\r\ntwo\nthree')).toBe('one\\ntwo\\nthree');
    expect(icsText('bell\u0007here')).toBe('bellhere');
    expect(icsText(null)).toBe('');
  });

  it('leaves short lines alone and folds long ones at 75 bytes, with a space starting each continuation', () => {
    expect(fold('SUMMARY:short')).toBe('SUMMARY:short');
    const long = 'DESCRIPTION:' + 'word '.repeat(60);
    const parts = fold(long).split('\r\n');
    expect(parts.length).toBeGreaterThan(3);
    parts.forEach(l => expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75));
    parts.slice(1).forEach(l => expect(l.startsWith(' ')).toBe(true));
    expect(parts.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(long);           // unfolding restores the line
  });

  it('never splits a multi-byte character when folding', () => {
    const line = 'SUMMARY:' + 'ශ්‍රී ලංකා 日本語 😀 '.repeat(20);
    const folded = fold(line);
    folded.split('\r\n').forEach(l => expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75));
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });
});
