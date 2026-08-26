import { describe, it, expect } from 'vitest';
import { hitTestElement, getElementAtPosition, isInFrameHeader } from '../../src/elements/hitTest';
import type { ExcaliElement, LinearElement, FreedrawElement } from '../../src/types';

describe('HitTest', () => {
  describe('hitTestElement', () => {
    it('hits filled rectangle inside', () => {
      const rect = {
        type: 'rectangle', x: 0, y: 0, width: 100, height: 100, angle: 0,
        backgroundColor: 'red'
      } as ExcaliElement;
      
      expect(hitTestElement(rect, 50, 50)).toBe(true);
      expect(hitTestElement(rect, 150, 150)).toBe(false);
    });

    it('hits unfilled rectangle only on outline', () => {
      const rect = {
        type: 'rectangle', x: 0, y: 0, width: 100, height: 100, angle: 0,
        backgroundColor: 'transparent'
      } as ExcaliElement;
      
      expect(hitTestElement(rect, 50, 50, 10)).toBe(false); // inside but transparent
      expect(hitTestElement(rect, 0, 50, 10)).toBe(true); // left edge
      expect(hitTestElement(rect, 50, 100, 10)).toBe(true); // bottom edge
    });

    it('hits filled ellipse inside', () => {
      const ellipse = {
        type: 'ellipse', x: 0, y: 0, width: 100, height: 100, angle: 0,
        backgroundColor: 'red'
      } as ExcaliElement;
      
      expect(hitTestElement(ellipse, 50, 50)).toBe(true); // center
    });

    it('hits unfilled ellipse on outline', () => {
      const ellipse = {
        type: 'ellipse', x: 0, y: 0, width: 100, height: 100, angle: 0,
        backgroundColor: 'transparent'
      } as ExcaliElement;
      
      expect(hitTestElement(ellipse, 50, 50)).toBe(false); // center
      expect(hitTestElement(ellipse, 50, 0)).toBe(true); // top edge
    });

    it('hits filled diamond inside', () => {
      const diamond = {
        type: 'diamond', x: 0, y: 0, width: 100, height: 100, angle: 0,
        backgroundColor: 'red'
      } as ExcaliElement;
      
      expect(hitTestElement(diamond, 50, 50)).toBe(true); // center
    });

    it('hits unfilled diamond on outline', () => {
      const diamond = {
        type: 'diamond', x: 0, y: 0, width: 100, height: 100, angle: 0,
        backgroundColor: 'transparent'
      } as ExcaliElement;
      
      expect(hitTestElement(diamond, 50, 50)).toBe(false); // center
      expect(hitTestElement(diamond, 25, 25)).toBe(true); // top-left edge
    });

    it('hits text inside bounds', () => {
      const text = {
        type: 'text', x: 0, y: 0, width: 100, height: 50, angle: 0
      } as ExcaliElement;
      
      expect(hitTestElement(text, 50, 25)).toBe(true);
      expect(hitTestElement(text, 150, 25)).toBe(false);
    });

    it('hits frame by header or outline', () => {
      const frame = {
        type: 'frame', x: 0, y: 0, width: 100, height: 100, angle: 0
      } as ExcaliElement;
      
      expect(hitTestElement(frame, 50, 50, 10)).toBe(false); // inside
      expect(hitTestElement(frame, 50, -10, 10)).toBe(true); // header
      expect(hitTestElement(frame, 0, 50, 10)).toBe(true); // outline
    });

    it('hits straight arrow on segment', () => {
      const arrow = {
        type: 'arrow', x: 0, y: 0, width: 100, height: 100, angle: 0,
        points: [[0, 0], [100, 100]],
        pathType: 'straight'
      } as LinearElement;
      
      expect(hitTestElement(arrow, 50, 50, 10)).toBe(true);
      expect(hitTestElement(arrow, 150, 50, 10)).toBe(false);
    });
    
    it('hits elbowed arrow on orthogonal path', () => {
      const arrow = {
        type: 'arrow', x: 0, y: 0, width: 100, height: 100, angle: 0,
        points: [[0, 0], [100, 100]],
        pathType: 'elbow'
      } as LinearElement;
      
      // route is [0,0] -> [100,0] -> [100,100]
      expect(hitTestElement(arrow, 50, 0, 10)).toBe(true); // on horizontal segment
      expect(hitTestElement(arrow, 50, 50, 10)).toBe(false); // not on the straight path
    });

    it('hits freedraw stroke near points', () => {
      const freedraw = {
        type: 'freedraw', x: 0, y: 0, width: 100, height: 100, angle: 0,
        points: [[0, 0], [10, 10]],
        strokeWidth: 2
      } as FreedrawElement;
      
      expect(hitTestElement(freedraw, 0, 0, 10)).toBe(true);
      expect(hitTestElement(freedraw, 5, 5, 2)).toBe(false); // middle of gap
    });
  });

  describe('getElementAtPosition', () => {
    it('returns topmost element', () => {
      const e1 = { type: 'rectangle', id: '1', x: 0, y: 0, width: 100, height: 100, backgroundColor: 'red', angle: 0, isDeleted: false, locked: false } as ExcaliElement;
      const e2 = { type: 'rectangle', id: '2', x: 0, y: 0, width: 100, height: 100, backgroundColor: 'blue', angle: 0, isDeleted: false, locked: false } as ExcaliElement;
      
      const found = getElementAtPosition([e1, e2], 50, 50);
      expect(found?.id).toBe('2');
    });

    it('ignores deleted and locked elements', () => {
      const e1 = { type: 'rectangle', id: '1', x: 0, y: 0, width: 100, height: 100, backgroundColor: 'red', angle: 0, isDeleted: false, locked: true } as ExcaliElement;
      const e2 = { type: 'rectangle', id: '2', x: 0, y: 0, width: 100, height: 100, backgroundColor: 'blue', angle: 0, isDeleted: true, locked: false } as ExcaliElement;
      
      const found = getElementAtPosition([e1, e2], 50, 50);
      expect(found).toBeNull();
    });
  });

  describe('isInFrameHeader', () => {
    it('detects point in header', () => {
      const frame = { x: 0, y: 0, width: 100, height: 100, angle: 0 } as ExcaliElement;
      expect(isInFrameHeader(frame, 50, -10)).toBe(true);
      expect(isInFrameHeader(frame, 50, 10)).toBe(false); // inside body
      expect(isInFrameHeader(frame, 50, -30)).toBe(false); // above header
    });
  });
});
