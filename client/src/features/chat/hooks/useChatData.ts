import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect, useState } from "react";

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
    const otherUserName = conversation?.otherUser?.name || "Unknown User";

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

    return {
        user,
        authLoading,
        conversation,
        convLoading,
        messages,
        messagesLoading,
        quickActions,
        artistSettings: isArtist ? artistSettings : {
            ...artistSettings,
            businessAddress: artistPublicSettings?.businessAddress ?? artistSettings?.businessAddress,
            businessName: artistPublicSettings?.businessName ?? artistSettings?.businessName,
        },
        consultationList,
        consultationData,
        paramConsultationId,
        availableServices,
        isArtist,
        otherUserId,
        otherUserName
    };
}
