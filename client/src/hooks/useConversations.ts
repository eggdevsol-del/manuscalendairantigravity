import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Centralized hook for conversations data (SSOT)
 * 
 * This is the SINGLE source of truth for conversations data.
 * All components should use this hook instead of calling trpc.conversations.list directly.
 * 
 * Benefits:
 * - Consistent query configuration across all components
 * - Single cache instance (no cache thrashing)
 * - Easier to maintain and debug
 * - Fixes Android loading issues caused by multiple queries
 */
export function useConversations() {
    const { user } = useAuth();

    return trpc.conversations.list.useQuery(undefined, {
        enabled: !!user,
        refetchInterval: 15000, // Balanced interval (not too aggressive)
        staleTime: 5000,
        retry: 2, // Retry failed requests (helps with flaky connections)
        retryDelay: 1000,
    });
}
