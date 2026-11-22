import { describe, expect, it } from 'vitest';
import { COLS, COL_GROUPS, FILTERS, GROUPS, SORTS, toggleCol } from './grid';

describe('toggleCol', () => {
  it('puts a column it turns on back in its standard place, not at the end', () => {
    // In the standard order duration sits before cost, so it cannot be appended.
    expect(toggleCol(['id', 'ind', 'name', 'cost'], 'duration', true)).toEqual(['id', 'ind', 'name', 'duration', 'cost']);
    expect(toggleCol(['id', 'ind', 'name', 'cost'], 'wbs', true)).toEqual(['id', 'ind', 'name', 'wbs', 'cost']);
  });

  it('removes a column it turns off', () => {
    expect(toggleCol(['id', 'ind', 'name', 'duration', 'cost'], 'duration', false)).toEqual(['id', 'ind', 'name', 'cost']);
  });

  it('does not duplicate a column that is already on', () => {
    expect(toggleCol(['id', 'ind', 'name', 'duration'], 'duration', true)).toEqual(['id', 'ind', 'name', 'duration']);
  });

  it('puts a column it does not know last', () => {
    expect(toggleCol(['id', 'ind', 'name'], 'cf:mycustom', true)).toEqual(['id', 'ind', 'name', 'cf:mycustom']);
    // A known column still lands in its standard place, ahead of the unknown one.
    expect(toggleCol(['id', 'ind', 'name', 'cf:mycustom'], 'duration', true)).toEqual(['id', 'ind', 'name', 'duration', 'cf:mycustom']);
  });

  it('leaves the list it is given alone and returns a new one', () => {
    const cols = ['id', 'ind', 'name'];
    const next = toggleCol(cols, 'wbs', true);
    expect(cols).toEqual(['id', 'ind', 'name']);
    expect(next).not.toBe(cols);
  });

  it('puts a jumbled list back into the standard order', () => {
    expect(toggleCol(['cost', 'name', 'id'], 'wbs', true)).toEqual(['id', 'name', 'wbs', 'cost']);
  });
});

describe('the column list', () => {
  it('lists every non-fixed column exactly once across the picker groups', () => {
    const grouped = COL_GROUPS.flatMap(g => g[1]);
    const pickable = Object.keys(COLS).filter(k => !COLS[k].fixed);
    expect(grouped.sort()).toEqual(pickable.sort());
  });
});

describe('the filter, group and sort menus', () => {
  it('gives every filter, grouping and sort a readable label', () => {
    [FILTERS, GROUPS, SORTS].forEach(list => {
      Object.entries(list).forEach(([key, label]) => {
        expect(label.trim().length, key).toBeGreaterThan(0);
      });
    });
  });
});
