import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeSelector } from '@/components/theme-selector';
import * as useThemeModule from '@/hooks/use-theme';

// Mock the useTheme hook
vi.mock('@/hooks/use-theme');

describe('ThemeSelector', () => {
  const mockSetTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with current theme', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      isLoading: false,
    });

    render(<ThemeSelector />);

    const lightButton = screen.getByRole('button', { name: /light theme/i });
    expect(lightButton).toBeInTheDocument();
    expect(lightButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should display all theme options', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'system',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      isLoading: false,
    });

    render(<ThemeSelector />);

    expect(screen.getByRole('button', { name: /light theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system theme/i })).toBeInTheDocument();
  });

  it('should call setTheme when selection changes to dark', async () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      isLoading: false,
    });

    render(<ThemeSelector />);

    const darkButton = screen.getByRole('button', { name: /dark theme/i });
    fireEvent.click(darkButton);

    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
  });

  it('should call setTheme when selection changes to system', async () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      isLoading: false,
    });

    render(<ThemeSelector />);

    const systemButton = screen.getByRole('button', { name: /system theme/i });
    fireEvent.click(systemButton);

    await waitFor(() => {
      expect(mockSetTheme).toHaveBeenCalledWith('system');
    });
  });

  it('should display dark theme as selected', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
      isLoading: false,
    });

    render(<ThemeSelector />);

    const darkButton = screen.getByRole('button', { name: /dark theme/i });
    expect(darkButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should display system theme as selected', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'system',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      isLoading: false,
    });

    render(<ThemeSelector />);

    const systemButton = screen.getByRole('button', { name: /system theme/i });
    expect(systemButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('should be disabled when loading', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      isLoading: true,
    });

    render(<ThemeSelector />);

    const lightButton = screen.getByRole('button', { name: /light theme/i });
    const darkButton = screen.getByRole('button', { name: /dark theme/i });
    const systemButton = screen.getByRole('button', { name: /system theme/i });

    expect(lightButton).toBeDisabled();
    expect(darkButton).toBeDisabled();
    expect(systemButton).toBeDisabled();
  });

  it('should have accessible labels', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      isLoading: false,
    });

    render(<ThemeSelector />);

    expect(screen.getByLabelText(/light theme/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dark theme/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/system theme/i)).toBeInTheDocument();
  });

  it('should display theme icons', () => {
    vi.spyOn(useThemeModule, 'useTheme').mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      isLoading: false,
    });

    render(<ThemeSelector />);

    // Check for icons (Sun, Moon, and Monitor icons from lucide-react)
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button.querySelector('svg')).toBeInTheDocument();
    });
  });
});

