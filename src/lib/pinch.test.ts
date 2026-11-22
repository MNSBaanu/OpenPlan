import { describe, it, expect } from 'vitest';
import { pinchStep, pinchZoomIndex } from './pinch';

describe('pinchStep', () => {
  it('is zero when the fingers have not moved', () => {
    expect(pinchStep(100, 100)).toBe(0);
  });
  it('counts one step per 1.5x of spread', () => {
    expect(pinchStep(100, 160)).toBe(1);      // just over one step rounds to one
    expect(pinchStep(100, 225)).toBe(2);      // 1.5 x 1.5
    expect(pinchStep(100, 66)).toBe(-1);      // pinching by the same ratio steps out once
    expect(pinchStep(100, 50)).toBe(-2);      // halving the distance is nearly two steps out
  });
  it('ignores impossible distances', () => {
    expect(pinchStep(0, 100)).toBe(0);
    expect(pinchStep(100, 0)).toBe(0);
    expect(pinchStep(-10, 50)).toBe(0);
  });
});

describe('pinchZoomIndex', () => {
  it('moves toward index 0 (closest zoom) when fingers spread', () => {
    expect(pinchZoomIndex(1, 100, 200, 4)).toBe(0);
  });
  it('moves toward the far zoom when fingers pinch', () => {
    expect(pinchZoomIndex(1, 200, 132, 4)).toBe(2);
    expect(pinchZoomIndex(1, 200, 100, 4)).toBe(3);
  });
  it('stays inside the zoom list', () => {
    expect(pinchZoomIndex(0, 50, 500, 4)).toBe(0);
    expect(pinchZoomIndex(3, 500, 50, 4)).toBe(3);
  });
  it('is continuous while the fingers move', () => {
    expect(pinchZoomIndex(1, 100, 110, 4)).toBe(1);   // below half a step: no jump
    expect(pinchZoomIndex(1, 100, 130, 4)).toBe(0);   // over the half-step boundary: one step in
    expect(pinchZoomIndex(1, 100, 90, 4)).toBe(1);    // small pinch, no jump either
    expect(pinchZoomIndex(1, 100, 60, 4)).toBe(2);    // 100/60 = 1.67: one step out
  });
});
