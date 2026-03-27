import { useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useChatState } from "./hooks/useChatState";
import { useChatData } from "./hooks/useChatData";
import { useChatMutations } from "./hooks/useChatMutations";
import { trpc } from "@/lib/trpc";
import { loggy } from "../../lib/loggy";

export function useChatController(conversationId: number) {
  // 1. Initialize State
  const state = useChatState();
  const {
    messageText,
    setMessageText,
    viewportRef,
    scrollIntent,
    setScrollIntent,
    scrollToBottom,
    handleScroll,
    uploadingImage,
    setUploadingImage,
    showClientConfirmDialog,
    setShowClientConfirmDialog,
    clientConfirmDates,
    clientConfirmMessageId,
    clientConfirmMetadata,
    selectedDates,
    currentMonth,
    showProjectWizard,
    setShowProjectWizard,
    showBookingCalendar,
    setShowBookingCalendar,
    projectStartDate,
    setProjectStartDate,
    selectedProposal,
    setSelectedProposal,
    calendarDays,
    nextMonth,
    prevMonth,
    setClientConfirmDates,
  } = state;

  // 2. Initialize Data
  const data = useChatData(conversationId);
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
    consultationData,
    paramConsultationId,
    isArtist,
    otherUserId,
    otherUserName,
  } = data;

  // 3. Initialize Mutations
  const mutations = useChatMutations(conversationId, user, {
    setMessageText,
    setShowClientConfirmDialog,
    setUploadingImage,
  });
  const {
    sendMessageMutation,
    uploadImageMutation,
    bookProjectMutation,
    updateMetadataMutation,
    pinConsultationMutation,
    markAsReadMutation,
    deleteProposalMutation,
    utils,
  } = mutations;

  // -- Handlers --
  // These handlers glue State, Data, and Mutations together.

  const handleSendMessage = useCallback(() => {
    if (!messageText.trim()) return;

    // Optimistic scroll enforcement
    setScrollIntent("AUTO_FOLLOW"); // Ensure we follow own message
    scrollToBottom("smooth");

    sendMessageMutation.mutate({
      conversationId,
      content: messageText,
      messageType: "text",
      consultationId: paramConsultationId
        ? parseInt(paramConsultationId)
        : undefined,
    });
  }, [
    messageText,
    conversationId,
    paramConsultationId,
    sendMessageMutation.mutate,
    scrollToBottom,
    setScrollIntent,
  ]);

  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Image size must be less than 10MB");
        return;
      }

      setScrollIntent("AUTO_FOLLOW"); // Force follow on upload
      scrollToBottom("smooth");

      setUploadingImage(true);
      toast.info("Uploading image...");
      const reader = new FileReader();
      reader.onload = async e => {
        const base64Data = e.target?.result as string;
        uploadImageMutation.mutate({
          fileName: file.name,
          fileData: base64Data,
          contentType: file.type,
        });
      };
      reader.onerror = () => {
        toast.error("Failed to read image file");
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    },
    [
      uploadImageMutation.mutate,
      setUploadingImage,
      scrollToBottom,
      setScrollIntent,
    ]
  );

  const handleQuickAction = useCallback(
    (action: any) => {
      if (action.actionType === "find_availability") {
        setShowProjectWizard(true);
        return;
      }

      // For send_text, custom, and deposit_info, we just send the content as a message
      if (["send_text", "custom", "deposit_info"].includes(action.actionType)) {
        setScrollIntent("AUTO_FOLLOW");
        scrollToBottom("smooth");

        sendMessageMutation.mutate({
          conversationId,
          content: action.content,
          messageType: "text",
        });
      }
    },
    [
      conversationId,
      sendMessageMutation.mutate,
      setShowProjectWizard,
      scrollToBottom,
      setScrollIntent,
    ]
  );

  const handleClientConfirmDates = useCallback(async () => {
    if (!clientConfirmMessageId || !clientConfirmMetadata) return;

    const selectedDateStrings = clientConfirmDates
      .filter(d => d.selected)
      .map(d => d.date);

    if (selectedDateStrings.length === 0) {
      toast.error("Please select at least one date");
      return;
    }

    const message = `I confirm the following dates:\n\n${selectedDateStrings.map(d => format(new Date(d), "PPP p")).join("\n")}`;

    const metadata = JSON.stringify({
      type: "project_client_confirmation",
      confirmedDates: selectedDateStrings,
      originalMessageId: clientConfirmMessageId,
      serviceName: clientConfirmMetadata.serviceName,
      price: clientConfirmMetadata.price,
    });

    setScrollIntent("AUTO_FOLLOW");
    scrollToBottom("smooth");

    sendMessageMutation.mutate({
      conversationId,
      content: message,
      messageType: "text",
      metadata,
    });

    setShowClientConfirmDialog(false);
    toast.success("Dates confirmed!");
  }, [
    clientConfirmMessageId,
    clientConfirmMetadata,
    clientConfirmDates,
    conversationId,
    sendMessageMutation.mutate,
    setShowClientConfirmDialog,
    scrollToBottom,
    setScrollIntent,
  ]);

  const redeemPromotionMutation = trpc.promotions.redeemPromotion.useMutation();
  const redeemMutationMutateAsync = redeemPromotionMutation.mutateAsync;

  const handleClientAcceptProposal = useCallback(
    (
      message: any,
      appliedPromotion?: {
        id: number;
        discountAmount: number;
        finalAmount: number;
      }
    ) => {
      const metadata = selectedProposal?.metadata;
      if (!metadata) return;

      if (!metadata.proposedDates && !metadata.dates) return;
      const bookingDates = metadata.dates || metadata.proposedDates || [];

      if (!Array.isArray(bookingDates) || bookingDates.length === 0) {
        toast.error("No dates found in proposal");
        return;
      }

      // Send plain text message indicating acceptance
      const acceptMessage = appliedPromotion
        ? `I accept the project proposal for ${metadata.serviceName}. (Promotion applied: -$${(appliedPromotion.discountAmount / 100).toFixed(2)})`
        : `I accept the project proposal for ${metadata.serviceName}. I am ready to upload my deposit remittance.`;

      sendMessageMutation.mutate({
        conversationId,
        content: acceptMessage,
        messageType: "text",
      });

      // We still update the metadata on the server (for discount tracking), 
      // but NOT the status! Status remains "pending" until deposit paid.
      const dbMetadata = JSON.stringify({
        ...metadata,
        discountApplied: !!appliedPromotion,
        discountAmount: appliedPromotion?.discountAmount,
        finalAmount: appliedPromotion?.finalAmount,
        promotionName: appliedPromotion ? "Promotion" : undefined,
        appliedPromotion: appliedPromotion
          ? {
            id: appliedPromotion.id,
            discountAmount: appliedPromotion.discountAmount,
            finalAmount: appliedPromotion.finalAmount,
          }
          : undefined,
      });

      updateMetadataMutation.mutate({
        messageId: message?.id || selectedProposal?.message?.id,
        metadata: dbMetadata,
      });

      // LOCALLY update the state to "accepted" so the UI immediately shows the deposit flow.
      // If the user exits before paying, it reverts to "pending" next load.
      const localMetadata = JSON.stringify({
        ...JSON.parse(dbMetadata),
        status: "accepted",
      });

      // No longer calling bookProjectMutation because pending appointments are already created on send!
      // We will only confirm the appointments when the artist verifies the uploaded receipt.

      if (appliedPromotion && metadata?.appointmentIds?.[0]) {
        try {
          redeemPromotionMutation.mutateAsync({
            promotionId: appliedPromotion.id,
            appointmentId: metadata.appointmentIds[0],
            originalAmount: (metadata.price || 0) * 100,
          });
        } catch (error) {
          console.error("Failed to redeem:", error);
        }
      }

      setScrollIntent("AUTO_FOLLOW");
      scrollToBottom("smooth");
      // Do NOT set selectedProposal to null! Keep it open so they see the deposit UI.
      // We manually update the selectedProposal state in-memory so the UI updates instantly:
      setSelectedProposal({
        message: message || selectedProposal?.message,
        metadata: JSON.parse(localMetadata)
      });
    },
    [
      conversationId,
      selectedProposal?.message?.id,
      bookProjectMutation.mutate,
      updateMetadataMutation.mutate,
      sendMessageMutation.mutate,
      redeemMutationMutateAsync,
      scrollToBottom,
      setScrollIntent,
      setSelectedProposal,
    ]
  );

  const handleRevokeProposal = undefined; // Removed in favor of consolidated handleCancelProposal

  const handleViewProposal = useCallback(
    (message: any, metadata: any) => {
      setSelectedProposal({ message, metadata });
    },
    [setSelectedProposal]
  );

  const handleCancelProposal = useCallback(
    (message: any, metadata: any) => {
      if (!message?.id) return;

      if (
        window.confirm(
          "Are you sure you want to revoke this proposal? This will cancel the associated appointment."
        )
      ) {
        deleteProposalMutation.mutate(
          {
            messageId: message.id,
          },
          {
            onSuccess: () => {
              setSelectedProposal(null);
            },
          }
        );
      }
    },
    [deleteProposalMutation.mutate, setSelectedProposal]
  );

  const handleArtistBookProject = useCallback(
    (metadata: any) => {
      if (!metadata.confirmedDates || !metadata.serviceName) return;

      const appointments = metadata.confirmedDates.map((dateStr: string) => {
        const startTime = new Date(dateStr);
        return {
          startTime,
          endTime: new Date(startTime.getTime() + 60 * 60 * 1000), // Default 1 hr if missing
          title: metadata.serviceName,
          description: "Project Booking",
          serviceName: metadata.serviceName,
          price: metadata.price,
          depositAmount: 0,
        };
      });

      bookProjectMutation.mutate({
        conversationId,
        appointments,
      });
    },
    [conversationId, bookProjectMutation.mutate]
  );

  // -- Effects --

  // Auto-Scroll Effect
  useEffect(() => {
    if (messages && messages.length > 0) {
      if (scrollIntent === "AUTO_FOLLOW") {
        setTimeout(() => {
          if (viewportRef.current) {
            const vp = viewportRef.current;
            vp.scrollTo({ top: vp.scrollHeight, behavior: "smooth" });
          }
        }, 100);
      }
    }
  }, [messages, scrollIntent, viewportRef]);

  useEffect(() => {
    if (!messagesLoading && messages?.length) {
      // Initial load check
      // Handlers force auto-follow so this might be redundant but keeping for safety
    }
  }, [messagesLoading, messages]);

  // Mark as read
  useEffect(() => {
    if (conversationId && user) {
      markAsReadMutation.mutate(conversationId, {
        onSuccess: () => {
          utils.consultations.list.invalidate();
        },
      });
    }
  }, [
    conversationId,
    user,
    markAsReadMutation.mutate,
    utils.consultations.list,
  ]);

  const value = useMemo(
    () => ({
      // Data
      user,
      authLoading,
      conversation,
      convLoading,
      messages,
      messagesLoading,
      quickActions,
      artistSettings,
      availableServices,
      consultationData,

      // State (spread)
      ...state,

      // Handlers
      handleSendMessage,
      handleImageUpload,
      handleQuickAction,
      handleClientConfirmDates,
      handleClientAcceptProposal,
      handleArtistBookProject,
      handleViewProposal,
      handleCancelProposal,

      // Mutations
      sendMessageMutation,
      pinConsultationMutation,
      bookProjectMutation,
      updateMetadataMutation,
      uploadImageMutation,

      // Exposed Computed
      isArtist,
      otherUserId,
      otherUserName,
    }),
    [
      // Data
      user?.id,
      authLoading,
      conversation?.id,
      convLoading,
      messages?.length,
      messagesLoading,
      quickActions?.length,
      artistSettings,
      availableServices,
      consultationData?.id,

      // State
      state,

      // Handlers
      handleSendMessage,
      handleImageUpload,
      handleQuickAction,
      handleClientConfirmDates,
      handleClientAcceptProposal,
      handleArtistBookProject,
      handleViewProposal,
      handleCancelProposal,

      // Mutation flags/functions
      sendMessageMutation.mutate,
      sendMessageMutation.isPending,
      pinConsultationMutation.mutate,
      bookProjectMutation.mutate,
      bookProjectMutation.isPending,
      updateMetadataMutation.mutate,
      uploadImageMutation.mutate,
      uploadImageMutation.isPending,

      // Exposed Computed
      isArtist,
      otherUserId,
      otherUserName,
    ]
  );

  return value;
}
