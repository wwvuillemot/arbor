'use client';

import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../api/src/api/router';

/**
 * tRPC React client
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * tRPC client configuration
 */
export function getTRPCClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${process.env.NEXT_PUBLIC_API_URL || 'http://api.arbor.local'}/trpc`,
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

