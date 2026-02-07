import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, getTRPCClient } from "@/lib/trpc";
import SettingsPage from "@/app/[locale]/(app)/settings/page";

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
    replace: mockReplace,
  }),
  usePathname: () => "/en/settings",
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock the tRPC client to avoid actual API calls
vi.mock("@/lib/trpc", () => {
  const mockTrpc = {
    preferences: {
      getAppPreference: {
        useQuery: vi.fn(() => ({
          data: "system",
          isLoading: false,
          error: null,
        })),
      },
      setAppPreference: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isLoading: false,
          isPending: false,
        })),
      },
      getAllAppPreferences: {
        useQuery: vi.fn(() => ({
          data: { theme: "system", language: "en" },
          isLoading: false,
          error: null,
        })),
      },
      setAppPreferences: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isLoading: false,
          isPending: false,
        })),
      },
      deleteAppPreference: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isLoading: false,
          isPending: false,
        })),
      },
    },
    settings: {
      getAllSettings: {
        useQuery: vi.fn(() => ({
          data: {},
          isLoading: false,
          error: null,
        })),
      },
      setSetting: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isLoading: false,
          isPending: false,
        })),
      },
      deleteSetting: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          mutateAsync: vi.fn(),
          isLoading: false,
          isPending: false,
        })),
      },
    },
    useUtils: vi.fn(() => ({
      preferences: {
        getAllAppPreferences: {
          invalidate: vi.fn(),
        },
      },
      settings: {
        getAllSettings: {
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
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect to preferences page", () => {
    render(<SettingsPage />, { wrapper: TestWrapper });

    // Should redirect to /en/settings/preferences
    expect(mockReplace).toHaveBeenCalledWith("/en/settings/preferences");
  });
});
