"use client";

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../api/src/api/router";

/** Maximum wait time for LLM API requests (30 minutes) */
const LLM_REQUEST_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * tRPC React client
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * tRPC client configuration with error handling and timeouts
 */
export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_API_URL || "http://api.arbor.local"}/trpc`,
        // Add timeout to prevent hanging requests
        fetch(url, options) {
          // User-initiated aborts (options.signal) still work for cancellation
          const timeout = AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS);
          const signal = options?.signal
            ? AbortSignal.any([options.signal, timeout])
            : timeout;
          return fetch(url, { ...options, signal });
        },
        // You can add headers here if needed
        // headers() {
        //   return {
        //     authorization: getAuthCookie(),
        //   };
        // },
      }),
    ],
  });
}
