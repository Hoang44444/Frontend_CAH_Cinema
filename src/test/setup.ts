import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// In-memory Storage mock
const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
};

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, writable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock, writable: true });

// Clean up after each test
afterEach(() => {
  cleanup();
  localStorageMock.clear();
  sessionStorageMock.clear();
  vi.clearAllMocks();
});

// Mock window.print
Object.defineProperty(window, 'print', {
  value: vi.fn(),
  writable: true,
});

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
