import { ModalShell } from "@/components/ui/overlays/modal-shell";
// import { SheetShell } from "@/components/ui/overlays/sheet-shell"; // REMOVED
import { useChatController } from "@/features/chat/useChatController";
import { Button } from "@/components/ui/button";
import { BottomSheet, LoadingState } from "@/components/ui/ssot";
import { DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BookingWizard } from "@/features/booking/BookingWizard";
import { ClientProfileSheet } from "@/features/chat/ClientProfileSheet";
import { ProjectProposalMessage } from "@/components/chat/ProjectProposalMessage";
import { ProjectProposalModal } from "@/features/chat/components/ProjectProposalModal";
import { ArrowLeft, Send, User, Phone, Mail, Cake, ImagePlus, Pin, PinOff, Calendar, FileText, Zap, MessageCircle } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { useRegisterBottomNavRow } from "@/contexts/BottomNavContext";
import { QuickActionsRow, ChatAction } from "@/features/chat/components/QuickActionsRow";
import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { useEffect, useRef, useState, useMemo } from "react";
import { toast } from "sonner";

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

  // Register Bottom Nav Contextual Row (Quick Actions + System Actions)
  const quickActionsRow = useMemo(() => {
    const isAuthorized = user?.role === 'artist' || user?.role === 'admin';

    // System Actions (Fixed) - Only for Artists
    const systemActions: ChatAction[] = isAuthorized ? [
      {
        id: 'chat.book',
        label: 'Book',
        icon: Calendar,
        onClick: () => setShowBookingCalendar(true),
        highlight: true
      },
      {
        id: 'chat.proposal',
        label: 'Proposal',
        icon: FileText,
        onClick: () => setShowProjectWizard(true),
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
  }, [quickActions, user?.role, handleQuickAction, setShowBookingCalendar, setShowProjectWizard]);

  useRegisterBottomNavRow("chat", quickActionsRow);

  // Local UI Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Key press handler local (calls hook handler)
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

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden selection:bg-primary/20">

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
          {/* Input Bar */}
          <div className="bg-background/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-[2rem] p-1.5 pl-4 flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9 rounded-full hover:bg-white/10 -ml-2" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
              <ImagePlus className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyUp={handleKeyPress}
              placeholder="Type a message..."
              className="flex-1 bg-transparent border-0 focus-visible:ring-0 px-2 h-10 placeholder:text-muted-foreground/50"
              disabled={uploadingImage}
            />
            <Button size="icon" className="shrink-0 h-10 w-10 rounded-full shadow-md" onClick={handleSendMessage} disabled={!messageText.trim() || sendMessageMutation.isPending || uploadingImage}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <BookingWizard
        isOpen={showProjectWizard}
        onClose={() => setShowProjectWizard(false)}
        conversationId={conversationId}
        artistServices={availableServices}
        onBookingSuccess={() => {
          setShowProjectWizard(false);
        }}
        overlayName="Booking Wizard"
        overlayId="chat.booking_wizard"
      />

      {/* Book Now Calendar Sheet (Gold Standard) */}
      <BottomSheet 
        open={showBookingCalendar} 
        onOpenChange={(open) => !open && setShowBookingCalendar(false)}
        title="Select Date"
      >
            {/* Standard Header */}
            <header className="px-4 py-4 z-10 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="rounded-full bg-white/5 hover:bg-white/10 text-foreground -ml-2" onClick={() => setShowBookingCalendar(false)}>
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <DialogTitle className="text-2xl font-bold text-foreground">Select Date</DialogTitle>
              </div>
            </header>

            {/* Context Area */}
            <div className="px-6 pt-4 pb-8 z-10 shrink-0 flex flex-col justify-center h-[10vh] opacity-80 transition-all duration-300">
              <p className="text-4xl font-light text-foreground/90 tracking-tight">Availability</p>
              <p className="text-sm text-muted-foreground mt-1">Select a start date for this project</p>
            </div>

            {/* Sheet Container */}
            <div className="flex-1 z-20 flex flex-col bg-white/5 backdrop-blur-2xl rounded-t-[2.5rem] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] overflow-hidden relative">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-l from-white/20 to-transparent opacity-50 pointer-events-none" />

              {/* Scrollable Content */}
              <div className="flex-1 w-full h-full px-4 pt-8 overflow-y-auto mobile-scroll touch-pan-y">
                <div className="pb-32 max-w-lg mx-auto space-y-6">

                  {/* Calendar Controls */}
                  <div className="flex items-center justify-between mb-2 px-2">
                    <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-full hover:bg-white/10">
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <span className="font-bold text-lg">{format(new Date(calendarDays.find(d => d.type === 'day')?.date || new Date()), 'MMMM yyyy')}</span>
                    <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-full hover:bg-white/10">
                      <ArrowLeft className="w-4 h-4 rotate-180" />
                    </Button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => (
                      <div key={d} className="h-10 flex items-center justify-center text-xs font-bold text-muted-foreground">{d}</div>
                    ))}
                    {calendarDays.map((item, i) => (
                      <div key={item.key || i} className="aspect-square">
                        {item.type === 'empty' || !item.date ? (
                          <div />
                        ) : (
                          <Button
                            variant="ghost"
                            className={cn(
                              "w-full h-full p-0 font-normal rounded-xl transition-all duration-200",
                              projectStartDate?.toDateString() === item.date.toDateString()
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-100 font-bold"
                                : "hover:bg-white/10 hover:scale-105",
                              item.date.toDateString() === new Date().toDateString() && projectStartDate?.toDateString() !== item.date.toDateString()
                                ? "border border-primary/50 text-primary"
                                : ""
                            )}
                            onClick={() => setProjectStartDate(item.date)}
                          >
                            {item.day}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Confirm Action */}
                  <Button
                    className="w-full shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-semibold mt-4"
                    disabled={!projectStartDate || sendMessageMutation.isPending}
                    onClick={() => {
                      if (!projectStartDate) return;

                      // SSOT Pipeline: Create Proposal 
                      const message = `I have updated the project date to: ${format(projectStartDate, 'EEEE, MMMM do yyyy')}.\n\nPlease confirm if this works for you.`;

                      const metadata = JSON.stringify({
                        type: "project_proposal",
                        serviceName: "Custom Session", // Fallback if no service context
                        serviceDuration: 60,
                        sittings: 1,
                        price: 0, // Fallback
                        totalCost: 0,
                        frequency: "single",
                        dates: [projectStartDate.toISOString()],
                        proposedDates: [projectStartDate.toISOString()],
                        status: 'pending',
                        // Include policies/settings if available in context, otherwise defaults
                      });

                      sendMessageMutation.mutate({
                        conversationId,
                        content: message,
                        messageType: "appointment_request",
                        metadata: metadata
                      });
                      setShowBookingCalendar(false);
                    }}
                  >
                    {sendMessageMutation.isPending ? "Sending..." : "Confirm Date"}
                  </Button>

                </div>
              </div>
            </div>
      </BottomSheet>

      {/* Client Confirm Dialog */}
      <ModalShell
        isOpen={showClientConfirmDialog}
        onClose={() => setShowClientConfirmDialog(false)}
        title="Confirm Project Dates"
        description="Please review and select the dates you can attend."
        footer={<Button onClick={handleClientConfirmDates}>Confirm Dates</Button>}
        className="max-w-md"
        overlayName="Client Confirm"
        overlayId="chat.client_confirm"
      >
        <div className="space-y-2 py-4">
          {clientConfirmDates.map((item, idx) => (
            <div key={idx} className="flex items-center space-x-2 p-2 rounded hover:bg-muted">
              <Checkbox
                id={`date-${idx}`}
                checked={item.selected}
                onCheckedChange={(checked) => {
                  const newDates = [...clientConfirmDates];
                  newDates[idx].selected = checked === true;
                  setClientConfirmDates(newDates);
                }}
              />
              <Label htmlFor={`date-${idx}`} className="cursor-pointer flex-1">
                {format(new Date(item.date), 'PPPP')}
              </Label>
            </div>
          ))}
        </div>
      </ModalShell>

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
        onAccept={() => selectedProposal && handleClientAcceptProposal(selectedProposal.message, selectedProposal.metadata)}
        onReject={() => {
          if (selectedProposal) {
            sendMessageMutation.mutate({
              conversationId,
              content: "I'm sorry, those dates don't work for me.",
              messageType: "text"
            });
            setSelectedProposal(null);
          }
        }}
        isPendingAction={bookProjectMutation.isPending}
      />
    </div>
  );
}
