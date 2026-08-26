import { describe, it, expect } from 'vitest';
import { Timeline, diffElements, relativeTime } from '../../src/io/history';
import type { ExcaliElement } from '../../src/types';

describe('History', () => {
  describe('Timeline', () => {
    it('initializes empty', () => {
      const timeline = new Timeline();
      expect(timeline.length).toBe(0);
    });

    it('records keyframe on first record', () => {
      const timeline = new Timeline();
      const el = { id: '1', version: 1 } as ExcaliElement;
      timeline.record([el], 1000);
      
      expect(timeline.length).toBe(1);
      expect(timeline.checkpoints[0].keyframe).toEqual([el]);
      expect(timeline.checkpoints[0].changed).toBeUndefined();
    });

    it('records delta on subsequent records', () => {
      const timeline = new Timeline();
      const el1 = { id: '1', version: 1 } as ExcaliElement;
      timeline.record([el1], 1000);
      
      const el2 = { id: '2', version: 1 } as ExcaliElement;
      timeline.record([el1, el2], 6000); // Beyond COALESCE_MS
      
      expect(timeline.length).toBe(2);
      expect(timeline.checkpoints[1].changed).toEqual([el2]);
      expect(timeline.checkpoints[1].keyframe).toBeUndefined();
    });

    it('coalesces edits within COALESCE_MS', () => {
      const timeline = new Timeline();
      const el1 = { id: '1', version: 1 } as ExcaliElement;
      timeline.record([el1], 1000);
      
      const el1v2 = { id: '1', version: 2 } as ExcaliElement;
      timeline.record([el1v2], 6000); // New checkpoint
      
      const el1v3 = { id: '1', version: 3 } as ExcaliElement;
      timeline.record([el1v3], 7000); // Should coalesce into the second one
      
      expect(timeline.length).toBe(2);
      expect(timeline.checkpoints[1].changed).toEqual([el1v3]);
    });

    it('does not coalesce if label is set', () => {
      const timeline = new Timeline();
      const el1 = { id: '1', version: 1 } as ExcaliElement;
      timeline.record([el1], 1000);
      
      const el1v2 = { id: '1', version: 2 } as ExcaliElement;
      timeline.record([el1v2], 6000, "labeled");
      
      const el1v3 = { id: '1', version: 3 } as ExcaliElement;
      timeline.record([el1v3], 7000);
      
      expect(timeline.length).toBe(3); // Did not coalesce because previous had a label
    });

    it('reconstructs state accurately', () => {
      const timeline = new Timeline();
      const el1 = { id: '1', version: 1 } as ExcaliElement;
      timeline.record([el1], 1000);
      
      const el2 = { id: '2', version: 1 } as ExcaliElement;
      timeline.record([el1, el2], 6000);
      
      const el1v2 = { id: '1', version: 2 } as ExcaliElement;
      timeline.record([el1v2], 12000); // remove el2, update el1
      
      const state0 = timeline.reconstruct(0);
      expect(state0).toEqual([el1]);
      
      const state1 = timeline.reconstruct(1);
      expect(state1).toEqual([el1, el2]);
      
      const state2 = timeline.reconstruct(2);
      expect(state2).toEqual([el1v2]); // el2 should be gone, el1 updated
    });
  });

  describe('diffElements', () => {
    it('computes added, changed, and removed', () => {
      const before: ExcaliElement[] = [
        { id: '1', version: 1 } as ExcaliElement,
        { id: '2', version: 1 } as ExcaliElement
      ];
      const after: ExcaliElement[] = [
        { id: '2', version: 2 } as ExcaliElement, // changed
        { id: '3', version: 1 } as ExcaliElement  // added
      ];
      
      const diff = diffElements(before, after);
      expect(diff.added).toEqual(['3']);
      expect(diff.changed).toEqual(['2']);
      expect(diff.removed).toEqual(['1']);
    });
  });

  describe('relativeTime', () => {
    it('returns "just now" for < 45 seconds', () => {
      expect(relativeTime(1000, 2000)).toBe('just now');
      expect(relativeTime(1000, 45000)).toBe('just now');
    });

    it('returns minutes for < 60 mins', () => {
      expect(relativeTime(0, 60000 * 5)).toBe('5 min ago');
    });

    it('returns hours for < 24 hours', () => {
      expect(relativeTime(0, 3600000 * 3)).toBe('3 hours ago');
    });

    it('returns days for < 30 days', () => {
      expect(relativeTime(0, 3600000 * 24 * 2)).toBe('2 days ago');
    });

    it('returns months for >= 30 days', () => {
      expect(relativeTime(0, 3600000 * 24 * 31)).toBe('1 month ago');
    });
  });
});
