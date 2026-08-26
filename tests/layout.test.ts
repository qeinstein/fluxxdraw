import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { store } from '../src/store';
import { tidyUp } from '../src/layout';
import type { ExcaliElement, LinearElement } from '../src/types';

describe('layout', () => {
  beforeEach(() => {
    store.bindYdoc(new Y.Doc());
    store.resetScene();
  });

  it('does nothing if fewer than 2 elements are provided', () => {
    const el = { id: 'el1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, groupIds: [] } as unknown as ExcaliElement;
    store.mutate(() => {
      store.addElements(el);
    });
    
    const result = tidyUp('down');
    expect(result.moved).toBe(0);
    expect(result.laidOutGraph).toBe(false);
  });

  it('layouts simple unconnected elements in a grid', () => {
    const el1 = { id: 'el1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, groupIds: [] } as unknown as ExcaliElement;
    const el2 = { id: 'el2', type: 'rectangle', x: 50, y: 50, width: 10, height: 10, groupIds: [] } as unknown as ExcaliElement;
    store.mutate(() => {
      store.addElements(el1, el2);
    });
    
    // Bounds of elements are [0,0, 10, 10] and [50, 50, 60, 60] -> anchor = [0, 0, 60, 60]
    const result = tidyUp('down');
    expect(result.moved).toBeGreaterThan(0);
    expect(result.laidOutGraph).toBe(false);

    // After layout, unconnected items are put in a grid
    const updated1 = store.getElement('el1');
    const updated2 = store.getElement('el2');
    expect(updated1?.x).not.toBeUndefined();
    expect(updated2?.x).not.toBeUndefined();
  });

  it('layouts connected elements as a graph', () => {
    const rect1 = { id: 'rect1', type: 'rectangle', x: 0, y: 0, width: 100, height: 50, groupIds: [] } as unknown as ExcaliElement;
    const rect2 = { id: 'rect2', type: 'rectangle', x: 200, y: 200, width: 100, height: 50, groupIds: [] } as unknown as ExcaliElement;
    const arrow = {
      id: 'arrow1',
      type: 'arrow',
      x: 50, y: 50,
      width: 150, height: 150,
      points: [[0, 0], [150, 150]],
      groupIds: [],
      startBinding: { elementId: 'rect1', focus: 0.5, gap: 5 },
      endBinding: { elementId: 'rect2', focus: 0.5, gap: 5 },
    } as unknown as LinearElement;

    store.mutate(() => {
      store.addElements(rect1, rect2, arrow);
    });

    const result = tidyUp('down');
    expect(result.laidOutGraph).toBe(true);
    expect(result.moved).toBeGreaterThan(0);
    
    // Y coordinate of rect2 should be greater than rect1 (flowing down)
    const updatedRect1 = store.getElement('rect1');
    const updatedRect2 = store.getElement('rect2');
    expect(updatedRect2!.y).toBeGreaterThan(updatedRect1!.y);
  });
});
