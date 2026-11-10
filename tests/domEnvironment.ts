/**
 * Minimal DOM for component tests.
 *
 * This module must be imported before @testing-library/react: `screen` binds
 * to document.body at import time, so a DOM created afterwards leaves the
 * global queries unusable. Every test file that renders a component starts
 * with `import './domEnvironment'` as its first import.
 *
 * Node 22 exposes `navigator` as a getter only, so it is redefined rather
 * than assigned.
 */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html lang="fr"><body></body></html>', {
  url: 'https://exemple.test/',
  pretendToBeVisual: true,
});

const globals: Record<string, unknown> = {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  HTMLButtonElement: dom.window.HTMLButtonElement,
  Element: dom.window.Element,
  Node: dom.window.Node,
  Event: dom.window.Event,
  KeyboardEvent: dom.window.KeyboardEvent,
  MouseEvent: dom.window.MouseEvent,
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  // Recharts needs an observer to size its container; jsdom has none, and the
  // dashboard shows an explicit empty state instead of a chart when no data
  // exists, so a no-op observer is enough for the assertions.
  ResizeObserver: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  // React 19 reads this to decide whether act() warnings apply.
  IS_REACT_ACT_ENVIRONMENT: true,
};
for (const [key, value] of Object.entries(globals)) {
  Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });

// matchMedia is used by the image rotation and is absent from jsdom.
Object.defineProperty(dom.window, 'matchMedia', {
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
  configurable: true,
});

// `requestAnimationFrame` n'existe pas sous Node : jsdom le fournit sur sa
// fenêtre, encore faut-il l'exposer globalement. Le composant `Modal` s'en sert
// pour déplacer le focus après le rendu des enfants ; sans lui, l'import échoue
// avant même le premier test.
Object.defineProperty(globalThis, 'requestAnimationFrame', {
  value: (callback: (time: number) => void) => setTimeout(() => callback(Date.now()), 0),
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, 'cancelAnimationFrame', {
  value: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
  configurable: true,
  writable: true,
});

// The layout alternates images on a timer; unhandled timers keep node alive.
export const clearTimers = () => {
  for (let id = 1; id < 1000; id += 1) clearInterval(id);
};
