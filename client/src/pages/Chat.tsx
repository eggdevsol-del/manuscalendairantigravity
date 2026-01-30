import { Button, Checkbox, Dialog, DialogTitle, Input, Label, ScrollArea, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { ModalShell } from "@/components/ui/overlays/modal-shell";
// import { SheetShell } from "@/components/ui/overlays/sheet-shell"; // REMOVED
import { useChatController } from "@/features/chat/useChatController";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { BottomSheet, LoadingState, PageShell } from "@/components/ui/ssot";
import { BookingWizard } from "@/features/booking/BookingWizard";
// ProposalSheet removed - not needed
import { ClientProfileSheet } from "@/features/chat/ClientProfileSheet";
import { ProjectProposalMessage } from "@/components/chat/ProjectProposalMessage";
import { ProjectProposalModal } from "@/features/chat/components/ProjectProposalModal";
import { ArrowLeft, Send, User, Phone, Mail, Cake, ImagePlus, Pin, PinOff, Calendar, FileText, Zap, MessageCircle, Image as ImageIcon, Camera } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { useRegisterBottomNavRow } from "@/contexts/BottomNavContext";
import { QuickActionsRow, ChatAction } from "@/features/chat/components/QuickActionsRow";
import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const conversationId = parseInt(id || "0");
  const [, setLocation] = useLocation();

  const {
    user,
    authLoading,
    conversation,
    convLoading,
    messages,
    messagesLoading,
    quickActions,
    artistSettings,
    availableServices,

    // State
    messageText, setMessageText,
    showClientInfo, setShowClientInfo,
    showBookingCalendar, setShowBookingCalendar,
    showProjectWizard, setShowProjectWizard,
    projectStartDate, setProjectStartDate,

    // Derived
    isArtist,
    otherUserName,
    consultationData,
    calendarDays,

    // Handlers
    handleSendMessage,
    handleImageUpload,
    handleQuickAction,
    handleClientConfirmDates,
    handleClientAcceptProposal,
    handleArtistBookProject,
    nextMonth,
    prevMonth,

    // Mutations used for loading states
    sendMessageMutation,
    pinConsultationMutation,
    bookProjectMutation,
    uploadingImage,

    // Refs
    viewportRef,
    handleScroll,
    // (Removed scrollRef, bottomRef, hasScrolledRef)

    // Client Confirm State
    showClientConfirmDialog, setShowClientConfirmDialog,
    clientConfirmDates, setClientConfirmDates,

    // Proposal Modal
    selectedProposal, setSelectedProposal,
    handleViewProposal,

  } = useChatController(conversationId);

  // Fetch client media for the media quick links bar
  const clientId = conversation?.otherUser?.id;
  const { data: mediaData } = trpc.conversations.getClientMedia.useQuery(
    { clientId: clientId || '' },
    {
      enabled: isArtist && !!clientId,
      staleTime: 30000,
    }
  );

  // State for selected image lightbox
  const [selectedMediaImage, setSelectedMediaImage] = useState<string | null>(null);

  // Stable callback references for quick actions
  const handleBookClick = useCallback(() => {
    console.log('[Chat] Book button clicked');
    setShowBookingCalendar(true);
  }, [setShowBookingCalendar]);

  // Register Bottom Nav Contextual Row (Quick Actions + System Actions)
  const quickActionsRow = useMemo(() => {
    const isAuthorized = user?.role === 'artist' || user?.role === 'admin';

    // System Actions (Fixed) - Only for Artists
    const systemActions: ChatAction[] = isAuthorized ? [
      {
        id: 'chat.book',
        label: 'Book',
        icon: Calendar,
        onClick: handleBookClick,
        highlight: true
      }
    ] : [];

    // User Configured Actions
    const userActions: ChatAction[] = isAuthorized && quickActions ? quickActions.map(qa => {
      // Icon Mapping
      let Icon = Zap;
      if (qa.actionType === 'find_availability') Icon = FileText;
      else if (qa.actionType === 'deposit_info') Icon = Send;

      return {
        id: qa.id,
        label: qa.label,
        icon: Icon,
        onClick: () => handleQuickAction(qa),
        highlight: false
      };
    }) : [];

    // Validated Composition
    const allActions = [...systemActions, ...userActions];

    if (allActions.length === 0) {
      return null;
    }

    return (
      <QuickActionsRow actions={allActions} />
    );
  }, [user?.role, quickActions, handleQuickAction, handleBookClick]);

  useRegisterBottomNavRow("chat-actions", quickActionsRow);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (authLoading || convLoading || messagesLoading) {
    return <LoadingState message="Loading..." fullScreen />;
  }

  if (!conversation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Conversation not found</p>
          <Button onClick={() => setLocation("/conversations")} className="mt-4">
            Back to Messages
          </Button>
        </div>
      </div>
    );
  }

  // Check if there's any media to show
  const hasMedia = mediaData && mediaData.totalCount > 0;
  const allMediaImages = [
    ...(mediaData?.referenceImages || []),
    ...(mediaData?.bodyPlacementImages || [])
  ];

  return (
    <PageShell className="selection:bg-primary/20">

      {/* Fixed Header & Consultation Pin */}
      <div className="flex-none z-50 bg-background/80 backdrop-blur-xl border-b border-white/5 shadow-sm supports-[backdrop-filter]:bg-background/60">
        <header className="mobile-header px-4 py-3 pb-4">
          <div className="flex items-center justify-between">

            {/* Left Group: Back + Avatar + Name */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-primary/10 -ml-2 shrink-0"
                onClick={() => setLocation("/conversations")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <div
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer group"
                onClick={() => isArtist && setShowClientInfo(true)}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden flex-shrink-0 ring-2 ring-background shadow-md transition-transform group-active:scale-95">
                  {conversation.otherUser?.avatar ? (
                    <img src={conversation.otherUser.avatar} alt={otherUserName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white font-semibold">
                      {otherUserName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="font-bold text-xl leading-tight truncate text-foreground group-hover:text-primary transition-colors">{otherUserName}</h1>
                  <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Online
                  </p>
                </div>
              </div>
            </div>

            {/* Right Group: Empty (Spacer for balance if needed, or just nothing) */}
            {/* Removing all right-side icons as per strict rules */}
            <div className="w-9" />
          </div>
        </header>

        {/* Media Quick Links Bar - Shows when client has uploaded media */}
        {isArtist && hasMedia && (
          <div className="px-4 py-2 border-t border-white/5 bg-muted/30 flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
              Media
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {allMediaImages.slice(0, 6).map((img, index) => (
                <button
                  key={`media-${index}`}
                  onClick={() => setSelectedMediaImage(img.url)}
                  className="w-8 h-8 rounded-md overflow-hidden bg-muted/50 border border-white/10 hover:border-primary/50 transition-colors shrink-0"
                >
                  <img
                    src={img.url}
                    alt={`Media ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
              {allMediaImages.length > 6 && (
                <button
                  onClick={() => setShowClientInfo(true)}
                  className="w-8 h-8 rounded-md bg-muted/50 border border-white/10 hover:border-primary/50 transition-colors flex items-center justify-center shrink-0"
                >
                  <span className="text-xs font-medium text-muted-foreground">+{allMediaImages.length - 6}</span>
                </button>
              )}
              <button
                onClick={() => setShowClientInfo(true)}
                className="ml-1 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors flex items-center gap-1 shrink-0"
              >
                <ImageIcon className="w-3 h-3 text-primary" />
                <span className="text-xs font-medium text-primary">View All</span>
              </button>
            </div>
          </div>
        )}

        {/* Consultation Details & Pinning */}
        {consultationData && (
          <div className="px-4 py-3 border-t border-white/5 bg-accent/5 backdrop-blur-sm flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm flex items-center gap-2 text-foreground/90">
                {consultationData.subject}
                {conversation?.pinnedConsultationId === consultationData.id && (
                  <Pin className="w-3 h-3 text-primary fill-primary" />
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{consultationData.description}</p>
              {consultationData.preferredDate && (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mt-1 font-medium">
                  {new Date(consultationData.preferredDate as any).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
            {isArtist && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                onClick={() => {
                  const isPinned = conversation?.pinnedConsultationId === consultationData.id;
                  pinConsultationMutation.mutate({
                    conversationId,
                    consultationId: isPinned ? null : consultationData.id
                  });
                }}
              >
                {conversation?.pinnedConsultationId === consultationData.id ? (
                  <PinOff className="w-4 h-4" />
                ) : (
                  <Pin className="w-4 h-4" />
                )}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 relative">
        <ScrollArea
          className="h-full px-4 py-4"
          viewportRef={viewportRef}
          onScroll={handleScroll}
        >
          <div className="space-y-4 pb-[182px]">
            {messages && messages.length > 0 ? (
              messages.map((message) => {
                const isOwn = message.senderId === user?.id;
                const isImage = message.messageType === "image";

                let metadata: any = null;
                try {
                  metadata = message.metadata ? JSON.parse(message.metadata) : null;
                } catch (e) { }

                const isProjectProposal = metadata?.type === "project_proposal";
                const isClientConfirmation = metadata?.type === "project_client_confirmation";

                return (
                  <div
                    key={message.id}
                    id={`message-${message.id}`}
                    className={`flex ${isProjectProposal ? "justify-center w-full" : (isOwn ? "justify-end" : "justify-start")}`}
                  >
                    {isProjectProposal ? (
                      <div className="w-full flex justify-center">
                        <ProjectProposalMessage
                          metadata={metadata}
                          isArtist={isArtist}
                          onViewDetails={() => handleViewProposal(message, metadata)}
                        />
                      </div>
                    ) : (
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-2 overflow-hidden ${isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                          }`}
                      >
                        {isImage ? (
                          <div className="space-y-2">
                            <img
                              src={message.content}
                              alt="Uploaded image"
                              className="rounded-lg max-w-full h-auto cursor-pointer"
                              onClick={() => window.open(message.content, "_blank")}
                              style={{ maxHeight: "300px" }}
                            />
                          </div>
                        ) : (
                          <p className="text-sm break-words whitespace-pre-wrap overflow-wrap-anywhere">{message.content}</p>
                        )}
                        <p className="text-xs opacity-70 mt-1">
                          {message.createdAt && new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>

                        {isArtist && isClientConfirmation && (
                          <Button
                            className="mt-2 w-full bg-background/20 hover:bg-background/30 text-inherit border-none"
                            size="sm"
                            onClick={() => handleArtistBookProject(metadata)}
                            disabled={bookProjectMutation.isPending}
                          >
                            {bookProjectMutation.isPending ? "Booking..." : "Confirm & Book"}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon" className="w-16 h-16 rounded-full bg-white/5">
                    <MessageCircle className="w-8 h-8" />
                  </EmptyMedia>
                  <EmptyTitle>No messages yet</EmptyTitle>
                  <EmptyDescription>Start the conversation</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
            {/* Removed bottomRef div */}
          </div>
        </ScrollArea>
      </div>

      {/* Floating Bottom Input & Actions */}
      {/* Input Bar */}
      <div className="fixed bottom-[110px] left-4 right-4 z-[60]">
        <div className="relative">
          <div className="flex items-center gap-2 p-2 rounded-2xl bg-muted/80 backdrop-blur-xl border border-white/10 shadow-lg">
            <label className="cursor-pointer p-2 hover:bg-white/10 rounded-xl transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploadingImage}
              />
              <ImagePlus className={cn("w-5 h-5", uploadingImage ? "text-muted-foreground animate-pulse" : "text-muted-foreground hover:text-foreground")} />
            </label>
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sendMessageMutation.isPending}
              size="icon"
              className="rounded-xl bg-primary hover:bg-primary/90 transition-all shadow-md"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Booking Wizard - Uses existing SSOT component with its own FullScreenSheet */}
      <BookingWizard
        isOpen={showBookingCalendar}
        onClose={() => setShowBookingCalendar(false)}
        conversationId={conversationId}
        artistServices={availableServices || []}
        artistSettings={artistSettings}
        onBookingSuccess={() => {
          setShowBookingCalendar(false);
          toast.success('Booking proposal sent!');
        }}
      />

      {/* Client Confirm Dates Dialog */}
      <BottomSheet
        isOpen={showClientConfirmDialog}
        onClose={() => setShowClientConfirmDialog(false)}
        title="Confirm Your Availability"
      >
        <DialogTitle className="sr-only">Confirm Your Availability</DialogTitle>
        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Please confirm the dates you're available for your tattoo sessions.
          </p>
          <div className="space-y-2">
            <Label>Preferred Dates (comma separated)</Label>
            <Input
              placeholder="e.g., Jan 15, Jan 22, Feb 5"
              value={clientConfirmDates.map(d => d.date).join(', ')}
              onChange={(e) => {
                const dates = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                setClientConfirmDates(dates.map(date => ({ date, selected: true })));
              }}
            />
          </div>
          <Button
            className="w-full"
            onClick={() => handleClientConfirmDates()}
          >
            Confirm Dates
          </Button>
        </div>
      </BottomSheet>

      {/* Quick Actions Modal */}
      <BottomSheet
        isOpen={false}
        onClose={() => { }}
        title="Quick Actions"
      >
        <DialogTitle className="sr-only">Quick Actions</DialogTitle>
        <div className="grid grid-cols-2 gap-3 p-4">
          {quickActions?.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2"
              onClick={() => handleQuickAction(action)}
            >
              <Zap className="w-5 h-5" />
              <span className="text-xs">{action.label}</span>
            </Button>
          ))}
        </div>
      </BottomSheet>
      <ClientProfileSheet
        isOpen={showClientInfo}
        onClose={() => setShowClientInfo(false)}
        client={conversation?.otherUser}
      />
      <ProjectProposalModal
        isOpen={!!selectedProposal}
        onClose={() => setSelectedProposal(null)}
        metadata={selectedProposal?.metadata}
        isArtist={isArtist}
        onAccept={(appliedPromotion) => handleClientAcceptProposal(selectedProposal?.message, appliedPromotion)}
        onReject={() => setSelectedProposal(null)}
        isPendingAction={false}
        artistId={conversation?.artistId}
      />

      {/* Media Image Lightbox */}
      {selectedMediaImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedMediaImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-sm px-3 py-1 rounded-lg bg-white/10"
            onClick={() => setSelectedMediaImage(null)}
          >
            Close
          </button>
          <img
            src={selectedMediaImage}
            alt="Full size"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </PageShell>
  );
}
