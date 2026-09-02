import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { store } from '../../src/store';
import { applySpecToScene } from '../../src/dsl/apply';
import { specFromScene } from '../../src/dsl/fromScene';
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

  it('compiles rich scene declarations into editable canvas primitives', () => {
    const spec: DiagramSpec = {
      rich: true,
      layout: 'none',
      nodes: [
        { key: 'api', label: 'API Gateway', shape: 'rectangle', edges: 'round', x: 100, y: 120, width: 180, height: 90, fill: '#e8f1ff', strokeColor: '#2563eb', frame: 'backend' },
        { key: 'db', label: 'Postgres', shape: 'cylinder', x: 420, y: 120, width: 180, height: 90 },
      ],
      edges: [
        { from: 'api', to: 'db', kind: 'arrow', label: 'queries', route: 'elbow', startPort: 'east', endPort: 'west', endArrowhead: 'triangle', strokeStyle: 'dashed' },
      ],
      frames: [{ key: 'backend', label: 'Backend', x: 60, y: 60, width: 600, height: 240 }],
      texts: [{ key: 'title', text: 'Checkout', x: 100, y: 20, fontSize: 28, fontFamily: 'normal' }],
      paths: [{ key: 'accent', kind: 'line', points: [[0, 0], [30, 20], [60, 0]], x: 100, y: 330, strokeColor: '#ef4444', strokeWidth: 3 }],
    };

    const result = applySpecToScene(spec);
    expect(result.created).toBe(6); // 2 nodes, 1 edge, 1 frame, 1 text and 1 path; labels are children

    const elements = store.visibleElements;
    const api = elements.find((element) => element.dslKey === 'api');
    const db = elements.find((element) => element.dslKey === 'db');
    const edge = elements.find((element) => element.type === 'arrow') as LinearElement;
    const title = elements.find((element) => element.dslKey === 'title') as TextElement;
    const path = elements.find((element) => element.dslKey === 'accent');
    const frame = elements.find((element) => element.dslKey === 'backend');


    expect(api).toMatchObject({ type: 'rectangle', x: 100, y: 120, width: 180, height: 90, backgroundColor: '#e8f1ff', edges: 'round' });
    expect(db?.type).toBe('cylinder');
    expect(edge).toMatchObject({ strokeStyle: 'dashed', pathType: 'elbow', endArrowhead: 'triangle' });
    expect(edge.startBinding?.fixedPoint).toEqual([1, 0.5]);
    expect(edge.endBinding?.fixedPoint).toEqual([0, 0.5]);
    expect(title).toMatchObject({ text: 'Checkout', fontSize: 28, fontFamily: 'normal' });
    expect(path).toMatchObject({ type: 'line', strokeColor: '#ef4444', strokeWidth: 3 });
    expect(frame?.type).toBe('frame');
    expect(api?.frameId).toBe(frame?.id);
  });

  it('creates reusable built-in component instances from rich declarations', () => {
    applySpecToScene({
      rich: true,
      layout: 'none',
      nodes: [{ key: 'bucket', label: 'S3', shape: 'rectangle', component: 'aws:s3', x: 80, y: 90 }],
      edges: [],
      frames: [],
      texts: [],
      paths: [],
    });

    const instance = store.visibleElements.find((element) => element.dslKey === 'bucket');
    expect(instance).toMatchObject({ type: 'instance', componentId: 'aws:s3', x: 80, y: 90 });
    const roundTrip = specFromScene().spec.nodes.find((node) => node.key === 'bucket');
    expect(roundTrip).toMatchObject({ component: 'aws:s3', label: 'S3' });
  });
});
