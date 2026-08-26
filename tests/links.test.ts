import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as Y from 'yjs';
import { store } from '../src/store';
import {
  elementLink,
  parseElementLink,
  linkedElementFromUrl,
  normaliseLink,
  setElementLink,
  linkBadgeBox,
  hitLinkBadge,
} from '../src/links';
import type { ExcaliElement } from '../src/types';

describe('links', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    store.bindYdoc(new Y.Doc());
    store.resetScene();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('elementLink', () => {
    it('constructs an internal element link', () => {
      const link = elementLink('123');
      expect(link).toContain('#element=123');
    });
  });

  describe('parseElementLink', () => {
    it('returns null for empty values', () => {
      expect(parseElementLink(null)).toBeNull();
      expect(parseElementLink(undefined)).toBeNull();
      expect(parseElementLink('')).toBeNull();
    });

    it('returns null if fragment not present', () => {
      expect(parseElementLink('https://example.com')).toBeNull();
    });

    it('extracts id from internal link', () => {
      expect(parseElementLink('http://localhost/#element=abc')).toBe('abc');
    });

    it('stops at other parameters', () => {
      expect(parseElementLink('http://localhost/#element=abc&zoom=1')).toBe('abc');
      expect(parseElementLink('http://localhost/#element=abc/def')).toBe('abc');
    });
  });

  describe('linkedElementFromUrl', () => {
    it('extracts id from window.location.hash', () => {
      Object.defineProperty(window, 'location', {
        value: { hash: '#element=123' },
        configurable: true,
      });
      expect(linkedElementFromUrl()).toBe('123');
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        configurable: true,
      });
    });
  });

  describe('normaliseLink', () => {
    it('returns null for empty strings', () => {
      expect(normaliseLink('   ')).toBeNull();
    });

    it('preserves internal links', () => {
      expect(normaliseLink('http://example.com/#element=123')).toBe('http://example.com/#element=123');
    });

    it('adds https to domain names', () => {
      expect(normaliseLink('google.com')).toBe('https://google.com/');
    });

    it('returns null for invalid domains', () => {
      expect(normaliseLink('notadomain')).toBeNull();
    });

    it('keeps mailto links', () => {
      expect(normaliseLink('mailto:test@example.com')).toBe('mailto:test@example.com');
    });
  });

  describe('setElementLink', () => {
    it('sets link on elements', () => {
      const el = { id: 'el1', type: 'rectangle' } as unknown as ExcaliElement;
      store.mutate(() => {
        store.addElements(el);
      });
      
      setElementLink(['el1'], 'https://example.com');
      expect(store.getElement('el1')?.link).toBe('https://example.com');
      
      setElementLink(['el1'], null);
      expect(store.getElement('el1')?.link).toBeNull();
    });
  });

  describe('linkBadgeBox', () => {
    it('calculates badge position', () => {
      const el = { x: 10, y: 20, width: 100, height: 50 } as unknown as ExcaliElement;
      const box = linkBadgeBox(el, 1);
      
      // left + width - size -> 10 + 100 - 20 = 90
      // top - size - gap -> 20 - 20 - 8 = -8
      expect(box).toEqual({ x: 90, y: -8, size: 20 });
    });
    
    it('handles negative width/height elements', () => {
      const el = { x: 110, y: 70, width: -100, height: -50 } as unknown as ExcaliElement;
      const box = linkBadgeBox(el, 1);
      // left = min(110, 10) = 10, top = min(70, 20) = 20
      // width = 100, size = 20, gap = 8
      // left + width - size = 10 + 100 - 20 = 90
      // top - size - gap = 20 - 20 - 8 = -8
      expect(box).toEqual({ x: 90, y: -8, size: 20 });
    });
  });

  describe('hitLinkBadge', () => {
    it('returns null if no elements have links', () => {
      const el = { id: 'el1', x: 0, y: 0, width: 100, height: 100 } as unknown as ExcaliElement;
      store.mutate(() => {
        store.addElements(el);
      });
      const visibleIds = new Set(['el1']);
      expect(hitLinkBadge(80, -28, 1, visibleIds)).toBeNull();
    });

    it('returns null if element is not in visibleIds', () => {
      const el = { id: 'el1', link: 'http://a.com', x: 0, y: 0, width: 100, height: 100 } as unknown as ExcaliElement;
      store.mutate(() => {
        store.addElements(el);
      });
      const visibleIds = new Set<string>();
      expect(hitLinkBadge(80, -28, 1, visibleIds)).toBeNull();
    });

    it('returns element if badge is hit', () => {
      const el = { id: 'el1', link: 'http://a.com', x: 0, y: 0, width: 100, height: 100 } as unknown as ExcaliElement;
      store.mutate(() => {
        store.addElements(el);
      });
      const visibleIds = new Set(['el1']);
      
      const box = linkBadgeBox(el, 1); // x: 80, y: -28
      expect(hitLinkBadge(box.x + 10, box.y + 10, 1, visibleIds)).toBe(el);
    });
    
    it('handles rotated elements', () => {
      const el = { id: 'el1', link: 'http://a.com', x: 0, y: 0, width: 100, height: 100, angle: Math.PI } as unknown as ExcaliElement;
      store.mutate(() => {
        store.addElements(el);
      });
      const visibleIds = new Set(['el1']);
      
      // the box is still {x: 80, y: -28} in local space
      // center is 50, 50. In rotated space by 180 degrees, the badge is at 50 - 30 = 20, 50 - (-78) = 128
      // But we just hit it by calculating roughly where it should be after rotation.
      // Easiest test: hit the exact transformed point
      const x = 50 + (50 - 80);
      const y = 50 + (50 - (-28));
      
      expect(hitLinkBadge(x - 10, y - 10, 1, visibleIds)).toBe(el);
    });
  });
});
