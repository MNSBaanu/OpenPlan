// Pinch-to-zoom maths for the Gantt timescale.
//
// The timescale has a few fixed zooms (day … quarter), so a pinch moves it in steps:
// spreading two fingers by the step ratio moves one step in (more detail), pinching
// them together by the same ratio moves one step out.

// How much the finger distance has to change for one zoom step.
export const PINCH_RATIO = 1.5;

// Signed steps for a pinch: positive when the fingers spread (zoom in), negative when they pinch (zoom out).
export function pinchStep(startDist: number, dist: number): number {
  if (startDist <= 0 || dist <= 0) return 0;
  return Math.round(Math.log(dist / startDist) / Math.log(PINCH_RATIO));
}

// The zoom index after a pinch: index 0 is the closest zoom, so a positive step lowers the index.
export function pinchZoomIndex(startIndex: number, startDist: number, dist: number, count: number): number {
  const i = startIndex - pinchStep(startDist, dist);
  return Math.max(0, Math.min(count - 1, i));
}
