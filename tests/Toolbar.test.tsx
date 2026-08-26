import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { Toolbar } from '../src/components/Toolbar';
import { store } from '../src/store';
import * as Y from 'yjs';

describe('Toolbar', () => {
  beforeEach(() => {
    store.bindYdoc(new Y.Doc());
    store.resetScene();
  });

  it('renders primary tools', () => {
    render(<Toolbar />);
    expect(screen.getByLabelText('Pan')).toBeInTheDocument();
    expect(screen.getByLabelText('Select')).toBeInTheDocument();
    expect(screen.getByLabelText('Rectangle')).toBeInTheDocument();
  });

  it('opens overflow menu and selects a tool', () => {
    render(<Toolbar />);
    
    // Overflow menu should be closed initially
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    
    // Click more tools
    const moreBtn = screen.getByLabelText('More tools');
    act(() => {
      fireEvent.click(moreBtn);
    });
    
    // Menu should be open
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Frame')).toBeInTheDocument();
    
    // Select a tool from overflow
    act(() => {
      fireEvent.click(screen.getByText('Frame'));
    });
    
    expect(store.appState.tool).toBe('frame');
    
    // Menu should close
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
