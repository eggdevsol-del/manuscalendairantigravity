import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState, useMemo } from "react";

export function useChatData(conversationId: number) {
    const { user, loading: authLoading } = useAuth();
    const [availableServices, setAvailableServices] = useState<any[]>([]);

    // Queries
    const { data: conversation, isLoading: convLoading } =
        trpc.conversations.getById.useQuery(conversationId, {
            enabled: !!user && conversationId > 0,
        });

    const { data: messages, isLoading: messagesLoading } =
        trpc.messages.list.useQuery(
            { conversationId },
            {
                enabled: !!user && conversationId > 0,
                refetchInterval: 3000,
            }
        );

    const { data: quickActions } = trpc.quickActions.list.useQuery(undefined, {
        enabled: !!user && (user.role === "artist" || user.role === "admin"),
    });

    const { data: artistSettings } = trpc.artistSettings.get.useQuery(undefined, {
        enabled: !!user && (user.role === "artist" || user.role === "admin"),
    });

    // For clients: fetch artist's public settings (businessAddress) via conversation's artistId
    const { data: artistPublicSettings } = trpc.artistSettings.getPublicByArtistId.useQuery(
        { artistId: conversation?.artistId || '' },
        {
            enabled: !!user && user.role === "client" && !!conversation?.artistId,
        }
    );

    const { data: consultationList } = trpc.consultations.list.useQuery(undefined, {
        enabled: !!user,
    });

    // Derived Data
    const searchParams = new URLSearchParams(window.location.search);
    const paramConsultationId = searchParams.get('consultationId');
    const targetConsultationId = paramConsultationId ? parseInt(paramConsultationId) : conversation?.pinnedConsultationId;
    const consultationData = consultationList?.find(c => c.id === targetConsultationId);

    const isArtist = user?.role === "artist" || user?.role === "admin";
    const otherUserId = isArtist ? conversation?.clientId : conversation?.artistId;
    const otherUserName = (conversation?.otherUser as any)?.name || "Unknown User";

    // Effects
    useEffect(() => {
        if (artistSettings?.services) {
            try {
                const parsed = JSON.parse(artistSettings.services);
                if (Array.isArray(parsed)) {
                    setAvailableServices(parsed);
                }
            } catch (e) {
                console.error("Failed to parse services", e);
            }
        }
    }, [artistSettings]);

    const memoizedArtistSettings = useMemo(() => {
        if (isArtist) return artistSettings;
        return {
            ...artistSettings,
            businessAddress: artistPublicSettings?.businessAddress ?? artistSettings?.businessAddress,
            businessName: artistPublicSettings?.businessName ?? artistSettings?.businessName,
        };
    }, [isArtist, artistSettings, artistPublicSettings]);

    const value = useMemo(() => ({
        user,
        authLoading,
        conversation,
        convLoading,
        messages,
        messagesLoading,
        quickActions,
        artistSettings: memoizedArtistSettings,
        consultationList,
        consultationData,
        paramConsultationId,
        availableServices,
        isArtist,
        otherUserId,
        otherUserName
    }), [
        user,
        authLoading,
        conversation,
        convLoading,
        messages,
        messagesLoading,
        quickActions,
        memoizedArtistSettings,
        consultationList,
        consultationData,
        paramConsultationId,
        availableServices,
        isArtist,
        otherUserId,
        otherUserName
    ]);

    return value;
}
