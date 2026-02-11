
import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Card, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { Calendar, ChevronDown, ChevronRight, MessageCircle, User } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { LoadingState, PageShell, GlassSheet, PageHeader, ConversationCard, ConsultationCard } from "@/components/ui/ssot";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useArtistReferral } from "@/features/chat/useArtistReferral";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { useInboxRequests } from "@/features/chat/hooks/useInboxRequests";
import { toast } from "sonner";
import { useConversations } from "@/hooks/useConversations";

export default function Conversations() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Handle referrals
  useArtistReferral();

  // Mutation to create/get conversation for fallback navigation
  const createConversation = trpc.conversations.getOrCreate.useMutation();

  // Use centralized hook (SSOT)
  const { data: conversations, isLoading, isPending } = useConversations();

  // Consolidate inbox requests (Leads + Consultations) via SSOT Hook
  const { requestItems, isLoading: requestsLoading, isArtist } = useInboxRequests();

  const [isConsultationsOpen, setIsConsultationsOpen] = useState(true);


  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  // Combined loading state: Auth loading OR Query loading (initial fetch) OR Requests loading
  // FIX: Include requestsLoading to prevent race condition on Android
  const isPageLoading = loading || (isLoading && !conversations) || requestsLoading;

  if (isPageLoading) {
    return <LoadingState message="Loading messages..." fullScreen />;
  }

  const unreadTotal = conversations?.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0) || 0;

  return (
    <PageShell>
      {/* 1. Page Header - Left aligned, no icons */}
      <PageHeader title="Messages" />

      {/* 2. Top Context Area (Non-interactive) */}
      <div className={cn(tokens.spacing.containerPadding, "pt-4 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80")}>
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

      {/* 3. Content Container (was GlassSheet) */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Sheet Header (Optional Actions) */}
        <div className="shrink-0 pt-6 pb-2 px-6 border-b border-white/5 flex justify-end">
          {/* Could put Search here later */}
          {!isArtist && (
            <Button
              size="sm"
              variant="ghost"
              className={cn(tokens.button.ghost, "text-muted-foreground hover:text-foreground gap-2")}
              onClick={() => setLocation("/consultations")}
            >
              <Calendar className="w-4 h-4" />
              New Request
            </Button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 w-full h-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y will-change-scroll transform-gpu">
          <div className="pb-32 max-w-lg mx-auto space-y-4 min-h-[50vh]">

            {/* Consultation Requests from Leads AND Consultations */}
            {isArtist && (
              <Collapsible
                open={isConsultationsOpen}
                onOpenChange={setIsConsultationsOpen}
                className="mb-6 space-y-2"
              >
                <CollapsibleTrigger className="w-full group">
                  <div className="flex items-center justify-between w-full px-2 py-1">
                    <h2 className={cn(tokens.header.sectionTitle, "text-left")}>
                      Consultation Requests ({requestItems.length})
                    </h2>
                    {isConsultationsOpen ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    )}
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3">
                  {requestItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2 py-4">No pending requests</p>
                  ) : (
                    requestItems.map((item) => (
                      <ConsultationCard
                        key={`${item.type}-${item.id}`}
                        name={item.name}
                        subject={item.subject}
                        description={item.description}
                        onClick={async () => {
                          console.log("Card clicked:", item);
                          if (item.leadId) {
                            console.log("Navigating to /lead/" + item.leadId);
                            setLocation(`/lead/${item.leadId}`);
                            return;
                          }

                          if (item.data?.conversationId) {
                            console.log("Navigating to /chat/" + item.data.conversationId);
                            setLocation(`/chat/${item.data.conversationId}?consultationId=${item.id}`);
                            return;
                          }

                          // Fallback: search for conversation with this user
                          if (item?.data?.clientId && user) {
                            try {
                              const conv = await createConversation.mutateAsync({
                                artistId: user.id,
                                clientId: item.data.clientId as string // Assert string if check passed
                              });

                              if (conv) {
                                setLocation(`/chat/${conv.id}`);
                                return;
                              }
                            } catch (err) {
                              console.error("Failed to get/create conversation fallback", err);
                            }
                          }

                          console.warn("No leadId or conversationId found for item:", item);
                          toast.error("Could not open request details");
                        }}
                      />
                    ))
                  )}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Conversations List */}
            {conversations && conversations.length > 0 ? (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <ConversationCard
                    key={conv.id}
                    name={conv.otherUser?.name || "Unknown User"}
                    avatar={conv.otherUser?.avatar}
                    timestamp={new Date(conv.createdAt!).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                    unreadCount={conv.unreadCount}
                    onClick={() => setLocation(`/chat/${conv.id}`)}
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
    </PageShell>
  );
}

