import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/*
 * Radix UI primitives (the base of `Dialog`, `Avatar`, and of any menu or
 * select added later) read browser APIs that jsdom does not implement. Without
 * these stubs, rendering a dialog throws instead of failing an assertion.
 *
 * The casts are the point: the DOM typings declare all of these as always
 * present, which is exactly the assumption jsdom breaks.
 */
type StubbableGlobals = {
  matchMedia?: (query: string) => MediaQueryList;
  ResizeObserver?: typeof ResizeObserver;
};

type StubbableElement = {
  scrollIntoView?: () => void;
  hasPointerCapture?: () => boolean;
  setPointerCapture?: () => void;
  releasePointerCapture?: () => void;
};

const browserGlobals = globalThis as unknown as StubbableGlobals;

browserGlobals.matchMedia ??= (query: string): MediaQueryList =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

browserGlobals.ResizeObserver ??= class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};

const elementPrototype = Element.prototype as unknown as StubbableElement;

elementPrototype.scrollIntoView ??= () => {};
elementPrototype.hasPointerCapture ??= () => false;
elementPrototype.setPointerCapture ??= () => {};
elementPrototype.releasePointerCapture ??= () => {};

afterEach(() => {
  cleanup();
});
