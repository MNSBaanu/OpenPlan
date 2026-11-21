import { describe, expect, it } from 'vitest';
import { COLORS, MAX_PEOPLE, PRESENCE_EXPIRES_MS, Roster, cleanName, colorFor, initialsOf, pickColor, readPerson } from './presence';

describe('presence', () => {
  it('cleans names: no control characters, one space between words, at most 30 characters', () => {
    expect(cleanName('  Ana \n\t Silva  ')).toBe('Ana Silva');
    expect(cleanName('x'.repeat(80))).toHaveLength(30);
    expect(cleanName(null)).toBe('');
  });

  it('makes initials', () => {
    expect(initialsOf('Ana Maria Silva')).toBe('AS');
    expect(initialsOf('madonna')).toBe('MA');
    expect(initialsOf('')).toBe('?');
  });

  it('gives the same person the same colour every time, from the palette', () => {
    expect(colorFor('abc123')).toBe(colorFor('abc123'));
    expect(COLORS).toContain(colorFor('another-id'));
  });

  it('accepts a well-formed message and rejects anything else', () => {
    expect(readPerson({ id: 'abcd1234', name: ' Bo ', color: COLORS[2], uid: 7 })).toEqual({ id: 'abcd1234', name: 'Bo', color: COLORS[2], uid: 7 });
    expect(readPerson({ id: 'abcd1234', name: '', color: 'red', uid: 'x' })).toEqual({ id: 'abcd1234', name: 'Someone', color: colorFor('abcd1234'), uid: null });   // colour must be one of ours, so it can never carry markup
    for (const bad of [null, 5, 'x', {}, { id: 3 }, { id: '<b>' }, { id: 'ab' }, { id: 'a'.repeat(41) }]) expect(readPerson(bad)).toBeNull();
  });

  it('keeps a roster, reports changes, and forgets people who go quiet', () => {
    const r = new Roster(), ana = { id: 'ana00001', name: 'Ana', color: COLORS[0], uid: null as number | null };
    expect(r.update(ana, 0)).toBe(true);
    expect(r.update(ana, 1000)).toBe(false);                    // nothing new
    expect(r.update({ ...ana, uid: 4 }, 2000)).toBe(true);      // selected a task
    r.update({ id: 'bob00002', name: 'Bob', color: COLORS[1], uid: null }, 10_000);
    expect(r.list().map(p => p.name)).toEqual(['Ana', 'Bob']);
    expect(r.prune(2000 + PRESENCE_EXPIRES_MS + 1)).toBe(true); // Ana has been silent too long
    expect(r.list().map(p => p.name)).toEqual(['Bob']);
    r.clear(); expect(r.list()).toEqual([]);
  });

  it('limits how many people it tracks', () => {
    const r = new Roster();
    for (let i = 0; i < MAX_PEOPLE + 10; i++) r.update({ id: 'user' + String(i).padStart(4, '0'), name: 'U' + i, color: COLORS[0], uid: null });
    expect(r.list()).toHaveLength(MAX_PEOPLE);
  });

  it('moves only one of two people who have the same colour, to a colour nobody has', () => {
    const a = { id: 'aaaa0001', name: 'A', color: COLORS[0], uid: null }, b = { id: 'bbbb0002', name: 'B', color: COLORS[0], uid: null };
    expect(pickColor(a, [b])).toBe(COLORS[0]);                // the smaller id keeps it
    const moved = pickColor(b, [a]);
    expect(moved).not.toBe(COLORS[0]); expect(COLORS).toContain(moved);
    const c = { id: 'cccc0003', name: 'C', color: COLORS[1], uid: null };
    expect(pickColor(b, [a, c])).toBe(COLORS[2]);              // skips colours others are using
    expect(pickColor(b, [a, { ...b, color: COLORS[3] }])).toBe(moved);   // never counts itself
  });
});
