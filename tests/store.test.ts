import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { store } from '../src/store';
import type { ExcaliElement } from '../src/types';
import { DEFAULT_APP_STATE } from '../src/constants';

describe('SceneStore', () => {
  beforeEach(() => {
    store.bindYdoc(new Y.Doc());
    store.resetScene();
  });

  it('initializes with default app state', () => {
    expect(store.appState).toEqual({ ...DEFAULT_APP_STATE, editingTextId: null });
    expect(store.elements).toEqual([]);
  });

  it('can add and get elements', () => {
    const el = { id: 'test1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 } as ExcaliElement;
    store.mutate(() => {
      store.addElements(el);
    });
    expect(store.elements.length).toBe(1);
    expect(store.getElement('test1')).toEqual(el);
    expect(store.visibleElements.length).toBe(1);
  });

  it('can soft-delete elements', () => {
    const el = { id: 'test2', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 } as ExcaliElement;
    store.mutate(() => {
      store.addElements(el);
    });
    store.mutate(() => {
      store.deleteElements(['test2']);
    });
    expect(store.elements.length).toBe(1);
    expect(store.elements[0].isDeleted).toBe(true);
    expect(store.visibleElements.length).toBe(0);
  });

  it('gets selected elements', () => {
    const el = { id: 'test3', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 } as ExcaliElement;
    store.mutate(() => {
      store.addElements(el);
    });
    store.setAppState({ selectedIds: ['test3'] });
    expect(store.getSelected()).toEqual([el]);
  });

  it('updates elements and bumps version', () => {
    const el = { id: 'test4', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, version: 1 } as ExcaliElement;
    store.mutate(() => {
      store.addElements(el);
    });
    store.mutate(() => {
      store.updateElement('test4', () => ({ x: 100 }));
    });
    const updated = store.getElement('test4');
    expect(updated?.x).toBe(100);
    expect(updated?.version).toBe(2);
  });

  it('can undo and redo', () => {
    const el = { id: 'test5', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 } as ExcaliElement;
    store.mutate(() => {
      store.addElements(el);
    });
    expect(store.elements.length).toBe(1);
    
    store.undo();
    expect(store.elements.length).toBe(0);
    
    store.redo();
    expect(store.elements.length).toBe(1);
  });

  it('tracks direct gesture mutations for undo', () => {
    const el = { id: 'test6', type: 'rectangle', x: 0, y: 0, width: 10, height: 10 } as ExcaliElement;
    store.beginHistory();
    store.addElements(el);
    store.commit();

    expect(store.canUndo()).toBe(true);
    store.undo();
    expect(store.elements.length).toBe(0);
  });

  it('sets editing arrow id based on selection', () => {
    const el = { id: 'arrow1', type: 'arrow', x: 0, y: 0 } as ExcaliElement;
    store.mutate(() => {
      store.addElements(el);
    });
    
    store.setAppState({ selectedIds: ['arrow1'] });
    expect(store.appState.editingArrowId).toBe('arrow1');

    store.setAppState({ selectedIds: [] });
    expect(store.appState.editingArrowId).toBeNull();
  });
});
