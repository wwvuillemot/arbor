import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageSelector } from '@/components/language-selector';
import * as useAppPreferencesModule from '@/hooks/use-app-preferences';

// Mock the useAppPreferences hook
vi.mock('@/hooks/use-app-preferences');

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => '/dashboard',
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('LanguageSelector', () => {
  const mockSetPreference = vi.fn();
  const mockGetPreference = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(useAppPreferencesModule, 'useAppPreferences').mockReturnValue({
      preferences: { language: 'system' },
      isLoading: false,
      getPreference: mockGetPreference.mockReturnValue('system'),
      setPreference: mockSetPreference,
      setPreferences: vi.fn(),
      deletePreference: vi.fn(),
      isUpdating: false,
    });
  });

  it('should render with all language options', () => {
    render(<LanguageSelector />);

    // Should have System, English and Japanese options
    expect(screen.getByText('System')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('日本語')).toBeInTheDocument();
  });

  it('should display System as selected by default', () => {
    render(<LanguageSelector />);

    const systemButton = screen.getByRole('button', { name: /system language/i });
    expect(systemButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should display English as selected when language is en', () => {
    mockGetPreference.mockReturnValue('en');
    vi.spyOn(useAppPreferencesModule, 'useAppPreferences').mockReturnValue({
      preferences: { language: 'en' },
      isLoading: false,
      getPreference: mockGetPreference,
      setPreference: mockSetPreference,
      setPreferences: vi.fn(),
      deletePreference: vi.fn(),
      isUpdating: false,
    });

    render(<LanguageSelector />);

    const englishButton = screen.getByRole('button', { name: /english/i });
    expect(englishButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should display Japanese as selected when language is ja', () => {
    mockGetPreference.mockReturnValue('ja');
    vi.spyOn(useAppPreferencesModule, 'useAppPreferences').mockReturnValue({
      preferences: { language: 'ja' },
      isLoading: false,
      getPreference: mockGetPreference,
      setPreference: mockSetPreference,
      setPreferences: vi.fn(),
      deletePreference: vi.fn(),
      isUpdating: false,
    });

    render(<LanguageSelector />);

    const japaneseButton = screen.getByRole('button', { name: /japanese language/i });
    expect(japaneseButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should call setPreference when language is changed to Japanese', async () => {
    render(<LanguageSelector />);

    const japaneseButton = screen.getByRole('button', { name: /japanese language/i });
    fireEvent.click(japaneseButton);

    await waitFor(() => {
      expect(mockSetPreference).toHaveBeenCalledWith('language', 'ja');
    });
  });

  it('should call setPreference when language is changed to English', async () => {
    mockGetPreference.mockReturnValue('ja');
    vi.spyOn(useAppPreferencesModule, 'useAppPreferences').mockReturnValue({
      preferences: { language: 'ja' },
      isLoading: false,
      getPreference: mockGetPreference,
      setPreference: mockSetPreference,
      setPreferences: vi.fn(),
      deletePreference: vi.fn(),
      isUpdating: false,
    });

    render(<LanguageSelector />);

    const englishButton = screen.getByRole('button', { name: /english/i });
    fireEvent.click(englishButton);

    await waitFor(() => {
      expect(mockSetPreference).toHaveBeenCalledWith('language', 'en');
    });
  });

  it('should be disabled when loading', () => {
    vi.spyOn(useAppPreferencesModule, 'useAppPreferences').mockReturnValue({
      preferences: { language: 'en' },
      isLoading: true,
      getPreference: mockGetPreference,
      setPreference: mockSetPreference,
      setPreferences: vi.fn(),
      deletePreference: vi.fn(),
      isUpdating: false,
    });

    render(<LanguageSelector />);

    const englishButton = screen.getByRole('button', { name: /english language/i });
    const japaneseButton = screen.getByRole('button', { name: /japanese language/i });

    expect(englishButton).toBeDisabled();
    expect(japaneseButton).toBeDisabled();
  });

  it('should have accessible labels', () => {
    render(<LanguageSelector />);

    expect(screen.getByRole('button', { name: /english language/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /japanese language/i })).toBeInTheDocument();
  });

  it('should display language icons', () => {
    render(<LanguageSelector />);

    // Check that the component renders 3 buttons (System, English, Japanese)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(3);
  });
});

