import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  CalendarSearch,
  Repeat,
  Repeat1,
  Calendar,
  CalendarDays,
  Send,
  ArrowLeft,
  Check,
  Tag,
  MapPin,
  ChevronDown,
  MessageCircle,
  FileSignature,
  Upload,
  CreditCard,
} from "lucide-react";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  formatLocalTime,
  getBusinessTimezone,
} from "../../../../shared/utils/timezone";
import { AppointmentCheckInModal } from "@/components/modals/AppointmentCheckInModal";
import { EditBookingModal } from "@/components/modals/EditBookingModal";
import type { CheckInPhase } from "@/features/appointments/useAppointmentCheckIn";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { tokens } from "@/ui/tokens";
import { InlineFormSigning } from "./components/InlineFormSigning";

type BookingStep =
  | "artist"
  | "client"
  | "service"
  | "frequency"
  | "custom_dates"
  | "review"
  | "success";

interface ProposalData {
  metadata: any;
  message: any;
}

interface BookingWizardContentProps {
  conversationId?: number;
  artistServices: any[];
  artistSettings?: any;
  isArtist: boolean;
  onBookingSuccess: () => void;
  onClose: () => void;
  selectedProposal?: ProposalData | null;
  selectedAppointmentRaw?: any;
  clientNameOverride?: string;
  onAcceptProposal?: (appliedPromotion?: {
    id: number;
    discountAmount: number;
    finalAmount: number;
  }) => void;
  onRejectProposal?: () => void;
  onCancelProposal?: () => void;
  onUpdateProposalState?: (newMetadata: any) => void;
  isPendingProposalAction?: boolean;
  isLoadingProposal?: boolean;
  artistId?: string;
  showGoToChat?: boolean;
  onGoToChat?: () => void;
  initialDate?: Date;
}

function PolicyDropdown({
  label,
  artistId,
  policyType,
  depositAmount,
  totalCost,
}: {
  label: string;
  artistId: string;
  policyType: "cancellation" | "deposit";
  depositAmount?: number | null;
  totalCost?: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: policy } = trpc.policies.getByType.useQuery(
    { artistId, policyType },
    { enabled: !!artistId }
  );

  const fallbackContent =
    policyType === "cancellation"
      ? "Deposits are non-refundable. Cancellations made within 48 hours of the appointment may forfeit the deposit. Please contact the artist directly for rescheduling."
      : depositAmount
        ? `A deposit of $${depositAmount} is required to secure these dates.${totalCost ? ` The remaining balance of $${totalCost - depositAmount} is due upon completion.` : ""}`
        : "Contact the artist for deposit requirements.";

  return (
    <div className="rounded-[4px] border border-white/5 overflow-hidden">
      <button
        type="button"
        className="flex items-center justify-between w-full px-2.5 py-2 text-[10px] font-semibold text-foreground/80 hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen(!open)}
      >
        {label}
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-2.5 pb-2.5 text-[9px] leading-relaxed text-muted-foreground">
              {policy?.content || fallbackContent}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BookingWizardContent({
  conversationId: initialConversationId,
  artistServices,
  artistSettings,
  isArtist,
  onBookingSuccess,
  onClose,
  selectedProposal,
  selectedAppointmentRaw,
  clientNameOverride,
  onAcceptProposal,
  onRejectProposal,
  onCancelProposal,
  onUpdateProposalState,
  isPendingProposalAction,
  isLoadingProposal,
  artistId,
  showGoToChat,
  onGoToChat,
  initialDate,
}: BookingWizardContentProps) {
  const { data: currentUser } = trpc.auth.me.useQuery();

  // 1. Get current studio for the user
  const { data: currentStudio } = trpc.studios.getCurrentStudio.useQuery(
    undefined,
    {
      enabled: isArtist && !!currentUser,
    }
  );

  // 2. If they have a studio, fetch the roster
  const { data: studioMembers, isLoading: isLoadingStudioMembers } =
    trpc.studios.getStudioMembers.useQuery(
      { studioId: currentStudio?.id || "" },
      { enabled: !!currentStudio?.id }
    );

  const isStudioManager = useMemo(() => {
    if (!currentUser || !studioMembers) return false;
    const myMembership = (studioMembers as any[]).find(
      (m: any) => m.userId === currentUser.id && m.status === "active"
    );
    return (
      myMembership &&
      (myMembership.role === "owner" || myMembership.role === "manager")
    );
  }, [currentUser, studioMembers]);

  // Active target artist for the booking. Defaults to self, changes if manager selects someone else.
  const [targetArtistId, setTargetArtistId] = useState<string | undefined>(
    artistId
  );

  // Default step logic: If Manager, force Artist selection first. Otherwise Client (or Service if convo exists).
  const [step, setStep] = useState<BookingStep>(() => {
    if (initialConversationId) return "service";
    return "artist"; // We will useEffect to skip this if not a manager
  });

  // Automatically skip 'artist' step if not a manager
  useEffect(() => {
    if (step === "artist" && !isLoadingStudioMembers) {
      if (!isStudioManager) {
        setStep(initialConversationId ? "service" : "client");
      }
    }
  }, [step, isLoadingStudioMembers, isStudioManager, initialConversationId]);

  const [conversationId, setConversationId] = useState<number | undefined>(
    initialConversationId
  );

  const [isClientPaying, setIsClientPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank" | null>(null);

  const [selectedService, setSelectedService] = useState<any>(null);
  const [requiredSittings, setRequiredSittings] = useState<number>(1);
  const [showVoucherList, setShowVoucherList] = useState(false);
  const [appliedPromotion, setAppliedPromotion] = useState<{
    id: number;
    name: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);
  const [frequency, setFrequency] = useState<
    "single" | "consecutive" | "weekly" | "biweekly" | "monthly"
  >("consecutive");
  const [customDates, setCustomDates] = useState<Date[]>([]);
  const [startDate] = useState(initialDate || new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(startDate);

  // Fetch calendar indicators for ±1 month around the viewed calendar month
  const { data: dateIndicators } = trpc.booking.getCalendarIndicators.useQuery(
    {
      artistId: targetArtistId || "",
      startDate: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1),
      endDate: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 2, 0),
    },
    {
      enabled: !!targetArtistId && step === "custom_dates",
    }
  );

  const [clientSearch, setClientSearch] = useState("");
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);
  const [newClientData, setNewClientData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState<CheckInPhase | null>(
    null
  );
  const [showEditBookingModal, setShowEditBookingModal] = useState(false);
  const [mysteryMapSelectedServiceId, setMysteryMapSelectedServiceId] = useState("");

  // Fetch dynamic services based on the TARGET artist, not necessarily the logged-in user

  // The parent component passes artistServices based on the URL context, but in the FAB we need dynamic
  const { data: dynamicArtistSettings } =
    trpc.artistSettings.getPublicByArtistId.useQuery(
      { artistId: targetArtistId || "" },
      { enabled: !!targetArtistId }
    );

  const effectiveSettings = dynamicArtistSettings || artistSettings;

  // Services are stored as a JSON string on the settings object
  const effectiveServices = useMemo(() => {
    if (dynamicArtistSettings?.services) {
      try {
        return JSON.parse(dynamicArtistSettings.services);
      } catch (e) {
        return [];
      }
    }
    return artistServices;
  }, [dynamicArtistSettings, artistServices]);

  const { data: clients, isLoading: isLoadingClients } =
    trpc.conversations.getClients.useQuery(undefined, {
      enabled: isArtist && step === "client",
    });

  const { data: pendingForms, refetch: refetchForms } =
    trpc.forms.getPendingForms.useQuery(
      { appointmentId: selectedAppointmentRaw?.id || 0 },
      { enabled: !isArtist && !!selectedAppointmentRaw?.id }
    );

  const [activeForm, setActiveForm] = useState<any>(null);

  const { data: availablePromotions, isLoading: isLoadingPromotions } =
    trpc.promotions.getAvailableForBooking.useQuery(
      { artistId: artistId || "" },
      { enabled: showVoucherList && !!artistId }
    );

  const filteredClients = (clients || [])
    .filter(
      c =>
        c?.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c?.email?.toLowerCase().includes(clientSearch.toLowerCase())
    );

  const getOrCreateConversation = trpc.conversations.getOrCreate.useMutation();
  const {
    data: availability,
    isPending: isLoadingAvailability,
    error: availabilityError,
  } = trpc.booking.checkAvailability.useQuery(
    {
      conversationId: conversationId || 0,
      serviceName: selectedService?.name || "",
      serviceDuration: selectedService?.duration || 60,
      sittings: requiredSittings,
      price: Number(selectedService?.price) || 0,
      frequency,
      startDate,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    {
      enabled: step === "review" && !!selectedService && !!conversationId && frequency !== "single",
      retry: false,
    }
  );

  const utils = trpc.useUtils();
  const sendMessageMutation = trpc.messages.send.useMutation({
    onSuccess: () => {
      if (conversationId) {
        utils.messages.list.invalidate({ conversationId });
      }
      toast.success("Proposal Sent Successfully");
      onClose();
      onBookingSuccess();
    },
    onError: err => {
      toast.error("Failed to send proposal: " + err.message);
    },
  });

  const createClientMutation = trpc.conversations.createClient.useMutation();

  const uploadMutation = trpc.upload.uploadImage.useMutation();
  const updateMetadataMutation = trpc.messages.updateMetadata.useMutation();

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProposal) return;

    toast.info("Uploading deposit receipt...");
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target?.result as string;
      try {
        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileData: base64Data,
          contentType: file.type,
        });

        const newMetadata = JSON.stringify({
          ...(selectedProposal.metadata || {}),
          status: "remittance_uploaded",
          receiptUrl: result.url,
        });

        await updateMetadataMutation.mutateAsync({
          messageId: selectedProposal.message.id,
          metadata: newMetadata,
        });

        await sendMessageMutation.mutateAsync({
          conversationId: selectedProposal.message.conversationId,
          content: "I have uploaded my deposit bank remittance receipt.",
          messageType: "text",
        });

        if (onUpdateProposalState) {
          onUpdateProposalState(JSON.parse(newMetadata));
        }

        toast.success("Deposit receipt uploaded successfully!");
        onBookingSuccess();
        // Kept open so user can instantly see the UI change

      } catch (err: any) {
        toast.error("Failed to upload receipt: " + err.message);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateAppointmentMutation = trpc.appointments.update.useMutation({
    onSuccess: () => {
      if (conversationId) {
        utils.messages.list.invalidate({ conversationId });
      }
      if (selectedAppointmentRaw?.id) {
        utils.appointments.getByConversation.invalidate(conversationId);
        utils.appointments.getArtistCalendar.invalidate();
      }
      onBookingSuccess();
    },
    onError: err => {
      toast.error("Failed to update appointment: " + err.message);
    },
  });

  const resolveMysteryMutation = trpc.appointments.resolveMysteryAppointments.useMutation({
    onSuccess: () => {
      toast.success("Imported appointments updated successfully!");
      setMysteryMapSelectedServiceId("");
      utils.appointments.getByConversation.invalidate(conversationId);
      utils.appointments.getArtistCalendar.invalidate();
      onBookingSuccess();
    },
    onError: err => {
      toast.error("Failed to resolve mystery appointments: " + err.message);
    }
  });

  const handleMapMysteryService = () => {
    console.log("MAP ALL INITIATED", { mysteryMapSelectedServiceId, selectedAppointmentRaw });
    if (!mysteryMapSelectedServiceId || !selectedAppointmentRaw) return;

    const targetService = effectiveServices.find((s: any) => String(s.name) === String(mysteryMapSelectedServiceId));
    console.log("TARGET SERVICE MATCHED:", targetService);

    if (!targetService) {
      toast.error("Failed to find matching service in your settings.");
      return;
    }

    const payload = {
      clientId: String(selectedAppointmentRaw.clientId),
      mysteryServiceName: String(selectedAppointmentRaw.serviceName || selectedAppointmentRaw.title),
      mappedServiceName: String(targetService.name),
      mappedPrice: Number(targetService.price) || 0,
      mappedDuration: Number(targetService.duration) || 60,
    };

    console.log("DISPATCHING TO BACKEND:", payload);

    resolveMysteryMutation.mutate(payload);
  };

  const handleConfirmBooking = () => {
    if (!selectedService || !conversationId) return;
    if (frequency !== "single" && !availability?.dates) return;
    if (frequency === "single" && customDates.length === 0) return;

    const datesToUse = frequency === "single" ? customDates : availability?.dates || [];

    const datesList = datesToUse
      .map((date: string | Date) =>
        format(new Date(date), "EEEE, MMMM do yyyy, h:mm a")
      )
      .join("\n");

    const finalSittings = frequency === "single" ? customDates.length : requiredSittings;
    const message = `I have found the following dates for your ${selectedService.name} project:\n\n${datesList}\n\nThis project consists of ${finalSittings} sittings.\nFrequency: ${frequency === "single" ? "Custom dates" : frequency}\nPrice per sitting: $${selectedService.price}\n\nPlease confirm these dates.`;

    const totalCost = Number(selectedService.price) * finalSittings;
    // Use fee-engine percentage (SSOT) instead of legacy flat depositAmount
    const depositPercent = Number(effectiveSettings?.depositPercentage ?? 37);
    const totalDeposit = Math.round(totalCost * depositPercent / 100);

    const metadata = JSON.stringify({
      type: "project_proposal",
      serviceName: selectedService.name,
      serviceDuration: selectedService.duration,
      sittings: finalSittings,
      price: Number(selectedService.price),
      totalCost: totalCost,
      frequency: frequency === "single" ? "Custom dates" : frequency,
      dates: datesToUse,
      proposedDates: datesToUse,
      status: "pending",
      bsb: artistSettings?.bsb,
      accountNumber: artistSettings?.accountNumber,
      depositAmount: totalDeposit,
      depositPercent: depositPercent,
      autoSendDeposit: artistSettings?.autoSendDepositInfo,
    });

    sendMessageMutation.mutate({
      conversationId,
      content: message,
      messageType: "appointment_request",
      metadata: metadata,
    });
  };

  const handleClientSelect = async (client: any) => {
    if (!targetArtistId) return;
    try {
      const convo = await getOrCreateConversation.mutateAsync({
        artistId: targetArtistId,
        clientId: client.id,
      });
      if (convo) {
        setConversationId(convo.id);
        setStep("service");
      }
    } catch (e) {
      toast.error("Failed to start conversation");
    }
  };

  const handleCreateClientAndConvo = async () => {
    if (!targetArtistId || !newClientData.name) return;
    setIsCreatingClient(true);
    try {
      const convo = await createClientMutation.mutateAsync({
        name: newClientData.name,
        email: newClientData.email,
        phone: newClientData.phone,
      });
      if (convo) {
        // Now pair this newly created client with the TARGET artist via a conversation
        const newConvoPairing = await getOrCreateConversation.mutateAsync({
          artistId: targetArtistId,
          clientId: convo.clientId as string, // createClient returns the conversation, we need the client ID
        });

        if (newConvoPairing) setConversationId(newConvoPairing.id);

        setStep("service");
        setIsAddingNewClient(false);
      }
    } catch (e: any) {
      toast.error("Failed to create client: " + e.message);
    } finally {
      setIsCreatingClient(false);
    }
  };

  const goBack = () => {
    if (step === "service") {
      if (!initialConversationId) setStep("client");
    } else if (step === "frequency") {
      setStep("service");
    } else if (step === "custom_dates") {
      if (requiredSittings === 1) {
        setStep("service");
      } else {
        setStep("frequency");
      }
    } else if (step === "review") {
      if (frequency === "single") {
        setStep("custom_dates");
      } else if (requiredSittings === 1) {
        setStep("service");
      } else {
        setStep("frequency");
      }
    }
  };

  const fab = tokens.fab;
  const card = tokens.card;

  const freqOptions = [
    { id: "single", label: "Custom dates", Icon: Repeat1 },
    { id: "consecutive", label: "Consecutive", Icon: CalendarDays },
    { id: "weekly", label: "Weekly", Icon: Calendar },
    { id: "biweekly", label: "Bi-Weekly", Icon: Repeat },
    { id: "monthly", label: "Monthly", Icon: CalendarSearch },
  ] as const;

  const getStepTitle = () => {
    switch (step) {
      case "artist":
        return "Select Artist";
      case "client":
        return "Select Client";
      case "service":
        return "Select Service";
      case "frequency":
        return "Frequency";
      case "custom_dates":
        return "Select Dates";
      case "review":
        return "Review";
      case "success":
        return "Done";
    }
  };

  const showProposal = !!selectedProposal?.metadata;
  const proposalMeta = selectedProposal?.metadata;

  const proposalDates = proposalMeta
    ? Array.isArray(proposalMeta.dates)
      ? proposalMeta.dates
      : Array.isArray(proposalMeta.proposedDates)
        ? proposalMeta.proposedDates
        : []
    : [];
  const proposalTotalMinutes = proposalMeta
    ? (proposalMeta.sittings || 1) * (proposalMeta.serviceDuration || 60)
    : 0;
  const proposalHours = Math.floor(proposalTotalMinutes / 60);
  const hasStoredDiscount =
    proposalMeta?.discountApplied && proposalMeta?.finalAmount !== undefined;
  const hasCurrentDiscount = appliedPromotion !== null;
  const hasDiscount = hasCurrentDiscount || hasStoredDiscount;
  const displayTotal = hasCurrentDiscount
    ? appliedPromotion.finalAmount / 100
    : hasStoredDiscount
      ? proposalMeta.finalAmount / 100
      : proposalMeta?.totalCost || 0;

  if (showCheckInModal && selectedAppointmentRaw) {
    return (
      <div className="flex flex-col w-full min-h-[50vh] pt-2 pb-6 px-1">
        <motion.div variants={fab.animation.item} className={fab.itemRow}>
          <button
            onClick={() => setShowCheckInModal(null)}
            className={fab.itemButton}
          >
            <ArrowLeft className={fab.itemIconSize} />
          </button>
          <span
            className={cn(
              fab.itemLabel,
              "uppercase tracking-widest font-bold flex-1"
            )}
          >
            Checkout
          </span>
        </motion.div>

        <div className="flex-1 overflow-y-auto mt-4 px-2">
          <AppointmentCheckInModal
            isOpen={!!showCheckInModal}
            checkIn={{
              appointment: selectedAppointmentRaw,
              phase: showCheckInModal,
            }}
            onDismiss={() => setShowCheckInModal(null)}
            updateAppointment={updateAppointmentMutation}
          />
        </div>
      </div>
    );
  }

  // Find the exact client object associated with this appointment/conversation if available in filteredClients
  const matchedClient = filteredClients.find(
    (c: any) => c?.id === currentUser?.id || c?.id === selectedAppointmentRaw?.clientId
  );

  return (
    <div className="flex flex-col gap-2 w-full">
      <EditBookingModal
        isOpen={showEditBookingModal}
        onClose={() => setShowEditBookingModal(false)}
        appointment={selectedAppointmentRaw}
        client={matchedClient}
        onSuccess={() => {
          setShowEditBookingModal(false);
          // Optional: refetch controller data if necessary
        }}
      />
      {isLoadingProposal && (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Loading Proposal
          </span>
        </div>
      )}

      {!isLoadingProposal &&
        showProposal &&
        proposalMeta &&
        !activeForm &&
        !showVoucherList && (
          <>
            <motion.div variants={fab.animation.item}>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70 mb-0.5">
                {clientNameOverride || "Project Proposal"}
              </p>
              <h3 className="text-sm font-bold text-foreground leading-tight">
                {proposalMeta.serviceName}
              </h3>
            </motion.div>

            <motion.div
              variants={fab.animation.item}
              className={cn(
                card.base,
                "grid grid-cols-3 gap-px rounded-[4px] overflow-hidden bg-white/[0.03]"
              )}
            >
              {[
                {
                  label: "Total",
                  value: hasDiscount
                    ? `$${displayTotal}`
                    : `$${proposalMeta.totalCost}`,
                  accent: hasDiscount,
                },
                { label: "Time", value: `${proposalHours}h`, accent: false },
                {
                  label: "Sittings",
                  value: String(proposalMeta.sittings || 1),
                  accent: false,
                },
              ].map(({ label, value, accent }) => (
                <div
                  key={label}
                  className="p-2 flex flex-col items-center gap-0.5"
                >
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-medium">
                    {label}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      accent ? "text-emerald-500" : "text-foreground"
                    )}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </motion.div>

            {hasDiscount && (
              <motion.div
                variants={fab.animation.item}
                className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-emerald-500/10"
              >
                <Tag className="w-3 h-3 text-emerald-500" />
                <span className="text-[9px] font-medium text-emerald-500">
                  {hasCurrentDiscount
                    ? appliedPromotion.name
                    : proposalMeta.promotionName || "Promotion"}{" "}
                  applied
                </span>
              </motion.div>
            )}

            {proposalDates.length > 0 && (
              <motion.div variants={fab.animation.item} className="space-y-1">
                <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Schedule
                </p>
                <div className="max-h-[160px] overflow-y-auto no-scrollbar space-y-1 pr-1">
                  {proposalDates.map((dateStr: string, i: number) => (
                    <div
                      key={i}
                      className={cn(
                        card.base,
                        card.bg,
                        "flex items-center gap-2 p-1.5 rounded-[4px]"
                      )}
                    >
                      <span className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-foreground truncate">
                          {format(new Date(dateStr), "EEE, MMM d")}
                        </p>
                        <p className="text-[8px] text-muted-foreground">
                          {format(new Date(dateStr), "h:mm a")}
                          {proposalMeta.serviceDuration ? ` · ${proposalMeta.serviceDuration}m` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {!isArtist && proposalMeta.status === "pending" && !isClientPaying && (
              <motion.div
                variants={fab.animation.item}
                className="space-y-2 pt-1"
              >
                {!appliedPromotion && artistId && (
                  <button
                    className={cn(
                      card.base,
                      card.bg,
                      card.interactive,
                      "flex items-center gap-2 p-2 w-full rounded-[4px]"
                    )}
                    onClick={() => setShowVoucherList(true)}
                  >
                    <div className={cn(fab.itemButton, "shrink-0 !w-7 !h-7")}>
                      <Tag className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] font-semibold text-foreground">
                      Apply Voucher
                    </span>
                  </button>
                )}

                {artistId && (
                  <PolicyDropdown
                    label="Cancellation Policy"
                    artistId={artistId}
                    policyType="cancellation"
                  />
                )}

                {artistId && (
                  <PolicyDropdown
                    label="Deposit Information"
                    artistId={artistId}
                    policyType="deposit"
                    depositAmount={artistSettings?.depositAmount}
                    totalCost={proposalMeta.totalCost}
                  />
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={onRejectProposal}
                    disabled={isPendingProposalAction}
                    className="py-2 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => {
                      onAcceptProposal?.(
                        appliedPromotion
                          ? {
                            id: appliedPromotion.id,
                            discountAmount: appliedPromotion.discountAmount,
                            finalAmount: appliedPromotion.finalAmount,
                          }
                          : undefined
                      );
                      setIsClientPaying(true);
                      setPaymentMethod(null);
                    }}
                    disabled={isPendingProposalAction}
                    className="py-2 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {isPendingProposalAction ? "..." : "Accept"}
                  </button>
                </div>
                <p className="text-[8px] text-muted-foreground text-center leading-tight">
                  By accepting, you agree to the cancellation and deposit
                  policies above.
                </p>
              </motion.div>
            )}

            {isArtist && proposalMeta.status === "pending" && (
              <motion.div
                variants={fab.animation.item}
                className="space-y-2 pt-1"
              >
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] bg-orange-500/10">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
                  </span>
                  <span className="text-[9px] font-medium text-orange-500">
                    Awaiting client response
                  </span>
                </div>
                <button
                  onClick={onCancelProposal}
                  className="w-full py-2 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                >
                  Cancel Proposal
                </button>
              </motion.div>
            )}

            {(!isArtist && (proposalMeta.status === "accepted" || (proposalMeta.status === "pending" && isClientPaying))) && (
              <motion.div variants={fab.animation.item} className="flex flex-col gap-3 py-2">
                <div className="p-3 bg-indigo-500/10 rounded-[8px] border border-indigo-500/20">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Tag className="w-3 h-3" /> Deposit Required</h4>
                  {(() => {
                    // depositAmount in metadata is stored in dollars — fee is rolled in for clean client UX
                    const depositDollars = Number(proposalMeta.depositAmount || 0);
                    const depositCents = Math.round(depositDollars * 100);
                    const feeCents = Math.max(Math.round(depositCents * 0.034), 500);
                    const totalDollars = (depositCents + feeCents) / 100;
                    return (
                      <div className="flex justify-between text-[11px]">
                        <span className="font-bold text-primary">Deposit</span>
                        <span className="font-bold text-primary">${totalDollars.toFixed(2)}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* ── Payment Method Buttons ── */}
                <div className="flex flex-col gap-2 relative z-10">
                  <button
                    onClick={async () => {
                      setPaymentMethod("card");
                      try {
                        const convoId = initialConversationId || conversationId;
                        if (!convoId) {
                          toast.error("No conversation found");
                          return;
                        }
                        toast.info("Preparing secure checkout...");
                        // Step 1: Ensure lead exists and get deposit token URL
                        const msgId = selectedProposal?.message?.id;
                        const linkResult = await utils.client.funnel.getClientDepositLink.mutate({
                          conversationId: convoId,
                          ...(msgId ? { messageId: msgId } : {}),
                        });
                        if (!linkResult?.url) {
                          toast.error("Could not generate deposit link");
                          setPaymentMethod(null);
                          return;
                        }
                        // Step 2: Extract token from URL and create Stripe checkout
                        const urlParts = linkResult.url.split("/deposit/");
                        const tokenWithParams = urlParts[1] || "";
                        const token = tokenWithParams.split("?")[0];
                        if (!token) {
                          toast.error("Invalid deposit token");
                          setPaymentMethod(null);
                          return;
                        }
                        const checkoutResult = await utils.client.funnel.createDepositCheckout.mutate({
                          token,
                          ...(msgId ? { messageId: msgId } : {}),
                        });
                        if (checkoutResult?.url) {
                          window.location.href = checkoutResult.url;
                        } else {
                          toast.error("Could not create checkout session");
                          setPaymentMethod(null);
                        }
                      } catch (err: any) {
                        console.error("[Deposit] Stripe checkout error:", err);
                        toast.error(err.message || "Payment temporarily unavailable. Please try again.");
                        setPaymentMethod(null);
                      }
                    }}
                    disabled={paymentMethod === "card"}
                    className="w-full py-3 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(var(--primary),0.3)] disabled:opacity-70"
                  >
                    {paymentMethod === "card" ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /><span>Preparing Secure Checkout...</span></>
                    ) : (
                      <><CreditCard className="w-4 h-4" /><span>Secure with Card</span></>
                    )}
                  </button>
                </div>


              </motion.div>
            )}

            {isArtist && proposalMeta.status === "accepted" && (
              <motion.div
                variants={fab.animation.item}
                className="flex items-center gap-1.5 px-2 py-2 rounded-[4px] bg-emerald-500/10"
              >
                <div className="w-3.5 h-3.5 rounded-full border border-emerald-500 border-t-transparent animate-spin" />
                <span className="text-[10px] font-bold text-emerald-500">
                  Awaiting Client Remittance...
                </span>
              </motion.div>
            )}

            {isArtist && proposalMeta.status === "remittance_uploaded" && (
              <motion.div variants={fab.animation.item} className="flex flex-col gap-3 pt-2">
                <div className="flex flex-col gap-2 p-3 bg-indigo-500/10 rounded-[8px] border border-indigo-500/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                      Client Uploaded Receipt
                    </span>
                  </div>

                  {proposalMeta.receiptUrl && (
                    <a
                      href={proposalMeta.receiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="relative block w-full h-32 rounded-[4px] overflow-hidden border border-white/10 group bg-black/40 flex items-center justify-center cursor-pointer"
                    >
                      <img
                        src={proposalMeta.receiptUrl}
                        alt="Deposit Receipt"
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-[10px] font-bold uppercase tracking-wider">Tap to View</span>
                      </div>
                    </a>
                  )}

                  <button
                    onClick={async () => {
                      if (!proposalMeta.appointmentIds) {
                        toast.error("No pending appointments found to confirm!");
                        return;
                      }

                      try {
                        const newMeta = JSON.stringify({
                          ...proposalMeta,
                          status: "confirmed"
                        });

                        await updateMetadataMutation.mutateAsync({
                          messageId: selectedProposal.message.id,
                          metadata: newMeta
                        });

                        for (const appId of proposalMeta.appointmentIds) {
                          await updateAppointmentMutation.mutateAsync({
                            id: appId,
                            status: "confirmed"
                          });
                        }

                        await sendMessageMutation.mutateAsync({
                          conversationId: selectedProposal.message.conversationId,
                          content: "I have confirmed your deposit. Your dates are officially booked! 🎉",
                          messageType: "text"
                        });

                        if (onUpdateProposalState) {
                          onUpdateProposalState(JSON.parse(newMeta));
                        }

                        toast.success("Deposit confirmed! Appointments are locked.");
                        onBookingSuccess();
                        // View stays open showing the new Confirmed state
                      } catch (err: any) {
                        toast.error("Error confirming deposit");
                      }
                    }}
                    disabled={updateMetadataMutation.isPending || updateAppointmentMutation.isPending}
                    className="w-full py-3 mt-1 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-emerald-500 text-white hover:bg-emerald-600 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                  >
                    {updateMetadataMutation.isPending || updateAppointmentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm Deposit
                  </button>
                </div>
              </motion.div>
            )}

            {!isArtist && proposalMeta.status === "remittance_uploaded" && (
              <motion.div
                variants={fab.animation.item}
                className="flex items-center gap-2 px-3 py-2 rounded-[4px] bg-indigo-500/10 border border-indigo-500/20"
              >
                <div className="w-3.5 h-3.5 rounded-full border border-indigo-400 border-t-transparent animate-spin" />
                <span className="text-[10px] font-bold text-indigo-400">
                  Awaiting Artist Confirmation...
                </span>
              </motion.div>
            )}

            {proposalMeta.status === "confirmed" && (
              <motion.div
                variants={fab.animation.item}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-[4px] bg-emerald-500/10 border border-emerald-500/20"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                  Deposit Paid & Project Booked!
                </span>
              </motion.div>
            )}

            {!isArtist &&
              proposalMeta.status === "accepted" &&
              artistSettings?.businessAddress && (
                <motion.div variants={fab.animation.item}>
                  <button
                    className={cn(
                      card.base,
                      card.bg,
                      card.interactive,
                      "flex items-center gap-2 p-2 w-full rounded-[4px]"
                    )}
                    onClick={() => {
                      const addr = encodeURIComponent(
                        artistSettings.businessAddress
                      );
                      const platform = Capacitor.getPlatform();
                      if (platform === "ios")
                        window.location.href = `maps://?q=${addr}`;
                      else if (platform === "android")
                        window.location.href = `geo:0,0?q=${addr}`;
                      else
                        window.open(
                          `https://maps.google.com/?q=${addr}`,
                          "_blank"
                        );
                    }}
                  >
                    <div className={cn(fab.itemButton, "shrink-0 !w-7 !h-7")}>
                      <MapPin className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] font-semibold text-foreground">
                      Open in Maps
                    </span>
                  </button>
                </motion.div>
              )}

            {proposalMeta.status === "rejected" && (
              <motion.div
                variants={fab.animation.item}
                className="flex items-center gap-1.5 px-2 py-2 rounded-[4px] bg-red-500/10"
              >
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[10px] font-bold text-red-500">
                  Declined
                </span>
              </motion.div>
            )}

            {isArtist && selectedAppointmentRaw?.status === "completed" && (
              <motion.div variants={fab.animation.item} className="pt-1">
                <div className="flex items-center gap-2 px-3 py-2 bg-zinc-500/10 text-zinc-400 rounded-[4px] border border-zinc-500/20 justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Project Complete
                  </span>
                </div>
              </motion.div>
            )}

            {isArtist &&
              proposalMeta.status === "accepted" &&
              selectedAppointmentRaw &&
              selectedAppointmentRaw.status !== "completed" && (
                <motion.div
                  variants={fab.animation.item}
                  className="pt-1 flex flex-col gap-2"
                >
                  {!(
                    selectedAppointmentRaw.clientArrived === 1 ||
                    selectedAppointmentRaw.clientArrived === true
                  ) ? (
                    <button
                      onClick={() => setShowCheckInModal("arrival")}
                      className="w-full py-2.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Client Check-in
                    </button>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-500 rounded-[4px] border border-emerald-500/20 justify-center">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                          In Progress
                        </span>
                      </div>
                      <button
                        onClick={() => setShowCheckInModal("completion")}
                        className="w-full py-2.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 mt-1"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Finish Project
                      </button>
                    </>
                  )}
                </motion.div>
              )}

            {showGoToChat && (
              <motion.div variants={fab.animation.item} className="pt-1">
                <button
                  onClick={onGoToChat}
                  className={cn(
                    card.base,
                    card.bgAccent,
                    card.interactive,
                    "flex items-center gap-2 p-2 w-full rounded-[4px] border border-primary/20"
                  )}
                >
                  <div
                    className={cn(
                      fab.itemButtonHighlight,
                      "shrink-0 !w-7 !h-7"
                    )}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] font-bold text-foreground">
                    Go to Chat
                  </span>
                </button>
              </motion.div>
            )}

            {isArtist && (
              <motion.div variants={fab.animation.item} className="pt-1">
                <button
                  onClick={() => setShowEditBookingModal(true)}
                  className={cn(
                    card.base,
                    card.bg,
                    card.interactive,
                    "flex justify-center items-center gap-2 py-2.5 w-full rounded-[4px] border border-white/5"
                  )}
                >
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Edit Booking
                  </span>
                </button>
              </motion.div>
            )}

            {!isArtist && pendingForms && pendingForms.length > 0 && (
              <motion.div variants={fab.animation.item} className="pt-1">
                <button
                  onClick={() => setActiveForm(pendingForms[0])}
                  className={cn(
                    card.base,
                    "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
                    card.interactive,
                    "flex items-center gap-2 p-2 w-full rounded-[4px] border border-orange-500/20"
                  )}
                >
                  <div
                    className={cn(
                      fab.itemButton,
                      "shrink-0 !w-7 !h-7 bg-orange-500/20 text-orange-500"
                    )}
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 flex justify-between items-center text-[10px] font-bold">
                    <span>Sign Required Forms</span>
                    <span className="w-4 h-4 bg-orange-500 text-white rounded-full flex items-center justify-center text-[8px]">
                      {pendingForms.length}
                    </span>
                  </div>
                </button>
              </motion.div>
            )}
          </>
        )}

      {showVoucherList && (
        <div className="flex flex-col w-full h-full pt-2 pb-6 px-1">
          <motion.div variants={fab.animation.item} className={fab.itemRow}>
            <button
              onClick={() => setShowVoucherList(false)}
              className={fab.itemButton}
            >
              <ArrowLeft className={fab.itemIconSize} />
            </button>
            <span
              className={cn(
                fab.itemLabel,
                "uppercase tracking-widest font-bold flex-1"
              )}
            >
              Available Vouchers
            </span>
          </motion.div>

          <div className="flex flex-col flex-1 mt-4 px-1 gap-2 overflow-y-auto no-scrollbar">
            {isLoadingPromotions && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}
            {availablePromotions?.map(promo => {
              const originalCents = (proposalMeta?.totalCost || 0) * 100;
              let discountAmount = 0;
              if (promo.valueType === "fixed") discountAmount = promo.value;
              else if (promo.valueType === "percentage")
                discountAmount = Math.floor(
                  originalCents * (promo.value / 100)
                );

              const finalAmount = Math.max(0, originalCents - discountAmount);

              return (
                <motion.button
                  key={promo.id}
                  variants={fab.animation.item}
                  className={cn(
                    card.base,
                    card.bg,
                    card.interactive,
                    "p-3 flex flex-col gap-1 w-full text-left"
                  )}
                  onClick={() => {
                    setAppliedPromotion({
                      id: promo.id,
                      name: promo.name,
                      discountAmount,
                      finalAmount,
                    });
                    setShowVoucherList(false);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                      {promo.name}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-500">
                      {promo.valueType === "fixed"
                        ? `$${promo.value / 100}`
                        : `${promo.value}% OFF`}
                    </span>
                  </div>
                  <p className="text-[9px] text-muted-foreground line-clamp-2">
                    Use this voucher on your next booking.
                  </p>
                </motion.button>
              );
            })}
            {!isLoadingPromotions && availablePromotions?.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-8 font-bold uppercase tracking-widest opacity-50">
                No vouchers available
              </p>
            )}
          </div>
        </div>
      )}

      {!showVoucherList && activeForm && (
        <InlineFormSigning
          pendingForms={pendingForms || []}
          initialForm={activeForm}
          onSuccess={() => {
            refetchForms();
          }}
          onClose={() => {
            setActiveForm(null);
          }}
        />
      )}

      {/* ===== STANDALONE / IMPORTED APPOINTMENT VIEW ===== */}
      {!isLoadingProposal && !showProposal && !activeForm && !showVoucherList && selectedAppointmentRaw && (
        <div className="flex flex-col gap-2 w-full">
          <motion.div variants={fab.animation.item}>
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70 mb-0.5">
              Saved Appointment
            </p>
            <h3 className="text-sm font-bold text-foreground leading-tight">
              {selectedAppointmentRaw.title}
            </h3>
            <p className="text-[10px] text-muted-foreground mt-1">
              {format(new Date(selectedAppointmentRaw.startTime), "EEEE, MMMM do, h:mm a")}
            </p>
          </motion.div>

          {/* Mystery String Resolver */}
          {isArtist && selectedAppointmentRaw.serviceName && effectiveServices && !effectiveServices.some((s: any) => s.name === selectedAppointmentRaw.serviceName) && (
            <motion.div variants={fab.animation.item} className="mt-2 pt-2 border-t border-white/5 space-y-2">
              <div className="flex items-start gap-2 px-2 py-1.5 bg-yellow-500/10 rounded-[4px]">
                <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">
                    Unmapped Service
                  </p>
                  <p className="text-[9px] text-yellow-500/80 leading-tight mt-0.5">
                    "{selectedAppointmentRaw.serviceName}" is not in your services list. Map it to apply the correct price and duration to all imported appointments.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <select
                  value={mysteryMapSelectedServiceId}
                  onChange={e => setMysteryMapSelectedServiceId(e.target.value)}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-[4px] px-2 py-2 text-[11px] text-zinc-900 dark:text-foreground w-full outline-none"
                >
                  <option value="">Select Service to Map...</option>
                  {effectiveServices.map((s: any, idx: number) => (
                    <option key={s.id || s.name || idx} value={s.name}>
                      {s.name} ({s.duration}m / ${s.price})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleMapMysteryService}
                  disabled={!mysteryMapSelectedServiceId || resolveMysteryMutation.isPending}
                  className="bg-primary text-primary-foreground font-bold text-[10px] uppercase tracking-wider px-3 rounded-[4px] disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center shrink-0 min-w-[70px]"
                >
                  {resolveMysteryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Map All"}
                </button>
              </div>
            </motion.div>
          )}

          {isArtist && selectedAppointmentRaw.status === "completed" && (
            <motion.div variants={fab.animation.item} className="pt-1">
              <div className="flex items-center gap-2 px-3 py-2 bg-zinc-500/10 text-zinc-400 rounded-[4px] border border-zinc-500/20 justify-center">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Project Complete
                </span>
              </div>
            </motion.div>
          )}

          {isArtist && selectedAppointmentRaw.status !== "completed" && (
            <motion.div variants={fab.animation.item} className="pt-1 flex flex-col gap-2">
              {!(
                selectedAppointmentRaw.clientArrived === 1 ||
                selectedAppointmentRaw.clientArrived === true
              ) ? (
                <button
                  onClick={() => setShowCheckInModal("arrival")}
                  className="w-full py-2.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Client Check-in
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 text-emerald-500 rounded-[4px] border border-emerald-500/20 justify-center">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                      In Progress
                    </span>
                  </div>
                  <button
                    onClick={() => setShowCheckInModal("completion")}
                    className="w-full py-2.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 mt-1"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Finish Project
                  </button>
                </>
              )}
            </motion.div>
          )}

          {showGoToChat && (
            <motion.div variants={fab.animation.item} className="pt-1">
              <button
                onClick={onGoToChat}
                className={cn(
                  card.base,
                  card.bgAccent,
                  card.interactive,
                  "flex items-center gap-2 p-2 w-full rounded-[4px] border border-primary/20"
                )}
              >
                <div className={cn(fab.itemButtonHighlight, "shrink-0 !w-7 !h-7")}>
                  <MessageCircle className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold text-foreground">
                  Go to Chat
                </span>
              </button>
            </motion.div>
          )}

          {isArtist && (
            <motion.div variants={fab.animation.item} className="pt-1">
              <button
                onClick={() => setShowEditBookingModal(true)}
                className={cn(
                  card.base,
                  card.bg,
                  card.interactive,
                  "flex justify-center items-center gap-2 py-2.5 w-full rounded-[4px] border border-white/5"
                )}
              >
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Edit Booking
                </span>
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* ===== BOOKING WIZARD ===== */}
      {!isLoadingProposal &&
        !showProposal &&
        !activeForm &&
        !showVoucherList &&
        !selectedAppointmentRaw && (
          <div className="flex flex-col gap-2 w-full">
            <motion.div variants={fab.animation.item} className={fab.itemRow}>
              {step !== "service" && step !== "success" && (
                <button onClick={goBack} className={fab.itemButton}>
                  <ArrowLeft className={fab.itemIconSize} />
                </button>
              )}
              <span
                className={cn(
                  fab.itemLabel,
                  "uppercase tracking-widest font-bold flex-1"
                )}
              >
                {getStepTitle()}
              </span>
              {selectedService &&
                step !== "service" &&
                step !== "artist" &&
                step !== "client" && (
                  <span className={fab.itemLabel}>{selectedService.name}</span>
                )}
            </motion.div>

            {step === "artist" && isStudioManager && studioMembers && (
              <div className="flex flex-col gap-1.5 pt-1">
                <p className="text-[10px] text-muted-foreground mb-2 px-1">
                  Book on behalf of a studio member:
                </p>
                {(studioMembers as any[]).map(member => (
                  <motion.button
                    key={member.user?.id}
                    variants={fab.animation.item}
                    className={cn(
                      card.base,
                      card.bg,
                      card.interactive,
                      "p-3 flex items-center justify-between gap-3 w-full text-left"
                    )}
                    onClick={() => {
                      setTargetArtistId(member.user?.id);
                      setStep("client");
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex flex-col items-center justify-center overflow-hidden">
                        {member.user?.avatar ? (
                          <img
                            src={member.user.avatar}
                            alt={member.user.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] font-bold text-primary">
                            {member.user?.name?.charAt(0) || "?"}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-foreground uppercase tracking-wider truncate">
                          {member.user?.name}
                          {member.user?.id === currentUser?.id && " (You)"}
                        </p>
                        <p className="text-[9px] text-muted-foreground capitalize">
                          {member.role}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {step === "client" && (
              <div className="flex flex-col gap-3 -my-2 w-full pt-1">
                <>
                  <div
                    className={cn(
                      card.base,
                      card.bg,
                      "px-3 py-2 flex items-center gap-2 rounded-[4px]"
                    )}
                  >
                    <Loader2
                      className={cn(
                        "w-3.5 h-3.5 animate-spin text-muted-foreground",
                        !isLoadingClients && "hidden"
                      )}
                    />
                    {!isLoadingClients && (
                      <CalendarSearch className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <input
                      type="text"
                      placeholder="Search existing clients..."
                      className="bg-transparent border-none outline-none text-[11px] placeholder:text-muted-foreground/50 w-full"
                      value={clientSearch}
                      onChange={e => setClientSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 min-h-[140px] max-h-[40vh] overflow-y-auto w-full touch-pan-y mobile-scroll px-1">
                    {filteredClients.map(client => {
                      if (!client) return null;
                      return (
                        <motion.button
                          key={client.id}
                          variants={fab.animation.item}
                          className={cn(
                            card.base,
                            card.bg,
                            card.interactive,
                            "p-2.5 flex items-center gap-2.5 w-full text-left"
                          )}
                          onClick={() => handleClientSelect(client)}
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {client.name?.charAt(0) || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-foreground truncate">
                              {client.name}
                            </p>
                            <p className="text-[9px] text-muted-foreground truncate">
                              {client.email || "No email"}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}

                    {clientSearch &&
                      filteredClients.length === 0 &&
                      !isLoadingClients && (
                        <div className="py-8 text-center">
                          <p className="text-[10px] text-muted-foreground">
                            No clients found matching "{clientSearch}"
                          </p>
                        </div>
                      )}

                    {!clientSearch &&
                      filteredClients.length === 0 &&
                      !isLoadingClients && (
                        <div className="py-8 text-center">
                          <p className="text-[10px] text-muted-foreground italic">
                            Search for a client or add a new one
                          </p>
                        </div>
                      )}
                  </div>

                </>
              </div>
            )}

            {step === "service" && (
              <div className="flex flex-col gap-1.5 pt-1">
                {(!effectiveServices || effectiveServices.length === 0) && (
                  <p className="text-[10px] text-muted-foreground p-4 text-center">
                    No services found for this artist.
                  </p>
                )}
                {effectiveServices?.map((service: any) => (
                  <motion.button
                    key={service.id}
                    variants={fab.animation.item}
                    className={cn(
                      card.base,
                      card.bg,
                      card.interactive,
                      "p-3 flex items-center justify-between gap-3 w-full text-left relative overflow-hidden"
                    )}
                    onClick={() => {
                      setSelectedService(service);
                      const sittings = Number(service.sittings) || 1;
                      setRequiredSittings(sittings);
                      if (sittings === 1) {
                        setFrequency("single");
                        setStep("custom_dates");
                      } else {
                        setStep("frequency");
                      }
                    }}
                  >
                    {service.color && (
                      <>
                        <div
                          className="absolute inset-y-0 left-0 w-1.5 pointer-events-none z-0 brightness-110 saturate-50 opacity-60"
                          style={{ backgroundColor: service.color }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 w-1/4 pointer-events-none opacity-20 z-0 saturate-50"
                          style={{
                            background: `linear-gradient(to right, ${service.color}, transparent)`,
                          }}
                        />
                      </>
                    )}
                    <div className="flex-1 min-w-0 relative z-10">
                      <p className="text-[11px] font-bold text-foreground uppercase tracking-wider truncate">
                        {service.name}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {service.duration} mins · ${service.price}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}



            {step === "frequency" && (
              <div className="flex flex-col gap-2 pt-1">
                {freqOptions.map(({ id, label, Icon }) => (
                  <motion.button
                    key={id}
                    variants={fab.animation.item}
                    className={cn(
                      card.base,
                      card.bg,
                      card.interactive,
                      "p-3 flex items-center gap-3 w-full text-left",
                      frequency === id && "border-primary/50 bg-primary/5"
                    )}
                    onClick={() => {
                      setFrequency(id);
                      if (id === "single") {
                        setStep("custom_dates");
                      } else {
                        setStep("review");
                      }
                    }}
                  >
                    <div
                      className={cn(
                        fab.itemButton,
                        frequency === id && "bg-primary text-primary-foreground"
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">
                      {label}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}

            {step === "custom_dates" && (
              <div className="flex flex-col gap-4 pt-1 items-center pb-2">
                <div className={cn(card.base, card.bg, "p-3 w-full rounded-[4px]")}>
                  <p className="text-[11px] text-muted-foreground text-center mb-1">
                    Select one or more dates for this project
                  </p>
                  <div className="flex justify-center flex-col items-center">
                    <CalendarPicker
                      mode="multiple"
                      selected={customDates}
                      onSelect={(dates: Date[] | undefined) => {
                        const selectedDates = dates || [];
                        const workingHours = effectiveSettings?.hours || {};
                        const adjustedDates = selectedDates.map((d: Date) => {
                          const newDate = new Date(d);
                          const dayOfWeek = format(newDate, "EEEE").toLowerCase();
                          const hoursForDay = workingHours[dayOfWeek];
                          if (hoursForDay && !hoursForDay.isOff && hoursForDay.start) {
                            const [hh, mm] = hoursForDay.start.split(":").map(Number);
                            newDate.setHours(hh, mm, 0, 0);
                          } else {
                            newDate.setHours(9, 0, 0, 0); // fallback 9 AM
                          }
                          return newDate;
                        });
                        setCustomDates(adjustedDates);
                      }}
                      onMonthChange={setCalendarMonth}
                      dateIndicators={dateIndicators}
                      className="rounded-md border-0 pointer-events-auto"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (customDates.length > 0) {
                      setStep("review");
                    } else {
                      toast.error("Please select at least one date.");
                    }
                  }}
                  disabled={customDates.length === 0}
                  className="w-full py-3 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Confirm Dates ({customDates.length})
                </button>
              </div>
            )}

            {step === "review" && (
              <div className="flex flex-col gap-4 pt-1">
                <motion.div
                  variants={fab.animation.item}
                  className={cn(
                    card.base,
                    card.bg,
                    "p-4 space-y-3 rounded-[4px]"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                        Project
                      </p>
                      <p className="text-xs font-bold text-foreground">
                        {selectedService.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                        Rate
                      </p>
                      <p className="text-xs font-bold text-primary">
                        ${selectedService.price}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-2 border-y border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center">
                        <Repeat className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
                        {frequency}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground">
                      {frequency === "single"
                        ? `${customDates.length} sitting${customDates.length > 1 ? "s" : ""}`
                        : `${selectedService.sittings || 1} sittings`}
                    </span>
                  </div>

                  {frequency === "single" ? (
                    <div className="space-y-2">
                      <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                        Selected Dates
                      </p>
                      <div className="max-h-[120px] overflow-y-auto no-scrollbar space-y-1 pr-1">
                        {[...customDates]
                          .sort((a, b) => a.getTime() - b.getTime())
                          .map((dateValue: Date, i: number) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-[10px] font-medium text-foreground py-0.5"
                            >
                              <span>
                                {format(dateValue, "EEE, MMM do")}
                              </span>
                              <span className="text-muted-foreground">
                                {format(dateValue, "h:mm a")} {/* Assuming the date has a default time or time isn't strict here */}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : isLoadingAvailability ? (
                    <div className="flex items-center gap-2 text-primary">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-[9px] font-bold uppercase tracking-widest">
                        Checking Availability...
                      </span>
                    </div>
                  ) : availabilityError ? (
                    <div className="p-2 rounded-[4px] bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-2">
                      <AlertCircle className="w-3 h-3" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">
                        No availability found
                      </span>
                    </div>
                  ) : (
                    availability?.dates && (
                      <div className="space-y-2">
                        <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                          Proposed Schedule
                        </p>
                        <div className="max-h-[120px] overflow-y-auto no-scrollbar space-y-1 pr-1">
                          {availability.dates.map(
                            (dateValue: string | Date, i: number) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-[10px] font-medium text-foreground py-0.5"
                              >
                                <span>
                                  {format(new Date(dateValue), "EEE, MMM do")}
                                </span>
                                <span className="text-muted-foreground">
                                  {format(new Date(dateValue), "h:mm a")}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )
                  )}
                </motion.div>

                <button
                  onClick={handleConfirmBooking}
                  disabled={
                    sendMessageMutation.isPending || (frequency !== "single" && !availability?.dates) || (frequency === "single" && customDates.length === 0)
                  }
                  className="w-full py-3 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                >
                  {sendMessageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Send Proposal"
                  )}
                </button>
              </div>
            )}

            {step === "success" && (
              <>
                {(!showProposal && selectedAppointmentRaw && selectedAppointmentRaw.status === "confirmed") ? (
                  // Native Read-Only View for Imported Bookings
                  (() => {
                    const serviceFallback = effectiveServices?.find((s: any) => s.id === selectedAppointmentRaw.serviceId);
                    return (
                      <div className="flex-1 flex flex-col p-6 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both" style={{
                        animationDelay: '100ms',
                      }}>
                        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto w-full gap-4">
                          <div className="w-16 h-16 rounded-full bg-primary/20 flex flex-col items-center justify-center border-2 border-primary/30 mb-2">
                            <CheckCircle2 className="w-8 h-8 text-primary" />
                          </div>

                          <div>
                            <h2 className="text-xl font-bold text-foreground">
                              {clientNameOverride || "Imported Booking"}
                            </h2>
                            <p className="text-sm font-semibold text-primary/80 mt-1 uppercase tracking-wider">
                              {serviceFallback?.title || selectedAppointmentRaw.notes?.split(":")[0] || "Custom Service"}
                            </p>
                          </div>

                          <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 mt-4 space-y-4 shadow-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <CalendarDays className="w-4 h-4 text-primary" />
                              </div>
                              <div className="text-left">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date & Time</p>
                                <p className="text-sm font-semibold text-foreground">
                                  {format(new Date(selectedAppointmentRaw.startTime), "EEEE, MMMM do yyyy")} <br />
                                  <span className="text-primary">{format(new Date(selectedAppointmentRaw.startTime), "h:mm a")}</span>
                                </p>
                              </div>
                            </div>

                            {/* Fallback for MessageSquare since it might not be imported */}
                            {false && (
                              <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                                <div className="text-left">
                                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Contact</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-8">
                          <button
                            onClick={() => {
                              if (window.confirm("Are you sure you want to delete this imported appointment from your calendar?")) {
                                toast.success("Appointment deleted natively.");
                                // Implement actual TRPC route here down the line
                                onClose();
                              }
                            }}
                            className="w-full text-red-500 hover:bg-red-500/10 h-12 rounded-[4px] uppercase tracking-wider font-bold text-[10px]"
                          >
                            Delete Imported Booking
                          </button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-10 gap-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-1">
                        Proposal Sent!
                      </h3>
                      <p className="text-[10px] text-muted-foreground">
                        The client has been notified to review and confirm.
                      </p>
                    </div>
                    <button
                      onClick={onClose}
                      className="mt-2 w-full py-2.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider bg-white/5 text-foreground hover:bg-white/10"
                    >
                      Dismiss
                    </button>
                  </motion.div>
                )}
              </>
            )}
          </div>
        )}
    </div>
  );
}
