import '@testing-library/jest-dom'

// Mock localStorage and sessionStorage for jsdom
const storageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
};

Object.defineProperty(globalThis, 'localStorage', { value: storageMock() });
Object.defineProperty(globalThis, 'sessionStorage', { value: storageMock() });

// Ensure window.location.hostname exists for api.ts fallback
if (!globalThis.window?.location?.hostname) {
  Object.defineProperty(globalThis, 'window', {
    value: { ...globalThis.window, location: { hostname: 'localhost' } },
    writable: true,
  });
}
