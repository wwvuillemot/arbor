import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { trpc, getTRPCClient } from '@/lib/trpc';
import SettingsPage from '@/app/[locale]/(app)/settings/page';

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => '/settings',
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock the tRPC client to avoid actual API calls
vi.mock('@/lib/trpc', () => {
  const mockTrpc = {
    preferences: {
      getAppPreference: {
        useQuery: vi.fn(() => ({
          data: 'system',
          isLoading: false,
          error: null,
        })),
      },
      setAppPreference: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isLoading: false,
        })),
      },
      getAllAppPreferences: {
        useQuery: vi.fn(() => ({
          data: { theme: 'system', language: 'en' },
          isLoading: false,
          error: null,
        })),
      },
      setAppPreferences: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isLoading: false,
        })),
      },
      deleteAppPreference: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isLoading: false,
        })),
      },
    },
    useUtils: vi.fn(() => ({
      preferences: {
        getAllAppPreferences: {
          invalidate: vi.fn(),
        },
      },
    })),
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };

  return {
    trpc: mockTrpc,
    getTRPCClient: vi.fn(),
  };
});

// Test wrapper with providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render settings page', () => {
    render(<SettingsPage />, { wrapper: TestWrapper });

    // The mock returns translation keys, so we check for "title" instead of "Settings"
    expect(screen.getByRole('heading', { name: /title/i })).toBeInTheDocument();
  });

  it('should display theme selector', () => {
    render(<SettingsPage />, { wrapper: TestWrapper });

    // Check for theme selector heading/label (mock returns "theme.label")
    expect(screen.getByText('theme.label')).toBeInTheDocument();

    // Check for theme selector buttons
    expect(screen.getByRole('button', { name: /light theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system theme/i })).toBeInTheDocument();
  });

  it('should display appearance section', () => {
    render(<SettingsPage />, { wrapper: TestWrapper });

    expect(screen.getByText(/appearance/i)).toBeInTheDocument();
  });

  it('should have theme selector in appearance section', () => {
    render(<SettingsPage />, { wrapper: TestWrapper });

    // Find the appearance section
    const appearanceSection = screen.getByText(/appearance/i).closest('section');
    expect(appearanceSection).toBeInTheDocument();

    // Check that theme selector buttons are within the appearance section
    const lightButton = screen.getByRole('button', { name: /light theme/i });
    expect(appearanceSection?.contains(lightButton)).toBe(true);
  });

  it('should display theme description', () => {
    render(<SettingsPage />, { wrapper: TestWrapper });

    // Should have some description about theme selection (mock returns "theme.description")
    expect(screen.getByText('theme.description')).toBeInTheDocument();
  });
});

