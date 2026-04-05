/**
 * Vanilla (non-React) tRPC client.
 *
 * Used by @stripe/connect-js fetchClientSecret callback which runs
 * outside the React lifecycle and cannot use tRPC hooks.
 *
 * Mirrors the same httpBatchLink + JWT auth config as main.tsx.
 */

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";
import { API_BASE_URL } from "../const";

export const trpcVanilla = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            url: `${API_BASE_URL}/api/trpc`,
            transformer: superjson,
            headers() {
                const token =
                    localStorage.getItem("authToken") ||
                    sessionStorage.getItem("authToken");
                return token ? { Authorization: `Bearer ${token}` } : {};
            },
        }),
    ],
});
