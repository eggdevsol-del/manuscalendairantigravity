import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

/**
 * Selector to get the total unread message count across all conversations
 *
 * Uses a real query so the badge shows immediately after login,
 * not only after navigating to Messages.
 */
export const useTotalUnreadCount = () => {
  const { data: conversations } = trpc.conversations.list.useQuery(undefined, {
    staleTime: 30_000, // Re-fetch at most every 30s
    refetchInterval: 30_000, // Poll every 30s to stay fresh
    refetchOnWindowFocus: true,
  });

  return useMemo(() => {
    if (!conversations) return 0;
    return conversations.reduce(
      (acc, conv) => acc + (conv.unreadCount || 0),
      0
    );
  }, [conversations]);
};

/**
 * Selector to get a specific conversation by ID from the cache
 *
 * IMPORTANT: This reads from the React Query cache, it does NOT create a new query.
 * The cache is populated by useConversations() hook.
 */
export const useConversation = (conversationId: number) => {
  const utils = trpc.useUtils();

  // Read from cache (no network request)
  const conversations = utils.conversations.list.getData();

  return useMemo(() => {
    return conversations?.find(c => c.id === Number(conversationId));
  }, [conversations, conversationId]);
};
