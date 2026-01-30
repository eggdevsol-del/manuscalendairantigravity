
import { useAuth } from "@/_core/hooks/useAuth";
import { Button, Card, Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { Calendar, ChevronDown, ChevronRight, MessageCircle, User } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { LoadingState, PageShell, GlassSheet, PageHeader, ConversationCard, ConsultationCard } from "@/components/ui/ssot";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Conversations() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: conversations, isLoading } = trpc.conversations.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Get new leads from funnel for artists
  const { data: leadsData } = trpc.funnel.getLeads.useQuery(
    { status: 'new', limit: 50, offset: 0 },
    {
      enabled: !!user && (user.role === 'artist' || user.role === 'admin'),
      refetchInterval: 10000,
    }
  );

  const [isConsultationsOpen, setIsConsultationsOpen] = useState(true);

  const createConversationMutation = trpc.conversations.getOrCreate.useMutation({
    onSuccess: (conversation) => {
      if (conversation) {
        setLocation(`/chat/${conversation.id}`);
      }
    },
  });

  const utils = trpc.useUtils();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  // Handle artist referral link
  useEffect(() => {
    if (user && user.role === 'client') {
      const params = new URLSearchParams(window.location.search);
      const refArtistId = params.get('ref');

      if (refArtistId && user.id) {
        createConversationMutation.mutate({
          artistId: refArtistId,
          clientId: user.id
        });
        window.history.replaceState({}, '', '/conversations');
      }
    }
  }, [user]);

  if (loading || isLoading) {
    return <LoadingState message="Loading messages..." fullScreen />;
  }

  const isArtist = user?.role === "artist" || user?.role === "admin";
  const unreadTotal = conversations?.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0) || 0;

  return (
    <PageShell>
      {/* 1. Page Header - Left aligned, no icons */}
      <PageHeader title="Messages" />

      {/* 2. Top Context Area (Non-interactive) */}
      <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[20vh] opacity-80">
        <p className="text-4xl font-light text-foreground/90 tracking-tight">Inbox</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-muted-foreground text-lg font-medium">
            {unreadTotal > 0 ? `${unreadTotal} Unread` : "All caught up"}
          </span>
          {unreadTotal > 0 && (
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
        </div>
      </div>

      {/* 3. Sheet Container */}
      <GlassSheet className="bg-white/5">

        {/* Sheet Header (Optional Actions) */}
        <div className="shrink-0 pt-6 pb-2 px-6 border-b border-white/5 flex justify-end">
          {/* Could put Search here later */}
          {!isArtist && (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground gap-2"
              onClick={() => setLocation("/consultations")}
            >
              <Calendar className="w-4 h-4" />
              New Request
            </Button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 w-full h-full px-4 pt-4 overflow-y-auto mobile-scroll touch-pan-y">
          <div className="pb-32 max-w-lg mx-auto space-y-4">

            {/* Consultation Requests from Funnel */}
            {isArtist && leadsData?.leads && leadsData.leads.length > 0 && (
              <Collapsible
                open={isConsultationsOpen}
                onOpenChange={setIsConsultationsOpen}
                className="mb-6 space-y-2"
              >
                <div className="flex items-center justify-between px-2 mb-3">
                  <h2 className="text-xs font-bold text-muted-foreground tracking-widest uppercase">Consultation Requests</h2>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-8 h-8 p-0 rounded-full hover:bg-white/10 text-muted-foreground">
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isConsultationsOpen ? '' : '-rotate-90'}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent className="space-y-3">
                  {leadsData.leads.map((lead) => (
                    <ConsultationCard
                      key={`lead-${lead.id}`}
                      subject={`${lead.projectType?.replace(/-/g, ' ') || 'New consultation'} - ${lead.clientName}`}
                      clientName={lead.clientName}
                      description={lead.projectDescription || 'No description provided'}
                      isNew={true}
                      onClick={() => {
                        // Navigate to lead detail or create conversation
                        setLocation(`/lead/${lead.id}`);
                      }}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Conversations List */}
            {!conversations || conversations.length === 0 ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="w-20 h-20 rounded-full bg-white/5">
                    <MessageCircle className="w-10 h-10" />
                  </EmptyMedia>
                  <EmptyTitle>No messages yet</EmptyTitle>
                  <EmptyDescription>
                    {isArtist
                      ? "Client inquiries will appear here."
                      : "Start a conversation to book your next session."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-3">
                {conversations.map((conv) => {
                  const dateStr = conv.lastMessageAt || conv.createdAt;
                  let timestamp = "";
                  if (dateStr) {
                    const date = new Date(dateStr as any);
                    timestamp = isNaN(date.getTime()) ? "" : date.toLocaleDateString();
                  }

                  return (
                    <ConversationCard
                      key={conv.id}
                      name={conv.otherUser?.name || "Unknown User"}
                      avatar={conv.otherUser?.avatar}
                      timestamp={timestamp}
                      unreadCount={conv.unreadCount || 0}
                      onClick={() => setLocation(`/chat/${conv.id}`)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </GlassSheet>
    </PageShell>
  );
}
