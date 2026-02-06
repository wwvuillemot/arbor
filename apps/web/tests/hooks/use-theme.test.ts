import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTheme } from '../../src/hooks/use-theme';
import type { useAppPreferences } from '../../src/hooks/use-app-preferences';

// Create a mock function that we can control
const mockGetPreference = vi.fn((key: string, defaultValue?: any) => {
  if (key === 'theme') return 'light';
  return defaultValue;
});
const mockSetPreference = vi.fn();

// Mock the useAppPreferences hook
vi.mock('../../src/hooks/use-app-preferences', () => ({
  useAppPreferences: vi.fn(() => ({
    preferences: { theme: 'light' },
    getPreference: mockGetPreference,
    setPreference: mockSetPreference,
    isLoading: false,
    isUpdating: false,
  })),
}));

describe('useTheme', () => {
  beforeEach(() => {
    // Clear any existing theme classes
    document.documentElement.classList.remove('dark', 'light');
    // Clear localStorage
    localStorage.clear();
    // Reset mocks
    vi.clearAllMocks();
    mockGetPreference.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'theme') return 'light';
      return defaultValue;
    });
  });

  it('should return current theme from preferences', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
  });

  it('should default to system theme if no preference is set', () => {
    mockGetPreference.mockImplementation((key: string, defaultValue?: any) => defaultValue);

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
  });

  it('should provide setTheme function', () => {
    const { result } = renderHook(() => useTheme());

    expect(typeof result.current.setTheme).toBe('function');
  });

  it('should update theme when setTheme is called', async () => {
    const { result } = renderHook(() => useTheme());

    await act(async () => {
      await result.current.setTheme('dark');
    });

    expect(mockSetPreference).toHaveBeenCalledWith('theme', 'dark');
  });

  it('should apply dark class to document when theme is dark', async () => {
    mockGetPreference.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'theme') return 'dark';
      return defaultValue;
    });

    renderHook(() => useTheme());

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('should remove dark class when theme is light', async () => {
    document.documentElement.classList.add('dark');

    mockGetPreference.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'theme') return 'light';
      return defaultValue;
    });

    renderHook(() => useTheme());

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  it('should respect system preference when theme is system', async () => {
    // Mock matchMedia to return dark mode
    const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    });

    mockGetPreference.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'theme') return 'system';
      return defaultValue;
    });

    renderHook(() => useTheme());

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('should return resolvedTheme (actual applied theme)', async () => {
    mockGetPreference.mockImplementation((key: string, defaultValue?: any) => {
      if (key === 'theme') return 'dark';
      return defaultValue;
    });

    const { result } = renderHook(() => useTheme());

    await waitFor(() => {
      expect(result.current.resolvedTheme).toBe('dark');
    });
  });
});

