import { vi } from "vitest";
import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

// Mock Canvas API for jsdom
const mockContext = new Proxy({} as CanvasRenderingContext2D, {
  get(_target, prop) {
    if (prop === 'measureText') {
      return (text: string) => ({ width: text.length * 8, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 });
    }
    // Return a dummy function for all other properties
    return vi.fn();
  }
});

HTMLCanvasElement.prototype.getContext = () => mockContext as any;

// Mock localStorage
const localStorageMock = (function() {
  let store: Record<string, string> = {};
  return {
    getItem: function(key: string) {
      return store[key] || null;
    },
    setItem: function(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem: function(key: string) {
      delete store[key];
    },
    clear: function() {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
