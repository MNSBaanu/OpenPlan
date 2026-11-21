import { describe, expect, it } from 'vitest';
import { barZone, edgeWidth, progressAt, type BarPos } from './ganttDrag';

// A leaf task bar 100 px wide, 14 px tall, centred on y = 17, at 40% complete.
const bar = (w = 100): BarPos => ({ s: 200, e: 200 + w, y: 17, top: 10, bot: 24, px: 200 + w * 0.4, leaf: true });

describe('barZone', () => {
  it('splits a normal bar into start edge, middle and finish edge', () => {
    const b = bar();
    expect(barZone(201, 17, b)).toBe('start');
    expect(barZone(250, 17, b)).toBe('move');
    expect(barZone(299, 17, b)).toBe('finish');
  });

  it('keeps a middle on a very short bar (a 1-day bar is 12 px wide)', () => {
    const b = bar(12);
    expect(edgeWidth(12)).toBe(4);
    expect(barZone(201, 17, b)).toBe('start');
    expect(barZone(206, 17, b)).toBe('move');
    expect(barZone(210, 17, b)).toBe('finish');
  });

  it('never makes the edges more than a third of the bar or more than 8 px', () => {
    expect(edgeWidth(300)).toBe(8);
    expect(edgeWidth(15)).toBe(5);
    expect(edgeWidth(2)).toBe(4);
  });

  it('finds the link handle just after the end of a task bar, and nothing past it', () => {
    const b = bar();
    expect(barZone(309, 17, b)).toBe('link');
    expect(barZone(303, 17, b)).toBe('link');
    expect(barZone(330, 17, b)).toBeNull();
    expect(barZone(309, 40, b)).toBeNull();
  });

  it('finds the progress marker under the bar, at the current progress', () => {
    const b = bar();                         // 40% of 100 px: x = 240
    expect(barZone(240, 27, b)).toBe('progress');
    expect(barZone(246, 27, b)).toBe('progress');
    expect(barZone(260, 27, b)).toBeNull();  // too far from the marker
    expect(barZone(240, 17, b)).toBe('move'); // on the bar itself it is still a move
  });

  it('ignores presses above and below the bar and left of it', () => {
    const b = bar();
    expect(barZone(250, 2, b)).toBeNull();
    expect(barZone(250, 40, b)).toBeNull();
    expect(barZone(190, 17, b)).toBeNull();
  });

  it('treats a milestone as move only', () => {
    const ms: BarPos = { s: 194, e: 206, y: 12 };
    expect(barZone(200, 12, ms)).toBe('move');
    expect(barZone(212, 12, ms)).toBeNull();
    expect(barZone(200, 40, ms)).toBeNull();
  });
});

describe('progressAt', () => {
  it('goes from 0 at the left end to 100 at the right end, in steps of 5', () => {
    expect(progressAt(200, 200, 300)).toBe(0);
    expect(progressAt(300, 200, 300)).toBe(100);
    expect(progressAt(250, 200, 300)).toBe(50);
    expect(progressAt(262, 200, 300)).toBe(60);
    expect(progressAt(100, 200, 300)).toBe(0);      // past either end is clamped
    expect(progressAt(900, 200, 300)).toBe(100);
    expect(progressAt(5, 10, 10)).toBe(0);          // an empty bar
  });
});
