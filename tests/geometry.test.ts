import { describe, it, expect } from 'vitest';
import {
  rotate,
  hasPoints,
  getElementBounds,
  getElementCenter,
  getRotatedBounds,
  getLinearMidpoint,
  getCommonBounds,
  distance,
  distanceToSegment,
  boundsOverlap,
  boundsContain,
  toLocalSpace,
} from '../src/geometry';
import type { ExcaliElement, LinearElement } from '../src/types';

describe('geometry', () => {
  describe('rotate', () => {
    it('rotates a point around a center', () => {
      const [x, y] = rotate(10, 10, 0, 0, Math.PI / 2);
      expect(x).toBeCloseTo(-10);
      expect(y).toBeCloseTo(10);
    });

    it('does nothing when angle is 0', () => {
      const [x, y] = rotate(10, 10, 0, 0, 0);
      expect(x).toBeCloseTo(10);
      expect(y).toBeCloseTo(10);
    });
  });

  describe('hasPoints', () => {
    it('returns true for line, arrow, and freedraw', () => {
      expect(hasPoints({ type: 'arrow' } as any)).toBe(true);
      expect(hasPoints({ type: 'line' } as any)).toBe(true);
      expect(hasPoints({ type: 'freedraw' } as any)).toBe(true);
    });

    it('returns false for other types', () => {
      expect(hasPoints({ type: 'rectangle' } as any)).toBe(false);
      expect(hasPoints({ type: 'ellipse' } as any)).toBe(false);
      expect(hasPoints({ type: 'text' } as any)).toBe(false);
    });
  });

  describe('getElementBounds', () => {
    it('calculates bounds for non-linear elements', () => {
      const el = { type: 'rectangle', x: 10, y: 10, width: 20, height: 30 } as ExcaliElement;
      expect(getElementBounds(el)).toEqual({ x1: 10, y1: 10, x2: 30, y2: 40 });
    });

    it('calculates bounds for negative width/height elements', () => {
      const el = { type: 'rectangle', x: 30, y: 40, width: -20, height: -30 } as ExcaliElement;
      expect(getElementBounds(el)).toEqual({ x1: 10, y1: 10, x2: 30, y2: 40 });
    });

    it('calculates bounds for linear elements with points', () => {
      const el = {
        type: 'arrow',
        x: 10,
        y: 10,
        points: [[0, 0], [10, 10], [-5, 5]],
      } as unknown as ExcaliElement;
      expect(getElementBounds(el)).toEqual({ x1: 5, y1: 10, x2: 20, y2: 20 });
    });

    it('calculates bounds for linear elements without points', () => {
      const el = {
        type: 'arrow',
        x: 10,
        y: 10,
        width: 20,
        height: 30,
        points: [],
      } as unknown as ExcaliElement;
      expect(getElementBounds(el)).toEqual({ x1: 10, y1: 10, x2: 30, y2: 40 });
    });
  });

  describe('getElementCenter', () => {
    it('calculates center of an element', () => {
      const el = { type: 'rectangle', x: 10, y: 10, width: 20, height: 30 } as ExcaliElement;
      expect(getElementCenter(el)).toEqual([20, 25]);
    });
  });

  describe('getRotatedBounds', () => {
    it('returns simple bounds when angle is 0', () => {
      const el = { type: 'rectangle', x: 10, y: 10, width: 20, height: 30, angle: 0 } as ExcaliElement;
      expect(getRotatedBounds(el)).toEqual({ x1: 10, y1: 10, x2: 30, y2: 40 });
    });

    it('calculates rotated bounds for angle != 0', () => {
      const el = { type: 'rectangle', x: 10, y: 10, width: 20, height: 20, angle: Math.PI / 4 } as ExcaliElement;
      const bounds = getRotatedBounds(el);
      expect(bounds.x1).toBeCloseTo(20 - Math.sqrt(200));
      expect(bounds.x2).toBeCloseTo(20 + Math.sqrt(200));
    });
  });

  describe('getLinearMidpoint', () => {
    it('returns point itself if no points', () => {
      const el = { x: 10, y: 10, points: [] } as unknown as LinearElement;
      expect(getLinearMidpoint(el)).toEqual([10, 10]);
    });

    it('returns point + first point if only one point', () => {
      const el = { x: 10, y: 10, points: [[5, 5]] } as unknown as LinearElement;
      expect(getLinearMidpoint(el)).toEqual([15, 15]);
    });

    it('returns exact midpoint for a straight line', () => {
      const el = { x: 10, y: 10, points: [[0, 0], [20, 0]] } as unknown as LinearElement;
      expect(getLinearMidpoint(el)).toEqual([20, 10]);
    });

    it('calculates midpoint across multiple segments', () => {
      const el = {
        x: 0,
        y: 0,
        points: [[0, 0], [10, 0], [10, 10], [0, 10]],
      } as unknown as LinearElement;
      // Total length = 10 + 10 + 10 = 30
      // Midpoint at length = 15
      // Crosses [10,0] to [10,10] at distance 5 -> [10, 5]
      expect(getLinearMidpoint(el)).toEqual([10, 5]);
    });
    
    it('handles zero segment length', () => {
       const el = {
        x: 0,
        y: 0,
        points: [[0, 0], [0, 0], [10, 0]],
      } as unknown as LinearElement;
      expect(getLinearMidpoint(el)).toEqual([5, 0]);
    });
  });

  describe('getCommonBounds', () => {
    it('returns zero bounds for empty list', () => {
      expect(getCommonBounds([])).toEqual({ x1: 0, y1: 0, x2: 0, y2: 0 });
    });

    it('returns bounds containing all elements', () => {
      const elements = [
        { type: 'rectangle', x: 10, y: 10, width: 10, height: 10, angle: 0 },
        { type: 'rectangle', x: 30, y: 30, width: 10, height: 10, angle: 0 },
      ] as ExcaliElement[];
      expect(getCommonBounds(elements)).toEqual({ x1: 10, y1: 10, x2: 40, y2: 40 });
    });
  });

  describe('distance', () => {
    it('calculates euclidean distance', () => {
      expect(distance(0, 0, 3, 4)).toBe(5);
    });
  });

  describe('distanceToSegment', () => {
    it('calculates distance to a segment', () => {
      expect(distanceToSegment(0, 5, 0, 0, 0, 10)).toBe(0);
      expect(distanceToSegment(5, 5, 0, 0, 0, 10)).toBe(5);
    });

    it('handles point beyond segment ends', () => {
      expect(distanceToSegment(0, 15, 0, 0, 0, 10)).toBe(5);
      expect(distanceToSegment(0, -5, 0, 0, 0, 10)).toBe(5);
    });

    it('handles zero length segment', () => {
      expect(distanceToSegment(3, 4, 0, 0, 0, 0)).toBe(5);
    });
  });

  describe('boundsOverlap', () => {
    it('returns true if bounds overlap', () => {
      const a: any = { x1: 0, y1: 0, x2: 10, y2: 10 };
      const b: any = { x1: 5, y1: 5, x2: 15, y2: 15 };
      expect(boundsOverlap(a, b)).toBe(true);
    });

    it('returns false if bounds do not overlap', () => {
      const a: any = { x1: 0, y1: 0, x2: 10, y2: 10 };
      const b: any = { x1: 15, y1: 15, x2: 25, y2: 25 };
      expect(boundsOverlap(a, b)).toBe(false);
    });
  });

  describe('boundsContain', () => {
    it('returns true if outer contains inner completely', () => {
      const outer: any = { x1: 0, y1: 0, x2: 10, y2: 10 };
      const inner: any = { x1: 2, y1: 2, x2: 8, y2: 8 };
      expect(boundsContain(outer, inner)).toBe(true);
    });

    it('returns false if inner is outside outer', () => {
      const outer: any = { x1: 0, y1: 0, x2: 10, y2: 10 };
      const inner: any = { x1: 5, y1: 5, x2: 15, y2: 15 };
      expect(boundsContain(outer, inner)).toBe(false);
    });
  });

  describe('toLocalSpace', () => {
    it('converts point to local space of an unrotated element', () => {
      const el = { type: 'rectangle', x: 10, y: 10, width: 20, height: 20, angle: 0 } as ExcaliElement;
      expect(toLocalSpace(el, 30, 30)).toEqual([30, 30]);
    });

    it('converts point to local space of a rotated element', () => {
      const el = { type: 'rectangle', x: 10, y: 10, width: 20, height: 20, angle: Math.PI / 2 } as ExcaliElement;
      // Center is [20, 20]
      // Point [30, 20] is rotated by -90 deg -> [20, 10]
      const [x, y] = toLocalSpace(el, 30, 20);
      expect(x).toBeCloseTo(20);
      expect(y).toBeCloseTo(10);
    });
  });
});
