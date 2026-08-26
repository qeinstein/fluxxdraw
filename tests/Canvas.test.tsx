import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from '../src/components/Canvas';
import { store } from '../src/store';
import * as Y from 'yjs';

// Mock ResizeObserver
window.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Canvas', () => {
  beforeEach(() => {
    store.bindYdoc(new Y.Doc());
    store.resetScene();
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the canvas elements', () => {
    const onContextMenu = vi.fn();
    const onDoubleClickText = vi.fn();
    const onRequestImage = vi.fn();
    const onLinkProblem = vi.fn();

    const { container } = render(
      <Canvas 
        onContextMenu={onContextMenu} 
        onDoubleClickText={onDoubleClickText} 
        onRequestImage={onRequestImage} 
        onLinkProblem={onLinkProblem} 
      />
    );
    
    // There are two canvases: interactive and static
    const canvases = container.querySelectorAll('canvas');
    expect(canvases.length).toBeGreaterThan(0);
  });
});
