import { describe, it, expect } from 'vitest';
import {
  newGenericElement,
  newLinearElement,
  newFreedrawElement,
  newTextElement,
  newImageElement,
  newFrameElement,
  newEmbedElement,
  duplicateElement,
  syncFrameCounter,
} from '../../src/elements/factory';
import { store } from '../../src/store';
import type { ExcaliElement } from '../../src/types';

describe('Factory', () => {
  it('creates generic element', () => {
    const el = newGenericElement('rectangle', store.appState, 10, 20);
    expect(el.type).toBe('rectangle');
    expect(el.x).toBe(10);
    expect(el.y).toBe(20);
    expect(el.id).toBeDefined();
    expect(el.boundText).toBeNull();
  });

  it('creates linear element', () => {
    const el = newLinearElement('arrow', store.appState, 10, 20);
    expect(el.type).toBe('arrow');
    expect(el.points).toEqual([[0, 0]]);
    expect(el.startArrowhead).toBeDefined();
  });

  it('creates freedraw element', () => {
    const el = newFreedrawElement(store.appState, 10, 20);
    expect(el.type).toBe('freedraw');
    expect(el.points).toEqual([[0, 0]]);
    expect(el.pressures).toEqual([0.5]);
    expect(el.backgroundColor).toBe('transparent');
  });

  it('creates text element', () => {
    const el = newTextElement(store.appState, 10, 20, 'container1');
    expect(el.type).toBe('text');
    expect(el.text).toBe('');
    expect(el.containerId).toBe('container1');
    expect(el.textAlign).toBe('center'); // because containerId is provided
    expect(el.verticalAlign).toBe('middle'); // because containerId is provided
  });
  
  it('creates standalone text element', () => {
    const el = newTextElement(store.appState, 10, 20);
    expect(el.containerId).toBeNull();
    expect(el.verticalAlign).toBe('top');
  });

  it('creates image element', () => {
    const el = newImageElement(store.appState, 10, 20, 'file1', 100, 200);
    expect(el.type).toBe('image');
    expect(el.fileId).toBe('file1');
    expect(el.width).toBe(100);
    expect(el.height).toBe(200);
  });

  it('creates frame element and syncs counter', () => {
    syncFrameCounter([]);
    const el1 = newFrameElement(store.appState, 10, 20);
    expect(el1.type).toBe('frame');
    expect(el1.name).toBe('Frame 1');
    
    syncFrameCounter([{ type: 'frame' }, { type: 'frame' }] as ExcaliElement[]);
    const el2 = newFrameElement(store.appState, 10, 20);
    expect(el2.name).toBe('Frame 3');
  });

  it('creates embed element', () => {
    const el = newEmbedElement(store.appState, 10, 20, 'https://example.com');
    expect(el.type).toBe('embed');
    expect(el.url).toBe('https://example.com');
  });

  it('duplicates element', () => {
    const el = newGenericElement('rectangle', store.appState, 10, 20);
    el.width = 100;
    el.height = 100;
    
    const copy = duplicateElement(el, 5, 5);
    expect(copy.id).not.toBe(el.id);
    expect(copy.type).toBe(el.type);
    expect(copy.width).toBe(el.width);
    expect(copy.height).toBe(el.height);
    expect(copy.x).toBe(15);
    expect(copy.y).toBe(25);
    expect(copy.seed).not.toBe(el.seed);
    expect(copy.version).toBe(1);
  });
});
