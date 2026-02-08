import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

/**
 * Selector to get the total unread message count across all conversations
 * 
 * IMPORTANT: This reads from the React Query cache, it does NOT create a new query.
 * The cache is populated by useConversations() hook.
 */
export const useTotalUnreadCount = () => {
    const utils = trpc.useUtils();

    // Read from cache (no network request)
    const conversations = utils.conversations.list.getData();

    return useMemo(() => {
        if (!conversations) return 0;
        return conversations.reduce((acc, conv) => acc + (conv.unreadCount || 0), 0);
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
