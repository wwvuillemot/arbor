import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

function createStorageMock() {
  const storedEntries = new Map<string, string>();

  const storage = {
    get length() {
      return storedEntries.size;
    },
    clear: vi.fn(() => {
      storedEntries.clear();
    }),
    getItem: vi.fn((key: string) => {
      return storedEntries.has(key) ? (storedEntries.get(key) ?? null) : null;
    }),
    key: vi.fn((index: number) => {
      return Array.from(storedEntries.keys())[index] ?? null;
    }),
    removeItem: vi.fn((key: string) => {
      storedEntries.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      storedEntries.set(String(key), String(value));
    }),
  } satisfies Storage;

  return {
    reset() {
      storedEntries.clear();
    },
    storage,
  };
}

const sessionStorageMock = createStorageMock();
const localStorageMock = createStorageMock();

// Mock next-intl for tests
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue("test-master-key-base64-encoded-32-bytes"),
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
  sessionStorageMock.reset();
  localStorageMock.reset();
});

// Mock matchMedia if not available
Object.defineProperty(window, "matchMedia", {
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

// Mock sessionStorage
Object.defineProperty(window, "sessionStorage", {
  writable: true,
  value: sessionStorageMock.storage,
});

// Mock localStorage
Object.defineProperty(window, "localStorage", {
  writable: true,
  value: localStorageMock.storage,
});
