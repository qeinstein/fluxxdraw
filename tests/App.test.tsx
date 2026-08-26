import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import App from '../src/App';
import { store } from '../src/store';
import * as Y from 'yjs';

// Mock Canvas to avoid complex canvas rendering logic
vi.mock('../src/components/Canvas', () => ({
  Canvas: () => <div data-testid="mock-canvas">Mock Canvas</div>
}));

// Mock Minimap as it might use canvas
vi.mock('../src/components/Minimap', () => ({
  Minimap: () => <div data-testid="mock-minimap">Mock Minimap</div>
}));

describe('App', () => {
  beforeEach(() => {
    store.bindYdoc(new Y.Doc());
    store.resetScene();
  });

  it('renders the app structure', () => {
    render(<App />);
    
    // Check main sections
    expect(screen.getByTestId('mock-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('mock-minimap')).toBeInTheDocument();
    
    // Check toolbar/UI buttons
    expect(screen.getByText('Export')).toBeInTheDocument();
    expect(screen.getByLabelText('Undo')).toBeInTheDocument();
    expect(screen.getByLabelText('Redo')).toBeInTheDocument();
  });

  it('selects tools when toolbar buttons are clicked', () => {
    render(<App />);
    
    // Default is selection
    expect(store.appState.tool).toBe('selection');
    
    // Click on pan tool
    const panBtn = screen.getByLabelText('Pan');
    act(() => {
      fireEvent.click(panBtn);
    });
    
    expect(store.appState.tool).toBe('hand');
  });

  it('opens main menu when clicked', () => {
    render(<App />);
    
    const menuBtn = screen.getByLabelText('Menu');
    act(() => {
      fireEvent.click(menuBtn);
    });
    
    // Open menu reveals options
    expect(screen.getByText('Open…')).toBeInTheDocument();
  });
});
