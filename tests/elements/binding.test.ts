import { describe, it, expect } from 'vitest';
import { getBindableElementAt, intersectShapeEdge, boundEndpointPosition, getBoundArrowPoints, defaultBinding, isBindable } from '../../src/elements/binding';
import { newGenericElement } from '../../src/elements/factory';
import { store } from '../../src/store';
import type { ExcaliElement, LinearElement, Binding } from '../../src/types';

describe('Binding', () => {
  describe('isBindable', () => {
    it('returns true for bindable shapes', () => {
      expect(isBindable({ type: 'rectangle', isDeleted: false } as ExcaliElement)).toBe(true);
      expect(isBindable({ type: 'ellipse', isDeleted: false } as ExcaliElement)).toBe(true);
    });

    it('returns false for unbindable or deleted shapes', () => {
      expect(isBindable({ type: 'arrow', isDeleted: false } as ExcaliElement)).toBe(false);
      expect(isBindable({ type: 'rectangle', isDeleted: true } as ExcaliElement)).toBe(false);
    });
  });

  describe('getBindableElementAt', () => {
    it('returns element near pointer', () => {
      const el = newGenericElement('rectangle', store.appState, 0, 0);
      el.width = 100;
      el.height = 100;
      el.backgroundColor = 'red';
      el.fillStyle = 'solid';
      const found = getBindableElementAt([el], 50, 50);
      expect(found).toBe(el);
    });

    it('excludes specified id', () => {
      const el = newGenericElement('rectangle', store.appState, 0, 0);
      el.width = 100;
      el.height = 100;
      const found = getBindableElementAt([el], 50, 50, el.id);
      expect(found).toBeNull();
    });
  });

  describe('intersectShapeEdge', () => {
    it('computes edge intersection for rectangle', () => {
      const rect = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100, angle: 0 } as ExcaliElement;
      const pt = intersectShapeEdge(rect, 150, 50, 0);
      // center is 50,50. target 150,50 -> right edge is at 100,50.
      expect(pt).toEqual([100, 50]);
    });

    it('adds gap', () => {
      const rect = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100, angle: 0 } as ExcaliElement;
      const pt = intersectShapeEdge(rect, 150, 50, 10);
      expect(pt).toEqual([110, 50]);
    });
    
    it('computes edge intersection for ellipse', () => {
      const ellipse = { type: 'ellipse', x: 0, y: 0, width: 100, height: 100, angle: 0 } as ExcaliElement;
      const pt = intersectShapeEdge(ellipse, 150, 50, 0);
      expect(pt).toEqual([100, 50]);
    });
    
    it('computes edge intersection for diamond', () => {
      const diamond = { type: 'diamond', x: 0, y: 0, width: 100, height: 100, angle: 0 } as ExcaliElement;
      const pt = intersectShapeEdge(diamond, 150, 50, 0);
      expect(pt).toEqual([100, 50]);
    });
  });

  describe('boundEndpointPosition', () => {
    it('uses fixedPoint if available', () => {
      const binding: Binding = { elementId: '1', focus: 0, gap: 10, fixedPoint: [1, 0.5] };
      const rect = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100, angle: 0 } as ExcaliElement;
      const pt = boundEndpointPosition(binding, rect, [150, 50]);
      // fixed point is right middle (100, 50). gap is 10 along normal.
      expect(pt[0]).toBeCloseTo(110);
      expect(pt[1]).toBeCloseTo(50);
    });

    it('falls back to intersectShapeEdge if no fixedPoint', () => {
      const binding: Binding = { elementId: '1', focus: 0, gap: 10 };
      const rect = { type: 'rectangle', x: 0, y: 0, width: 100, height: 100, angle: 0 } as ExcaliElement;
      const pt = boundEndpointPosition(binding, rect, [150, 50]);
      expect(pt).toEqual([110, 50]);
    });
  });

  describe('getBoundArrowPoints', () => {
    it('returns null if no bindings', () => {
      const arrow = { points: [[0,0], [10,10]] } as LinearElement;
      expect(getBoundArrowPoints(arrow, new Map())).toBeNull();
    });

    it('updates points based on bindings', () => {
      const arrow = {
        x: 0, y: 0,
        points: [[0,0], [150,50]],
        startBinding: { elementId: '1', gap: 0, focus: 0 }
      } as LinearElement;
      const rect = { id: '1', type: 'rectangle', x: -100, y: 0, width: 100, height: 100, angle: 0, isDeleted: false } as ExcaliElement;
      const map = new Map([['1', rect]]);
      
      const newPoints = getBoundArrowPoints(arrow, map);
      expect(newPoints).toBeDefined();
      expect(newPoints![0]).toEqual([0, 50]); // Center -50,50 -> target 150,50 => edge is at 0,50
    });
  });

  describe('defaultBinding', () => {
    it('creates binding without fixedPoint if no shape/dropScene', () => {
      const b = defaultBinding('1');
      expect(b.elementId).toBe('1');
      expect(b.fixedPoint).toBeUndefined();
    });

    it('creates binding with fixedPoint if shape and dropScene provided', () => {
      const shape = { x: 0, y: 0, width: 100, height: 100 } as ExcaliElement;
      const b = defaultBinding('1', shape, [25, 75]);
      expect(b.fixedPoint).toEqual([0.25, 0.75]);
    });
  });
});
