"use client";

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../api/src/api/router";

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
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });
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
