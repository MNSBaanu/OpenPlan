// What a mouse press on a Gantt bar does, decided by where on the bar it lands.
//
//   start     the left edge: moves the start, keeping the finish
//   finish    the right edge: changes the duration
//   move      the middle: moves the whole task
//   link      the round handle just after the bar: drag to another bar to make a link
//   progress  the small marker under the bar: drag to set the percent complete
//
// Short bars (a 1-day task at the default zoom is only 12 px wide) would be all handle, so the edge zones
// are never more than a third of the bar, and the middle always keeps some room.

export type BarZone = 'start' | 'finish' | 'move' | 'link' | 'progress';
export interface BarPos { s: number; e: number; y: number; top?: number; bot?: number; px?: number; leaf?: boolean }

export const EDGE_MIN = 4, EDGE_MAX = 8;       // pixels
export const LINK_FROM = 2, LINK_TO = 16;      // the link handle sits this far after the end of the bar
export const MARK_SIZE = 6;                    // how far from the progress marker still counts as it

export const edgeWidth = (barW: number) => Math.min(EDGE_MAX, Math.max(EDGE_MIN, barW / 3));

// sx, sy: the pointer position in the chart's own pixels.
export function barZone(sx: number, sy: number, p: BarPos): BarZone | null {
  if (p.top == null || p.bot == null) {                       // a milestone: only moving
    return sx >= p.s - 2 && sx <= p.e + 2 && Math.abs(sy - p.y) <= 8 ? 'move' : null;
  }
  if (p.leaf) {
    if (sx > p.e + LINK_FROM && sx <= p.e + LINK_TO && Math.abs(sy - p.y) <= 9) return 'link';
    if (p.px != null && sy > p.bot - 1 && sy <= p.bot + 6 && Math.abs(sx - p.px) <= MARK_SIZE) return 'progress';
  }
  if (sy < p.top - 2 || sy > p.bot + 2) return null;
  const w = p.e - p.s, hw = edgeWidth(w);
  if (sx < p.s - 3 || sx > p.e + 2) return null;
  if (sx < p.s + hw) return 'start';
  if (sx > p.e - hw) return 'finish';
  return 'move';
}

// Percent complete for a pointer at sx: 0 at the left end of the bar, 100 at the right, in steps of 5.
export function progressAt(sx: number, s: number, e: number): number {
  if (e <= s) return 0;
  const f = Math.max(0, Math.min(1, (sx - s) / (e - s)));
  return Math.round(f * 20) * 5;
}

export const CURSORS: Record<BarZone, string> = { start: 'ew-resize', finish: 'ew-resize', move: 'grab', link: 'crosshair', progress: 'ew-resize' };
