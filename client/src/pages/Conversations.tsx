
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronDown, ChevronRight, MessageCircle, User } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { LoadingState, PageShell, GlassSheet, PageHeader } from "@/components/ui/ssot";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export default function Conversations() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: conversations, isLoading } = trpc.conversations.list.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 10000,
  });

  // Get pending consultation requests for artists
  const { data: pendingConsults } = trpc.consultations.list.useQuery(undefined, {
    enabled: !!user && (user.role === 'artist' || user.role === 'admin'),
    refetchInterval: 10000,
  });

  const [isConsultationsOpen, setIsConsultationsOpen] = useState(true);

  const createConversationMutation = trpc.conversations.getOrCreate.useMutation({
    onSuccess: (conversation) => {
      if (conversation) {
        setLocation(`/chat/${conversation.id}`);
      }
    },
  });

  const utils = trpc.useUtils();
  const updateConsultationMutation = trpc.consultations.update.useMutation({
    onMutate: async (variables) => {
      // Optimistic update
      await utils.consultations.list.cancel();
      const previousData = utils.consultations.list.getData();

      if (previousData) {
        // Optimistically mark as viewed
        utils.consultations.list.setData(undefined, previousData.map(c =>
          c.id === variables.id ? { ...c, viewed: 1 } : c
        ));
      }
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback
      if (context?.previousData) {
        utils.consultations.list.setData(undefined, context.previousData);
      }
    },
    onSettled: () => {
      utils.consultations.list.invalidate();
    }
  });

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
      {/* 1. Page Header (Fixed) */}
      <PageHeader variant="transparent" className="justify-between">
        <h1 className="text-2xl font-bold text-foreground">Messages</h1>
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
        </div>
      </PageHeader>

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

            {/* Pending Consultations (Collapsible) */}
            {isArtist && pendingConsults && pendingConsults.filter(c => c.status === 'pending' && !c.viewed).length > 0 && (
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

                <CollapsibleContent className="space-y-2">
                  {pendingConsults
                    .filter(c => c.status === 'pending' && !c.viewed)
                    .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
                    .map((consult) => (
                      <Card
                        key={consult.id}
                        className="p-5 cursor-pointer transition-all duration-300 border-0 bg-gradient-to-r from-primary/20 to-primary/5 backdrop-blur-xl rounded-[2rem] relative group border border-white/10 hover:border-primary/30 shadow-lg"
                        onClick={async () => {
                          updateConsultationMutation.mutate({ id: consult.id, viewed: 1 });
                          try {
                            const result = await createConversationMutation.mutateAsync({
                              clientId: consult.clientId,
                              artistId: consult.artistId,
                            });
                            if (result) {
                              setLocation(`/chat/${result.id}?consultationId=${consult.id}`);
                            }
                          } catch (e) {
                            console.error("Error clicking card", e);
                          }
                        }}
                      >
                        <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className="flex items-center justify-between relative z-10">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]" />
                              <h3 className="font-bold text-white text-base truncate pr-2">{consult.subject} - {consult.client?.name || 'Client'}</h3>
                            </div>
                            <p className="text-sm text-white/60 line-clamp-2 leading-relaxed pl-4">{consult.description}</p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                            <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white" />
                          </div>
                        </div>
                      </Card>
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
                {conversations.map((conv) => (
                  <Card
                    key={conv.id}
                    className="group relative p-4 pr-6 cursor-pointer border-0 bg-white/5 backdrop-blur-md rounded-[2rem] transition-all duration-300 hover:bg-white/10 hover:scale-[1.02] border border-white/5 hover:border-white/10"
                    onClick={() => setLocation(`/chat/${conv.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 overflow-hidden shadow-lg ring-2 ring-white/5">
                        {conv.otherUser?.avatar ? (
                          <img src={conv.otherUser.avatar} alt={conv.otherUser.name || "User"} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-xl">
                            {conv.otherUser?.name?.charAt(0).toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex justify-between items-center mb-0.5">
                          <h3 className="font-bold text-white text-lg truncate tracking-tight">
                            {conv.otherUser?.name || "Unknown User"}
                          </h3>
                          <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">
                            {(() => {
                              const dateStr = conv.lastMessageAt || conv.createdAt;
                              if (!dateStr) return "";
                              const date = new Date(dateStr as any);
                              return isNaN(date.getTime()) ? "" : date.toLocaleDateString();
                            })()}
                          </p>
                        </div>

                        <p className="text-sm font-medium text-white/50 truncate flex items-center gap-2">
                          {conv.unreadCount > 0 ? <span className="w-2 h-2 rounded-full bg-primary inline-block" /> : null}
                          Click to view messages
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 self-center">
                        {conv.unreadCount > 0 && (
                          <div className="bg-primary text-white shadow-[0_0_10px_rgba(var(--primary),0.5)] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                            {conv.unreadCount}
                          </div>
                        )}
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <MessageCircle className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

      </GlassSheet>
    </PageShell>
  );
}
