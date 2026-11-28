import OP from '../../core';
import type { Project } from '../../types';

const U = OP.util;

/*
 * Writes a plan's milestones and deadlines as an iCalendar (.ics) file, so they can be added to Google Calendar,
 * Outlook, Apple Calendar and others. Each one is an all-day event. The format is RFC 5545: lines end in CRLF,
 * the characters \ ; , and line breaks are escaped in text, and lines longer than 75 bytes are folded.
 * Each event has a fixed id (project + task), so importing the file again updates the events instead of adding copies.
 */

// Text values: escape backslash, semicolon, comma and line breaks, and drop control characters.
// eslint-disable-next-line no-control-regex
export const icsText = (v: unknown) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');

// Fold a line so no line is longer than 75 bytes. A folded line continues on the next line after one space.
// Characters are never split in the middle (a character may take up to 4 bytes in UTF-8).
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > limit) { out.push(cur); cur = ''; bytes = 0; limit = 74; }   // later lines start with a space, which counts
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const ymd = (dn: number) => U.iso(dn).replace(/-/g, '');
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
// A short, stable id for this project, from its name and start, so events keep their identity between exports.
const projectKey = (p: Project) => {
  let h = 5381;
  for (const ch of (p.name || '') + '|' + (p.start || '')) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0;
  return h.toString(36);
};

export interface IcsOptions { now?: Date }

export function projectToIcs(p: Project, s: any, o: IcsOptions = {}): string {
  const key = projectKey(p), now = stamp(o.now || new Date());
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OpenPlan//Project planner//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsText(p.name)];
  const event = (id: string, dn: number, title: string, about: string) => {
    lines.push('BEGIN:VEVENT', 'UID:' + id, 'DTSTAMP:' + now, 'DTSTART;VALUE=DATE:' + ymd(dn), 'DTEND;VALUE=DATE:' + ymd(dn + 1),
      'SUMMARY:' + icsText(title), 'DESCRIPTION:' + icsText(about), 'TRANSP:TRANSPARENT', 'END:VEVENT');
  };
  s.rows.forEach((r: any) => {
    const t = r.task, label = r.id + '. ' + t.name;
    if (!r.summary && (t.milestone || r.duration === 0)) event('milestone-' + t.uid + '-' + key + '@openplan', r.startDn, t.name || 'Milestone', 'Milestone ' + label + ' in ' + p.name);
    const dl = U.parseDate(t.deadline);
    if (dl != null) event('deadline-' + t.uid + '-' + key + '@openplan', dl, 'Deadline: ' + (t.name || 'Task'), 'Deadline for ' + label + ' in ' + p.name);
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

// How many events the file would hold, so the app can say so before saving.
export const icsEventCount = (p: Project, s: any) => s.rows.reduce((n: number, r: any) => n + (!r.summary && (r.task.milestone || r.duration === 0) ? 1 : 0) + (U.parseDate(r.task.deadline) != null ? 1 : 0), 0);
