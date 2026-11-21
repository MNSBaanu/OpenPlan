// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import OP from '../core';

const draw = (edit?: boolean) => {
  const p = OP.model.normalize(OP.demo()), s = OP.schedule(p);
  return OP.charts.gantt({ p, s, rows: s.rows, zoom: 'week', critical: true, baseline: false, edit, table: true });
};

describe('Gantt chart handles', () => {
  it('draws handles only for the live chart, never for exports and prints', () => {
    const plain = draw(), live = draw(true);
    expect(plain.svg).not.toMatch(/class="(grip|ldot|pmark)"/);
    expect(live.svg).toMatch(/class="grip"/);
    expect(live.svg).toMatch(/class="ldot"/);
    expect(live.svg).toMatch(/class="pmark"/);
  });

  it('draws 14 px bars', () => {
    expect(draw().svg).toMatch(/<rect class="bar[^"]*" x="[\d.]+" y="[\d.]+" width="[\d.]+" height="14"\/>/);
  });

  it('reports where each task bar is, for the mouse code', () => {
    const g = draw(true), leaf = Object.values<any>(g.pos).find(p => p.leaf)!;
    expect(leaf.bot - leaf.top).toBe(14);
    expect(leaf.y).toBe(leaf.top + 7);
    expect(leaf.px).toBeGreaterThanOrEqual(leaf.s);
    expect(leaf.px).toBeLessThanOrEqual(leaf.e);
  });

  it('keeps the same width and height with or without handles', () => {
    const size = (t: string) => /width="(\d+)" height="(\d+)"/.exec(t)!.slice(1).join('x');
    expect(size(draw(true).svg)).toBe(size(draw().svg));
  });
});
