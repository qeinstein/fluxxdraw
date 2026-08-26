import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { store } from '../../src/store';
import { applySpecToScene } from '../../src/dsl/apply';
import type { DiagramSpec } from '../../src/dsl/spec';
import type { LinearElement, TextElement } from '../../src/types';

describe('DSL apply', () => {
  beforeEach(() => {
    store.bindYdoc(new Y.Doc());
    store.resetScene();
  });

  it('creates new elements from spec and layouts', () => {
    const spec: DiagramSpec = {
      nodes: [
        { key: 'a', label: 'Node A', shape: 'rectangle' },
        { key: 'b', label: 'Node B', shape: 'ellipse' }
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'arrow', label: 'connects' }
      ]
    };
    
    const result = applySpecToScene(spec);
    
    expect(result.created).toBe(3); // 2 nodes, 1 edge
    expect(result.updated).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.laidOut).toBe(true);

    const elements = store.visibleElements;
    // 2 shapes, 2 text labels for shapes, 1 arrow, 1 text label for arrow
    expect(elements.length).toBe(6); 
    
    const arrow = elements.find(e => e.type === 'arrow') as LinearElement;
    expect(arrow).toBeDefined();
    expect(arrow.startBinding).toBeDefined();
    expect(arrow.endBinding).toBeDefined();
  });

  it('updates existing elements from spec', () => {
    const spec: DiagramSpec = {
      nodes: [
        { key: 'a', label: 'Node A', shape: 'rectangle' },
        { key: 'b', label: 'Node B', shape: 'ellipse' }
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'arrow', label: 'connects' }
      ]
    };
    applySpecToScene(spec);
    
    const updatedSpec: DiagramSpec = {
      nodes: [
        { key: 'a', label: 'Node A Changed', shape: 'diamond' },
        { key: 'b', label: 'Node B', shape: 'ellipse', fill: 'red' }
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'dashed', label: 'changed label', route: 'straight' }
      ]
    };

    const result = applySpecToScene(updatedSpec);
    expect(result.created).toBe(0);
    expect(result.updated).toBe(3); // 2 nodes, 1 edge
    expect(result.removed).toBe(0);
    
    const nodeA = store.visibleElements.find(e => e.dslKey === 'a');
    expect(nodeA?.type).toBe('diamond');
    
    const nodeB = store.visibleElements.find(e => e.dslKey === 'b');
    expect(nodeB?.backgroundColor).toBe('#ffc9c9');
    
    const arrow = store.visibleElements.find(e => e.type === 'arrow' || e.type === 'line') as LinearElement;
    expect(arrow.strokeStyle).toBe('dashed');
    expect(arrow.pathType).toBe('straight');
    
    const arrowText = store.getElement(arrow.boundText!) as TextElement;
    expect(arrowText.text).toBe('changed label');
  });

  it('removes elements not in spec', () => {
    const spec: DiagramSpec = {
      nodes: [
        { key: 'a', label: 'Node A', shape: 'rectangle' },
        { key: 'b', label: 'Node B', shape: 'ellipse' }
      ],
      edges: [
        { from: 'a', to: 'b', kind: 'arrow' }
      ]
    };
    applySpecToScene(spec);
    
    const shrinkSpec: DiagramSpec = {
      nodes: [
        { key: 'a', label: 'Node A', shape: 'rectangle' }
      ],
      edges: []
    };
    
    const result = applySpecToScene(shrinkSpec);
    
    expect(result.removed).toBeGreaterThan(0);
    
    // Only node A and its text label should remain
    expect(store.visibleElements.length).toBe(2); 
    expect(store.visibleElements.some(e => e.dslKey === 'a')).toBe(true);
    expect(store.visibleElements.some(e => e.dslKey === 'b')).toBe(false);
  });
  
  it('handles label removal', () => {
    const spec: DiagramSpec = {
      nodes: [
        { key: 'a', label: 'Node A', shape: 'rectangle' }
      ],
      edges: []
    };
    applySpecToScene(spec);
    
    const removeLabelSpec: DiagramSpec = {
      nodes: [
        { key: 'a', shape: 'rectangle', label: "" }
      ],
      edges: []
    };
    
    applySpecToScene(removeLabelSpec);
    const nodeA = store.visibleElements.find(e => e.dslKey === 'a');
    expect((nodeA as any)?.boundText).toBeNull();
  });
});
