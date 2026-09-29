/**
 * Minimal browser globals so the app can be rendered outside a browser.
 * Evaluated before any application module (import order is preserved).
 */

const noop = () => {};

const store = new Map();

globalThis.localStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key),
  clear: () => store.clear(),
  key: (index) => Array.from(store.keys())[index] ?? null,
  get length() {
    return store.size;
  },
};

globalThis.window = {
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame: (callback) => setTimeout(() => callback(Date.now()), 0),
  cancelAnimationFrame: (id) => clearTimeout(id),
  scrollTo: noop,
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
};

globalThis.document = {
  body: { style: {} },
  activeElement: null,
  getElementById: () => null,
  querySelector: () => null,
  addEventListener: noop,
  removeEventListener: noop,
  createElement: () => ({ style: {}, setAttribute: noop, appendChild: noop }),
};

globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
