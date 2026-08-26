import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { store } from '../../src/store';
import { slugify, specFromScene, specToText } from '../../src/dsl/fromScene';
import type { ExcaliElement, LinearElement, TextElement } from '../../src/types';
import type { DiagramSpec } from '../../src/dsl/spec';

describe('DSL fromScene', () => {
  beforeEach(() => {
    store.bindYdoc(new Y.Doc());
    store.resetScene();
  });

  describe('slugify', () => {
    it('converts to lowercase and replaces non-alphanumeric with underscore', () => {
      expect(slugify('API Gateway!', 'node')).toBe('api_gateway');
    });

    it('strips leading and trailing underscores', () => {
      expect(slugify('__Hello__', 'node')).toBe('hello');
    });

    it('prefixes with n if starts with a digit', () => {
      expect(slugify('123 Node', 'node')).toBe('n123_node');
    });

    it('returns fallback if result is empty', () => {
      expect(slugify('!@#', 'fallback')).toBe('fallback');
    });
  });

  describe('specFromScene', () => {
    it('returns empty spec for empty scene', () => {
      const result = specFromScene();
      expect(result.spec.nodes).toEqual([]);
      expect(result.spec.edges).toEqual([]);
      expect(result.untranslatable).toBe(0);
    });

    it('extracts shapes with labels', () => {
      const text: TextElement = { id: 't1', type: 'text', text: 'My Node', containerId: 'rect1' } as TextElement;
      const rect: ExcaliElement = {
        id: 'rect1',
        type: 'rectangle',
        boundText: 't1',
        backgroundColor: 'transparent',
      } as ExcaliElement;

      store.mutate(() => {
        store.addElements(rect, text);
      });

      const result = specFromScene();
      expect(result.spec.nodes).toEqual([
        { key: 'my_node', label: 'My Node', shape: 'rectangle', fill: undefined }
      ]);
    });

    it('extracts edges with labels', () => {
      const rect1: ExcaliElement = { id: 'r1', type: 'rectangle', dslKey: 'a' } as ExcaliElement;
      const rect2: ExcaliElement = { id: 'r2', type: 'rectangle', dslKey: 'b' } as ExcaliElement;
      const text: TextElement = { id: 't1', type: 'text', text: 'calls', containerId: 'arrow1' } as TextElement;
      const arrow: LinearElement = {
        id: 'arrow1',
        type: 'arrow',
        startBinding: { elementId: 'r1' },
        endBinding: { elementId: 'r2' },
        boundText: 't1',
        strokeStyle: 'solid',
        pathType: 'curved'
      } as unknown as LinearElement;

      store.mutate(() => {
        store.addElements(rect1, rect2, arrow, text);
      });

      const result = specFromScene();
      expect(result.spec.edges).toEqual([
        { from: 'a', to: 'b', kind: 'arrow', label: 'calls', route: 'curved' }
      ]);
    });

    it('identifies untranslatable elements', () => {
      const freedraw = { id: 'f1', type: 'freedraw' } as ExcaliElement;
      const standaloneText = { id: 't2', type: 'text', text: 'Notes' } as TextElement;
      
      store.mutate(() => {
        store.addElements(freedraw, standaloneText);
      });

      const result = specFromScene();
      expect(result.untranslatable).toBe(2);
    });

    it('handles duplicate slugs', () => {
      const rect1: ExcaliElement = { id: 'r1', type: 'rectangle', boundText: 't1' } as ExcaliElement;
      const rect2: ExcaliElement = { id: 'r2', type: 'rectangle', boundText: 't2' } as ExcaliElement;
      const text1: TextElement = { id: 't1', type: 'text', text: 'Same', containerId: 'r1' } as TextElement;
      const text2: TextElement = { id: 't2', type: 'text', text: 'Same', containerId: 'r2' } as TextElement;

      store.mutate(() => {
        store.addElements(rect1, rect2, text1, text2);
      });

      const result = specFromScene();
      expect(result.spec.nodes.map(n => n.key)).toEqual(['same', 'same_2']);
    });
  });

  describe('specToText', () => {
    it('renders nodes and edges', () => {
      const spec: DiagramSpec = {
        nodes: [
          { key: 'api', label: 'API Gateway', shape: 'rectangle' },
          { key: 'db', label: 'DB', shape: 'ellipse', fill: 'blue' }
        ],
        edges: [
          { from: 'api', to: 'db', kind: 'arrow', label: 'queries' }
        ]
      };
      const text = specToText(spec);
      expect(text).toEqual('api: API Gateway\ndb: DB [ellipse] {blue}\n\napi -> db: queries');
    });

    it('renders edges with routing', () => {
      const spec: DiagramSpec = {
        nodes: [],
        edges: [
          { from: 'a', to: 'b', kind: 'dashed', route: 'straight' }
        ]
      };
      const text = specToText(spec);
      expect(text).toEqual('a --> b (straight)');
    });
  });
});
