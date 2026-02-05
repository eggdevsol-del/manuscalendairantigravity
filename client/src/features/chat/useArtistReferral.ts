import { useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

/**
 * Hook to handle artist referral links (?ref=artistId).
 * If a client lands here with a ref, it automatically creates a conversation.
 */
export function useArtistReferral() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();

    const createConversationMutation = trpc.conversations.getOrCreate.useMutation({
        onSuccess: (conversation) => {
            if (conversation) {
                setLocation(`/chat/${conversation.id}`);
            }
        },
    });

    useEffect(() => {
        if (user && user.role === 'client') {
            const params = new URLSearchParams(window.location.search);
            const refArtistId = params.get('ref');

            if (refArtistId && user.id) {
                createConversationMutation.mutate({
                    artistId: refArtistId,
                    clientId: user.id
                });
                // Clean up URL
                window.history.replaceState({}, '', '/conversations');
            }
        }
    }, [user, createConversationMutation]);

    return {
        isProcessing: createConversationMutation.isPending
    };
}
