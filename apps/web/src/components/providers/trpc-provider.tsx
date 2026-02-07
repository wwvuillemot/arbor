"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, getTRPCClient } from "@/lib/trpc";

/**
 * tRPC Provider
 *
 * Wraps the app with tRPC and React Query providers
 * This enables the use of tRPC hooks throughout the application
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for better UX
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
            // Cache data for 5 minutes
            staleTime: 5 * 60 * 1000,
          },
        },
      }),
  );

  const [trpcClient] = React.useState(() => getTRPCClient());

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
