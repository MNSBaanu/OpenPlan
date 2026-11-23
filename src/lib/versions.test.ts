// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OP from '../core';
import { deleteVersion, listVersions, saveVersion } from './versions';

const KEY = 'openplan.versions';
const plan = () => OP.model.normalize(OP.demo());

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('saved versions', () => {
  it('lists a saved version, newest first', () => {
    saveVersion('First', plan());
    saveVersion('Second', plan());
    const list = listVersions();
    expect(list.map(v => v.name)).toEqual(['Second', 'First']);
    expect(list[0].project).toBe(plan().name);
    expect(JSON.parse(list[0].json).tasks.length).toBeGreaterThan(0);
  });

  it('keeps at most 30 versions and drops the oldest', () => {
    for (let i = 1; i <= 31; i++) saveVersion('V' + i, plan());
    const list = listVersions();
    expect(list.length).toBe(30);
    expect(list[0].name).toBe('V31');
    expect(list.some(v => v.name === 'V1')).toBe(false);
    expect(list[29].name).toBe('V2');
  });

  it('names a version "Version" when no name is given', () => {
    saveVersion('   ', plan());
    expect(listVersions()[0].name).toBe('Version');
    saveVersion('', plan());
    expect(listVersions()[0].name).toBe('Version');
  });

  it('deleteVersion removes only the requested version', () => {
    let tick = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => ++tick); // ids come from Date.now(); keep them distinct
    saveVersion('Keep', plan());
    saveVersion('Drop', plan());
    const [drop, keep] = listVersions();
    deleteVersion(drop.id);
    expect(listVersions().map(v => v.name)).toEqual(['Keep']);
    expect(listVersions()[0].id).toBe(keep.id);
  });

  it('returns an empty list when storage is damaged instead of throwing', () => {
    localStorage.setItem(KEY, '{broken');
    expect(() => listVersions()).not.toThrow();
    expect(listVersions()).toEqual([]);
    localStorage.setItem(KEY, '["not a version", null, 42]');
    expect(listVersions()).toEqual([]);
  });

  it('says storage is full and keeps old versions when setItem throws', () => {
    saveVersion('Old', plan());
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    const msg = saveVersion('New', plan());
    expect(msg).toContain('Browser storage is full');
    expect(listVersions().map(v => v.name)).toEqual(['Old']);
  });
});
