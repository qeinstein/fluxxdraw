import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { store } from '../src/store';
import { 
  moveElementsBy, 
  changeZOrder, 
  alignSelection, 
  distributeSelection, 
  duplicateSelection, 
  deleteSelection, 
  toggleLockSelection, 
  applyStyleToSelection,
  reconcileFrameMembership,
  groupSelection,
  ungroupSelection
} from '../src/actions';
import type { ExcaliElement, GenericElement } from '../src/types';

describe('Actions', () => {
  beforeEach(() => {
    store.bindYdoc(new Y.Doc());
    store.resetScene();
  });

  describe('moveElementsBy', () => {
    it('moves elements by delta', () => {
      const rect = { id: 'r1', type: 'rectangle', x: 10, y: 10 } as unknown as GenericElement;
      store.mutate(() => { store.addElements(rect); });
      
      store.mutate(() => { moveElementsBy(['r1'], 10, 20); });
      
      const el = store.getElement('r1');
      expect(el?.x).toBe(20);
      expect(el?.y).toBe(30);
    });

    it('moves bound text along with container', () => {
      const rect = { id: 'r1', type: 'rectangle', x: 10, y: 10, boundText: 't1' } as unknown as GenericElement;
      const text = { id: 't1', type: 'text', x: 20, y: 20, containerId: 'r1' } as any;
      store.mutate(() => { store.addElements(rect, text); });
      
      store.mutate(() => { moveElementsBy(['r1'], 10, 10); });
      
      const t = store.getElement('t1');
      expect(t?.x).toBe(30);
      expect(t?.y).toBe(30);
    });
  });

  describe('selection actions', () => {
    it('groups and ungroups selection', () => {
      const r1 = { id: 'r1', type: 'rectangle', groupIds: [] } as unknown as GenericElement;
      const r2 = { id: 'r2', type: 'rectangle', groupIds: [] } as unknown as GenericElement;
      store.mutate(() => { store.addElements(r1, r2); });
      store.setAppState({ selectedIds: ['r1', 'r2'] });
      
      groupSelection();
      
      const g1 = store.getElement('r1')?.groupIds[0];
      const g2 = store.getElement('r2')?.groupIds[0];
      expect(g1).toBeDefined();
      expect(g1).toBe(g2);
      
      ungroupSelection();
      expect(store.getElement('r1')?.groupIds.length).toBe(0);
    });

    it('toggles lock on selection', () => {
      const r1 = { id: 'r1', type: 'rectangle', locked: false } as unknown as GenericElement;
      store.mutate(() => { store.addElements(r1); });
      store.setAppState({ selectedIds: ['r1'] });
      
      toggleLockSelection();
      expect(store.getElement('r1')?.locked).toBe(true);
      
      toggleLockSelection();
      expect(store.getElement('r1')?.locked).toBe(false);
    });

    it('deletes selection', () => {
      const r1 = { id: 'r1', type: 'rectangle' } as unknown as GenericElement;
      store.mutate(() => { store.addElements(r1); });
      store.setAppState({ selectedIds: ['r1'] });
      
      deleteSelection();
      expect(store.visibleElements.length).toBe(0);
      expect(store.getElement('r1')?.isDeleted).toBe(true);
    });
    
    it('duplicates selection', () => {
      const r1 = { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, groupIds: [], seed: 1 } as unknown as GenericElement;
      store.mutate(() => { store.addElements(r1); });
      store.setAppState({ selectedIds: ['r1'] });
      
      duplicateSelection(10, 10);
      
      expect(store.visibleElements.length).toBe(2);
      const copy = store.visibleElements.find(e => e.id !== 'r1')!;
      expect(copy.x).toBe(10);
      expect(copy.y).toBe(10);
      expect(store.appState.selectedIds).toEqual([copy.id]);
    });
  });

  describe('changeZOrder', () => {
    it('moves element to front', () => {
      const r1 = { id: 'r1', type: 'rectangle' } as unknown as GenericElement;
      const r2 = { id: 'r2', type: 'rectangle' } as unknown as GenericElement;
      const r3 = { id: 'r3', type: 'rectangle' } as unknown as GenericElement;
      store.mutate(() => { store.addElements(r1, r2, r3); });
      
      store.setAppState({ selectedIds: ['r1'] });
      changeZOrder('front');
      
      const visible = store.visibleElements;
      expect(visible[visible.length - 1].id).toBe('r1');
    });

    it('moves element to back', () => {
      const r1 = { id: 'r1', type: 'rectangle' } as unknown as GenericElement;
      const r2 = { id: 'r2', type: 'rectangle' } as unknown as GenericElement;
      const r3 = { id: 'r3', type: 'rectangle' } as unknown as GenericElement;
      store.mutate(() => { store.addElements(r1, r2, r3); });
      
      store.setAppState({ selectedIds: ['r3'] });
      changeZOrder('back');
      
      const visible = store.visibleElements;
      expect(visible[0].id).toBe('r3');
    });
    
    it('moves element backward', () => {
      const r1 = { id: 'r1', type: 'rectangle' } as unknown as GenericElement;
      const r2 = { id: 'r2', type: 'rectangle' } as unknown as GenericElement;
      const r3 = { id: 'r3', type: 'rectangle' } as unknown as GenericElement;
      store.mutate(() => { store.addElements(r1, r2, r3); });
      
      store.setAppState({ selectedIds: ['r2'] });
      changeZOrder('backward');
      
      const visible = store.visibleElements;
      expect(visible[0].id).toBe('r2');
      expect(visible[1].id).toBe('r1');
    });
  });

  describe('alignSelection', () => {
    it('aligns multiple elements', () => {
      const r1 = { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, angle: 0 } as unknown as GenericElement;
      const r2 = { id: 'r2', type: 'rectangle', x: 50, y: 50, width: 20, height: 20, angle: 0 } as unknown as GenericElement;
      store.mutate(() => { store.addElements(r1, r2); });
      store.setAppState({ selectedIds: ['r1', 'r2'] });
      
      alignSelection('left');
      
      expect(store.getElement('r1')?.x).toBe(0); // r1 stays
      expect(store.getElement('r2')?.x).toBe(0); // r2 aligns left to r1
    });
  });

  describe('distributeSelection', () => {
    it('distributes elements evenly', () => {
      const r1 = { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, angle: 0 } as unknown as GenericElement;
      const r2 = { id: 'r2', type: 'rectangle', x: 50, y: 0, width: 10, height: 10, angle: 0 } as unknown as GenericElement;
      const r3 = { id: 'r3', type: 'rectangle', x: 100, y: 0, width: 10, height: 10, angle: 0 } as unknown as GenericElement;
      store.mutate(() => { store.addElements(r1, r2, r3); });
      store.setAppState({ selectedIds: ['r1', 'r2', 'r3'] });
      
      store.mutate(() => { moveElementsBy(['r2'], -20, 0); }); // r2 is now at x=30
      
      distributeSelection('horizontal');
      
      // Should be evenly spaced
      const rr1 = store.getElement('r1')!;
      const rr2 = store.getElement('r2')!;
      const rr3 = store.getElement('r3')!;
      
      expect(rr1.x).toBe(0);
      expect(rr3.x).toBe(100);
      expect(rr2.x).toBe(50); // back to center
    });
  });

  describe('applyStyleToSelection', () => {
    it('applies style patch', () => {
      const r1 = { id: 'r1', type: 'rectangle', backgroundColor: 'red' } as unknown as GenericElement;
      store.mutate(() => { store.addElements(r1); });
      store.setAppState({ selectedIds: ['r1'] });
      
      applyStyleToSelection({ backgroundColor: 'blue' });
      expect(store.getElement('r1')?.backgroundColor).toBe('blue');
    });
  });
  
  describe('reconcileFrameMembership', () => {
    it('adds element to frame', () => {
      const frame = { id: 'f1', type: 'frame', x: 0, y: 0, width: 100, height: 100, angle: 0 } as unknown as ExcaliElement;
      const rect = { id: 'r1', type: 'rectangle', x: 10, y: 10, width: 10, height: 10, angle: 0 } as unknown as ExcaliElement;
      
      store.mutate(() => { store.addElements(frame, rect); });
      store.mutate(() => { reconcileFrameMembership(); });
      
      expect(store.getElement('r1')?.frameId).toBe('f1');
    });
  });
});
