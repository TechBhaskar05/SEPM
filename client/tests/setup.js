import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Global test setup for the client.
 *
 * Budget alerts persist their "already warned about this" set in sessionStorage
 * so a toast does not re-fire on every reload of the budgets page. Each test
 * therefore has to start from an empty one, or a test that asserts a toast fires
 * would pass or fail depending on the order the suite happened to run in.
 */
beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

// jsdom implements neither of these, and several primitives rely on them:
// the layout tests check computed widths, and Radix-style focus handling
// checks what currently holds focus.
if (!globalThis.matchMedia) {
  globalThis.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
