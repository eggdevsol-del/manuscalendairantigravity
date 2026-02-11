import { LoadingState, PageShell, PageHeader } from "@/components/ui/ssot";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useArtistReferral } from "@/features/chat/useArtistReferral";
import { useInboxRequests } from "@/features/chat/hooks/useInboxRequests";
import { useConversations } from "@/hooks/useConversations";
import { ConversationsList } from "@/features/chat/components/ConversationsList";
import { useAuth } from "@/_core/hooks/useAuth";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { MessageCircle, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { tokens } from "@/ui/tokens";
import { Button } from "@/components/ui";

export default function Conversations() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  // Handle referrals
  useArtistReferral();

  // Mutation to create/get conversation for fallback navigation (now in list)
  // const createConversation = trpc.conversations.getOrCreate.useMutation();

  // Use centralized hook (SSOT) - Used for loading state check
  const { data: conversations, isLoading, isPending } = useConversations();

  // Mutations moved to ConversationsList
  // const updateLeadStatus = trpc.funnel.updateLeadStatus.useMutation();
  // const updateConsultation = trpc.consultations.update.useMutation();
  // const utils = trpc.useUtils(); // For invalidating queries (v11)

  // Consolidate inbox requests (Leads + Consultations) via SSOT Hook
  const { requestItems, isLoading: requestsLoading, isArtist } = useInboxRequests();

  // Handle Mark As Read logic moved to ConversationsList


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

  // const unreadTotal = conversations?.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0) || 0;

  return (
    <PageShell>
      {/* Mobile: Full List */}
      <div className="md:hidden h-full">
        <PageHeader title="Messages" />
        <ConversationsList />
      </div>

      {/* iPad/Desktop: Split View */}
      <div className="hidden md:flex h-full overflow-hidden">
        {/* Left Panel: List (350px fixed or 30%) */}
        <div className="w-[350px] border-r border-white/5 flex flex-col h-full bg-background/50 backdrop-blur-xl">
          <PageHeader title="Messages" />
          <ConversationsList className="bg-transparent" />
        </div>

        {/* Right Panel: Placeholder */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/5">
          <Empty>
            <EmptyMedia>
              <MessageCircle className="w-16 h-16 text-muted-foreground/20" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Select a conversation</EmptyTitle>
              <EmptyDescription>
                Choose a message from the list to start chatting
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </div>
    </PageShell>
  );
}

