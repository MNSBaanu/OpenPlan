import { describe, expect, it } from 'vitest';
import { capHistory } from './history';

describe('capHistory', () => {
  it('keeps at most 100 snapshots, newest last', () => {
    const list = Array.from({ length: 120 }, (_, i) => String(i));
    const out = capHistory(list);
    expect(out).toHaveLength(100);
    expect(out[0]).toBe('20');
    expect(out[99]).toBe('119');
  });

  it('drops the oldest snapshots past about 20 MB', () => {
    const big = 'x'.repeat(4_000_000);
    expect(capHistory([big, big, big, 'last'])).toEqual([big, big, 'last']);
  });

  it('always keeps the latest snapshot, even when it is too large', () => {
    const huge = 'x'.repeat(11_000_000);
    expect(capHistory(['a', huge])).toEqual([huge]);
    expect(capHistory([])).toEqual([]);
  });
});
