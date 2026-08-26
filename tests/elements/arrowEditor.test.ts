import { describe, it, expect } from 'vitest';
import {
  getArrowHandles,
  hitTestArrowHandle,
  getHitSegmentIndex,
  addControlPoint,
  deleteControlPoint,
  resetRoute
} from '../../src/elements/arrowEditor';
import type { LinearElement } from '../../src/types';

describe('Arrow Editor', () => {
  describe('getArrowHandles', () => {
    it('returns handles for a 2-point arrow', () => {
      const arrow = { x: 0, y: 0, points: [[0, 0], [100, 100]] } as LinearElement;
      const handles = getArrowHandles(arrow, 1);
      
      expect(handles.length).toBe(3); // 2 endpoints + 1 add handle
      expect(handles[0].type).toBe('endpoint');
      expect(handles[1].type).toBe('endpoint');
      expect(handles[2].type).toBe('add');
      
      expect(handles[0].x).toBe(0);
      expect(handles[1].x).toBe(100);
      expect(handles[2].x).toBe(50); // midpoint
    });

    it('returns handles for a multi-point arrow', () => {
      const arrow = { x: 0, y: 0, points: [[0, 0], [50, 0], [100, 100]] } as LinearElement;
      const handles = getArrowHandles(arrow, 1);
      
      expect(handles.length).toBe(3); // 2 endpoints + 1 midpoint, no add handle
      expect(handles[0].type).toBe('endpoint');
      expect(handles[1].type).toBe('midpoint');
      expect(handles[2].type).toBe('endpoint');
    });
  });

  describe('hitTestArrowHandle', () => {
    it('finds clicked handle', () => {
      const arrow = { x: 0, y: 0, points: [[0, 0], [100, 100]] } as LinearElement;
      const handles = getArrowHandles(arrow, 1);
      
      const hit = hitTestArrowHandle(handles, 0, 0, 1);
      expect(hit?.type).toBe('endpoint');
      
      const hitAdd = hitTestArrowHandle(handles, 50, 50, 1);
      expect(hitAdd?.type).toBe('add');
      
      const miss = hitTestArrowHandle(handles, 20, 20, 1);
      expect(miss).toBeNull();
    });
  });

  describe('getHitSegmentIndex', () => {
    it('finds clicked segment', () => {
      const arrow = { x: 0, y: 0, points: [[0, 0], [50, 0], [100, 100]] } as LinearElement;
      
      expect(getHitSegmentIndex(arrow, 25, 0, 1)).toBe(0);
      expect(getHitSegmentIndex(arrow, 75, 50, 1)).toBe(1);
      expect(getHitSegmentIndex(arrow, 0, 100, 1)).toBeNull();
    });
  });

  describe('addControlPoint', () => {
    it('inserts point after index', () => {
      const arrow = { x: 0, y: 0, points: [[0, 0], [100, 100]] } as LinearElement;
      const points = addControlPoint(arrow, 0, 50, 50);
      
      expect(points.length).toBe(3);
      expect(points[1]).toEqual([50, 50]);
    });
  });

  describe('deleteControlPoint', () => {
    it('removes midpoint', () => {
      const arrow = { x: 0, y: 0, points: [[0, 0], [50, 50], [100, 100]] } as LinearElement;
      const points = deleteControlPoint(arrow, 1);
      
      expect(points?.length).toBe(2);
      expect(points![1]).toEqual([100, 100]);
    });

    it('returns null if trying to delete endpoints or <3 points', () => {
      const arrow = { x: 0, y: 0, points: [[0, 0], [100, 100]] } as LinearElement;
      expect(deleteControlPoint(arrow, 0)).toBeNull();
      
      const arrow3 = { x: 0, y: 0, points: [[0, 0], [50, 50], [100, 100]] } as LinearElement;
      expect(deleteControlPoint(arrow3, 0)).toBeNull();
      expect(deleteControlPoint(arrow3, 2)).toBeNull();
    });
  });

  describe('resetRoute', () => {
    it('returns points for straight arrow if no bindings', () => {
      const arrow = { x: 0, y: 0, points: [[0, 0], [50, 50], [100, 100]], pathType: 'straight' } as LinearElement;
      const points = resetRoute(arrow, new Map());
      expect(points?.length).toBe(2); // Should remove midpoint
    });
  });
});
