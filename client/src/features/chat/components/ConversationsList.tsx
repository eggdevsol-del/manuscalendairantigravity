import { Button } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { Calendar, MessageCircle, ChevronRight } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { LoadingState, ConversationCard } from "@/components/ui/ssot";
import { useLocation } from "wouter";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { useInboxRequests, InboxRequest } from "@/features/chat/hooks/useInboxRequests";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { useRegisterFABActions } from "@/contexts/BottomNavContext";
import { useMemo } from "react";
import { FABMenuItem } from "@/ui/FABMenu";

interface ConversationsListProps {
    className?: string;
    onSelect?: () => void; // Callback when a conversation is selected (optional)
    activeId?: number; // Conversation ID to highlight
}

export function ConversationsList({ className, onSelect, activeId }: ConversationsListProps) {
    const { user, loading } = useAuth();
    const [, setLocation] = useLocation();

    const createConversation = trpc.conversations.getOrCreate.useMutation();
    const { data: conversations, isLoading, isPending } = useConversations();

    const updateLeadStatus = trpc.funnel.updateLeadStatus.useMutation();
    const updateConsultation = trpc.consultations.update.useMutation();
    const utils = trpc.useUtils();

    const { requestItems, isLoading: requestsLoading, isArtist } = useInboxRequests();

    const handleMarkAsRead = async (item: InboxRequest) => {
        try {
            if (item.type === 'lead' && item.leadId) {
                await updateLeadStatus.mutateAsync({
                    leadId: item.leadId,
                    status: 'contacted'
                });
                utils.funnel.getLeads.invalidate();
            }
            else if (item.type === 'consultation' && item.id) {
                await updateConsultation.mutateAsync({
                    id: item.id,
                    viewed: 1
                });
                utils.consultations.list.invalidate();
            }
        } catch (error) {
            console.error("Failed to mark item as read:", error);
        }
    };

    // Register FAB Actions
    const fabActions = useMemo<FABMenuItem[]>(() => {
        const res: FABMenuItem[] = [];
        if (!isArtist) {
            res.push({
                id: 'new-request',
                label: 'New Request',
                icon: Calendar,
                onClick: () => {
                    setLocation("/consultations");
                    onSelect?.();
                },
                highlight: true
            });
        } else {
            res.push({
                id: 'new-chat',
                label: 'New Chat',
                icon: MessageCircle,
                onClick: () => {
                    setLocation("/clients");
                    onSelect?.();
                },
                highlight: true
            });
        }
        return res;
    }, [isArtist, setLocation, onSelect]);

    useRegisterFABActions("conversations-list", fabActions);

    const isListLoading = loading || (isLoading && !conversations) || requestsLoading;

    if (isListLoading) {
        return <LoadingState message="Loading messages..." />;
    }

    const unreadTotal = conversations?.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0) || 0;

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* 2. Top Context Area (Non-interactive) */}
            <div className={cn(tokens.spacing.containerPadding, "pt-4 z-10 shrink-0 flex flex-col justify-center min-h-[140px] opacity-80")}>
                <p className={tokens.header.contextTitle}>Inbox</p>
                <div className="flex items-center gap-3 mt-1">
                    <span className={tokens.header.contextSubtitle}>
                        {unreadTotal > 0 ? `${unreadTotal} Unread` : "All caught up"}
                    </span>
                    {unreadTotal > 0 && (
                        <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                    )}
                </div>
            </div>

            {/* 3. Content Container */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Scrollable Content */}
                <div className="flex-1 w-full h-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y will-change-scroll transform-gpu">
                    <div className="pb-32 max-w-lg mx-auto space-y-4 min-h-[50vh]">
                        {(requestItems.length > 0 || (conversations && conversations.length > 0)) ? (
                            <div className="space-y-1">
                                {/* 1. New Requests (Pinned to top) */}
                                {isArtist && requestItems.map((item) => (
                                    <ConversationCard
                                        key={`${item.type}-${item.id}`}
                                        name={item.name}
                                        subject={item.subject}
                                        isNew={true}
                                        // For now, requests don't have a stable ConversationID until created/mapped
                                        // So we might not be able to highlight them easily unless we track request ID
                                        // But usually clicking them navigates away to Lead or creates Chat
                                        timestamp={item.date ? new Date(item.date).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        }) : undefined}
                                        onClick={async () => {
                                            handleMarkAsRead(item);
                                            onSelect?.();

                                            if (item.leadId) {
                                                setLocation(`/lead/${item.leadId}`);
                                                return;
                                            }

                                            if (item.data?.conversationId) {
                                                setLocation(`/chat/${item.data.conversationId}?consultationId=${item.id}`);
                                                return;
                                            }

                                            if (item?.data?.clientId && user) {
                                                try {
                                                    const conv = await createConversation.mutateAsync({
                                                        artistId: user.id,
                                                        clientId: item.data.clientId as string
                                                    });

                                                    if (conv) {
                                                        setLocation(`/chat/${conv.id}`);
                                                        return;
                                                    }
                                                } catch (err) {
                                                    console.error("Failed to get/create conversation fallback", err);
                                                }
                                            }

                                            toast.error("Could not open request details");
                                        }}
                                    />
                                ))}

                                {/* 2. Standard Conversations */}
                                {conversations?.map((conv) => (
                                    <ConversationCard
                                        key={conv.id}
                                        name={conv.otherUser?.name || "Unknown User"}
                                        avatar={conv.otherUser?.avatar}
                                        timestamp={new Date(conv.createdAt!).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                        })}
                                        unreadCount={conv.unreadCount}
                                        isActive={activeId === conv.id}
                                        onClick={() => {
                                            setLocation(`/chat/${conv.id}`);
                                            onSelect?.();
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <Empty>
                                <EmptyMedia>
                                    <MessageCircle className="w-16 h-16 text-muted-foreground/30" />
                                </EmptyMedia>
                                <EmptyHeader>
                                    <EmptyTitle>No conversations yet</EmptyTitle>
                                    <EmptyDescription>
                                        {isArtist
                                            ? "Your client conversations will appear here"
                                            : "Start a conversation with an artist"}
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
