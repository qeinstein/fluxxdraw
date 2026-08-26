import { describe, it, expect } from 'vitest';
import {
  bestConnectionSide,
  oppositeSide,
  sideToFixedPoint,
  fixedPointToScene,
  generateStraightRoute,
  generateCurvedRoute,
  generateElbowRoute,
  generateRoute,
  rerouteArrow
} from '../../src/elements/arrowRouting';
import type { ExcaliElement, LinearElement } from '../../src/types';

describe('Arrow Routing', () => {
  describe('bestConnectionSide', () => {
    it('selects left/right for horizontally dominant distances', () => {
      expect(bestConnectionSide([0, 0], [100, 10])).toBe('right');
      expect(bestConnectionSide([100, 0], [0, 10])).toBe('left');
    });

    it('selects top/bottom for vertically dominant distances', () => {
      expect(bestConnectionSide([0, 0], [10, 100])).toBe('bottom');
      expect(bestConnectionSide([0, 100], [10, 0])).toBe('top');
    });
  });

  describe('oppositeSide', () => {
    it('returns the opposite side', () => {
      expect(oppositeSide('top')).toBe('bottom');
      expect(oppositeSide('bottom')).toBe('top');
      expect(oppositeSide('left')).toBe('right');
      expect(oppositeSide('right')).toBe('left');
    });
  });

  describe('sideToFixedPoint', () => {
    it('returns proportional fixed points', () => {
      expect(sideToFixedPoint('top')).toEqual([0.5, 0]);
      expect(sideToFixedPoint('bottom')).toEqual([0.5, 1]);
      expect(sideToFixedPoint('left')).toEqual([0, 0.5]);
      expect(sideToFixedPoint('right')).toEqual([1, 0.5]);
    });
  });

  describe('fixedPointToScene', () => {
    it('converts fixed point to scene coordinates', () => {
      const shape = { x: 10, y: 10, width: 100, height: 100, angle: 0 } as ExcaliElement;
      expect(fixedPointToScene(shape, [0, 0])).toEqual([10, 10]); // top-left
      expect(fixedPointToScene(shape, [0.5, 0.5])).toEqual([60, 60]); // center
      expect(fixedPointToScene(shape, [1, 1])).toEqual([110, 110]); // bottom-right
    });
  });

  describe('generateStraightRoute', () => {
    it('returns start and end', () => {
      expect(generateStraightRoute([0, 0], [100, 100])).toEqual([[0, 0], [100, 100]]);
    });
  });

  describe('generateCurvedRoute', () => {
    it('adds two control points', () => {
      const route = generateCurvedRoute([0, 0], [100, 0], 'right', 'left');
      expect(route.length).toBe(4);
      expect(route[0]).toEqual([0, 0]);
      expect(route[3]).toEqual([100, 0]);
      // control points should be pushed along the departure/arrival tangent (which is [1,0] and [-1,0])
      expect(route[1][0]).toBeGreaterThan(0);
      expect(route[1][1]).toBe(0);
      expect(route[2][0]).toBeLessThan(100);
      expect(route[2][1]).toBe(0);
    });
  });

  describe('generateElbowRoute', () => {
    it('generates Z shape for opposite sides (horizontal)', () => {
      const route = generateElbowRoute([0, 0], [100, 50], 'right', 'left');
      expect(route.length).toBe(4);
      expect(route[0]).toEqual([0, 0]);
      expect(route[1]).toEqual([50, 0]);
      expect(route[2]).toEqual([50, 50]);
      expect(route[3]).toEqual([100, 50]);
    });

    it('generates Z shape for opposite sides (vertical)', () => {
      const route = generateElbowRoute([0, 0], [50, 100], 'bottom', 'top');
      expect(route.length).toBe(4);
      expect(route[1]).toEqual([0, 50]);
      expect(route[2]).toEqual([50, 50]);
    });

    it('generates U shape for same side (right)', () => {
      const route = generateElbowRoute([0, 0], [0, 100], 'right', 'right');
      expect(route.length).toBe(4);
      expect(route[1][0]).toBeGreaterThan(0);
      expect(route[1][1]).toBe(0);
      expect(route[2][0]).toBe(route[1][0]);
      expect(route[2][1]).toBe(100);
    });

    it('generates L shape for adjacent sides', () => {
      const route = generateElbowRoute([0, 0], [100, 100], 'right', 'top');
      expect(route.length).toBe(3);
      expect(route[1]).toEqual([100, 0]);
    });
  });

  describe('generateRoute', () => {
    it('dispatches to correct generator', () => {
      const straight = generateRoute('straight', [0, 0], [100, 100], null, null);
      expect(straight.length).toBe(2);
      
      const curved = generateRoute('curved', [0, 0], [100, 100], null, null);
      expect(curved.length).toBe(4);
      
      const elbow = generateRoute('elbow', [0, 0], [100, 100], null, null);
      expect(elbow.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('rerouteArrow', () => {
    it('returns null if no bindings', () => {
      const arrow = { points: [[0, 0], [10, 10]] } as LinearElement;
      expect(rerouteArrow(arrow, new Map())).toBeNull();
    });

    it('reroutes a 2-point bound curved arrow', () => {
      const arrow = {
        type: 'arrow', x: 0, y: 0, points: [[0, 0], [100, 0]], pathType: 'curved',
        startBinding: { elementId: '1', focus: 0, gap: 0 },
        endBinding: { elementId: '2', focus: 0, gap: 0 }
      } as LinearElement;
      
      const e1 = { id: '1', type: 'rectangle', x: -50, y: -50, width: 100, height: 100, angle: 0, isDeleted: false } as ExcaliElement;
      const e2 = { id: '2', type: 'rectangle', x: 150, y: -50, width: 100, height: 100, angle: 0, isDeleted: false } as ExcaliElement;
      
      const map = new Map([['1', e1], ['2', e2]]);
      
      const route = rerouteArrow(arrow, map);
      expect(route).toBeDefined();
      expect(route!.length).toBe(4); // curved route
      // endpoints should intersect the shape outlines
      expect(route![0]).toEqual([50, 0]); // right edge of e1 (center is 0,0, right edge is 50,0)
      expect(route![3]).toEqual([150, 0]); // left edge of e2 (center is 200,0, left edge is 150,0)
    });
  });
});
