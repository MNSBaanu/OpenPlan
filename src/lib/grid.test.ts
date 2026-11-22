import { describe, expect, it } from 'vitest';
import { COLS, COL_GROUPS, FILTERS, GROUPS, SORTS, toggleCol } from './grid';

describe('toggleCol', () => {
  it('puts a column that is turned on in its standard place, not at the end', () => {
    expect(toggleCol(['id', 'ind', 'name', 'duration', 'finish'], 'start', true))
      .toEqual(['id', 'ind', 'name', 'duration', 'start', 'finish']);
    expect(toggleCol(['id', 'ind', 'name', 'notes'], 'wbs', true))
      .toEqual(['id', 'ind', 'name', 'wbs', 'notes']);
  });

  it('removes a column that is turned off', () => {
    expect(toggleCol(['id', 'ind', 'name', 'duration', 'start', 'finish'], 'start', false))
      .toEqual(['id', 'ind', 'name', 'duration', 'finish']);
  });

  it('does not duplicate a column that is already on', () => {
    expect(toggleCol(['id', 'ind', 'name', 'duration', 'start'], 'start', true))
      .toEqual(['id', 'ind', 'name', 'duration', 'start']);
  });

  it('leaves the list alone when turning off a column that is not shown', () => {
    expect(toggleCol(['id', 'ind', 'name', 'duration'], 'cost', false))
      .toEqual(['id', 'ind', 'name', 'duration']);
  });

  it('puts an unknown column, such as a custom field, last', () => {
    expect(toggleCol(['id', 'ind', 'name', 'duration'], 'cf:abc', true))
      .toEqual(['id', 'ind', 'name', 'duration', 'cf:abc']);
    expect(toggleCol(['id', 'ind', 'name', 'cf:abc'], 'cv', true))
      .toEqual(['id', 'ind', 'name', 'cv', 'cf:abc']);
  });

  it('puts columns given out of order back in the standard order', () => {
    expect(toggleCol(['finish', 'name', 'start', 'id'], 'ind', true))
      .toEqual(['id', 'ind', 'name', 'start', 'finish']);
  });

  it('returns a new list and does not change the one passed in', () => {
    const cols = ['id', 'ind', 'name', 'finish'];
    const copy = cols.slice();
    expect(toggleCol(cols, 'start', true)).not.toBe(cols);
    expect(toggleCol(cols, 'finish', false)).not.toBe(cols);
    expect(cols).toEqual(copy);
  });
});

describe('column, filter, group and sort lists', () => {
  it('lists every column group entry as a known column, once', () => {
    const keys = COL_GROUPS.flatMap(g => g[1]);
    keys.forEach(k => expect(COLS[k], k).toBeDefined());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives every filter, grouping and sort a readable label', () => {
    for (const list of [FILTERS, GROUPS, SORTS]) {
      Object.entries(list).forEach(([k, label]) => expect(label.trim().length, k).toBeGreaterThan(1));
    }
  });
});
