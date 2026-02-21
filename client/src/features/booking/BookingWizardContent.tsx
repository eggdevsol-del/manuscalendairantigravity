import { useState, useEffect } from "react";
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
} from "lucide-react";
import { formatLocalTime, getBusinessTimezone } from "../../../../shared/utils/timezone";
import { AppointmentCheckInModal } from "@/components/modals/AppointmentCheckInModal";
import type { CheckInPhase } from "@/features/appointments/useAppointmentCheckIn";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { tokens } from "@/ui/tokens";
import { ApplyPromotionSheet } from "@/features/promotions";
import { FormSigningDialog } from "@/components/modals/FormSigningDialog";

type BookingStep = 'client' | 'service' | 'frequency' | 'review' | 'success';

interface ProposalData {
    metadata: any;
    message: any;
}

interface BookingWizardContentProps {
    conversationId?: number; // Optional now, as we might start without one
    artistServices: any[];
    artistSettings?: any;
    isArtist: boolean;
    onBookingSuccess: () => void;
    onClose: () => void;
    /** Proposal to show in the FAB (overrides booking wizard) */
    selectedProposal?: ProposalData | null;
    selectedAppointmentRaw?: any;
    clientNameOverride?: string;
    onAcceptProposal?: (appliedPromotion?: { id: number; discountAmount: number; finalAmount: number }) => void;
    onRejectProposal?: () => void;
    onCancelProposal?: () => void;
    isPendingProposalAction?: boolean;
    isLoadingProposal?: boolean;
    artistId?: string;
    showGoToChat?: boolean;
    onGoToChat?: () => void;
    /** For pre-populating dates from calendar */
    initialDate?: Date;
}

/** Collapsible policy dropdown — fetches policy content from server */
function PolicyDropdown({ label, artistId, policyType, depositAmount, totalCost }: {
    label: string;
    artistId: string;
    policyType: 'cancellation' | 'deposit';
    depositAmount?: number | null;
    totalCost?: number;
}) {
    const [open, setOpen] = useState(false);
    const { data: policy } = trpc.policies.getByType.useQuery(
        { artistId, policyType },
        { enabled: !!artistId }
    );

    const fallbackContent = policyType === 'cancellation'
        ? 'Deposits are non-refundable. Cancellations made within 48 hours of the appointment may forfeit the deposit. Please contact the artist directly for rescheduling.'
        : depositAmount
            ? `A deposit of $${depositAmount} is required to secure these dates.${totalCost ? ` The remaining balance of $${totalCost - depositAmount} is due upon completion.` : ''}`
            : 'Contact the artist for deposit requirements.';

    return (
        <div className="rounded-[4px] border border-white/5 overflow-hidden">
            <button
                type="button"
                className="flex items-center justify-between w-full px-2.5 py-2 text-[10px] font-semibold text-foreground/80 hover:bg-white/[0.02] transition-colors"
                onClick={() => setOpen(!open)}
            >
                {label}
                <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", open && "rotate-180")} />
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
    isPendingProposalAction,
    isLoadingProposal,
    artistId,
    showGoToChat,
    onGoToChat,
    initialDate
}: BookingWizardContentProps) {
    const [step, setStep] = useState<BookingStep>(initialConversationId ? 'service' : 'client');
    const [conversationId, setConversationId] = useState<number | undefined>(initialConversationId);
    const [selectedService, setSelectedService] = useState<any>(null);
    const [showVoucherList, setShowVoucherList] = useState(false);
    const [appliedPromotion, setAppliedPromotion] = useState<{
        id: number; name: string; discountAmount: number; finalAmount: number;
    } | null>(null);
    const [frequency, setFrequency] = useState<"single" | "consecutive" | "weekly" | "biweekly" | "monthly">("consecutive");
    const [startDate] = useState(initialDate || new Date());

    // -- Client Selection State --
    const [clientSearch, setClientSearch] = useState("");
    const [isAddingNewClient, setIsAddingNewClient] = useState(false);
    const [newClientData, setNewClientData] = useState({ name: "", email: "", phone: "" });
    const [isCreatingClient, setIsCreatingClient] = useState(false);
    const [showCheckInModal, setShowCheckInModal] = useState<CheckInPhase | null>(null);

    // -- Queries & Mutations --
    const { data: clients, isLoading: isLoadingClients } = trpc.conversations.getClients.useQuery(undefined, {
        enabled: isArtist && step === 'client'
    });

    const { data: pendingForms, refetch: refetchForms } = trpc.forms.getPendingForms.useQuery(
        { appointmentId: selectedAppointmentRaw?.id || 0 },
        { enabled: !isArtist && !!selectedAppointmentRaw?.id }
    );

    const [activeForm, setActiveForm] = useState<any>(null);

    const { data: availablePromotions, isLoading: isLoadingPromotions } = trpc.promotions.getAvailableForBooking.useQuery(
        { artistId: artistId || "" },
        { enabled: showVoucherList && !!artistId }
    );

    const signFormMutation = trpc.forms.signForm.useMutation({
        onSuccess: () => {
            toast.success("Form signed successfully");
            refetchForms();
            setActiveForm(null);
        },
        onError: (err) => toast.error("Failed to sign form: " + err.message)
    });

    const filteredClients = clients?.filter(c =>
        c?.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
        c?.email?.toLowerCase().includes(clientSearch.toLowerCase())
    ).slice(0, 5) || [];

    const getOrCreateConversation = trpc.conversations.getOrCreate.useMutation();
    const {
        data: availability,
        isPending: isLoadingAvailability,
        error: availabilityError
    } = trpc.booking.checkAvailability.useQuery({
        conversationId: conversationId || 0,
        serviceName: selectedService?.name || '',
        serviceDuration: selectedService?.duration || 60,
        sittings: frequency === 'single' ? 1 : (selectedService?.sittings || 1),
        price: Number(selectedService?.price) || 0,
        frequency,
        startDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, {
        enabled: step === 'review' && !!selectedService && !!conversationId,
        retry: false,
    });

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
        onError: (err) => {
            toast.error("Failed to send proposal: " + err.message);
        }
    });

    const createClientMutation = trpc.conversations.createClient.useMutation();

    const updateAppointmentMutation = trpc.appointments.update.useMutation({
        onSuccess: () => {
            if (conversationId) {
                utils.messages.list.invalidate({ conversationId });
            }
            if (selectedAppointmentRaw?.id) {
                utils.appointments.getByConversation.invalidate(conversationId);
                utils.appointments.list.invalidate(); // Re-fetch calendar events
            }
            onBookingSuccess();
        },
        onError: (err) => {
            toast.error("Failed to update appointment: " + err.message);
        }
    });

    // -- Handlers --
    const handleConfirmBooking = () => {
        if (!availability?.dates || !selectedService || !conversationId) return;

        const datesList = availability.dates
            .map((date: string | Date) => format(new Date(date), 'EEEE, MMMM do yyyy, h:mm a'))
            .join('\n');

        const finalSittings = frequency === 'single' ? 1 : (selectedService.sittings || 1);
        const message = `I have found the following dates for your ${selectedService.name} project:\n\n${datesList}\n\nThis project consists of ${finalSittings} sittings.\nFrequency: ${frequency}\nPrice per sitting: $${selectedService.price}\n\nPlease confirm these dates.`;

        const totalCost = Number(selectedService.price) * finalSittings;

        const metadata = JSON.stringify({
            type: "project_proposal",
            serviceName: selectedService.name,
            serviceDuration: selectedService.duration,
            sittings: finalSittings,
            price: Number(selectedService.price),
            totalCost: totalCost,
            frequency: frequency,
            dates: availability.dates,
            proposedDates: availability.dates,
            status: 'pending',
            bsb: artistSettings?.bsb,
            accountNumber: artistSettings?.accountNumber,
            depositAmount: artistSettings?.depositAmount,
            autoSendDeposit: artistSettings?.autoSendDepositInfo
        });

        sendMessageMutation.mutate({
            conversationId,
            content: message,
            messageType: "appointment_request",
            metadata: metadata
        });
    };

    const handleClientSelect = async (client: any) => {
        if (!artistId) return;
        try {
            const convo = await getOrCreateConversation.mutateAsync({
                artistId,
                clientId: client.id
            });
            if (convo) {
                setConversationId(convo.id);
                setStep('service');
            }
        } catch (e) {
            toast.error("Failed to start conversation");
        }
    };

    const handleCreateClientAndConvo = async () => {
        if (!artistId || !newClientData.name) return;
        setIsCreatingClient(true);
        try {
            const convo = await createClientMutation.mutateAsync({
                name: newClientData.name,
                email: newClientData.email,
                phone: newClientData.phone
            });
            if (convo) {
                setConversationId(convo.id);
                setStep('service');
                setIsAddingNewClient(false);
            }
        } catch (e: any) {
            toast.error("Failed to create client: " + e.message);
        } finally {
            setIsCreatingClient(false);
        }
    };

    const goBack = () => {
        if (step === 'service') {
            if (!initialConversationId) setStep('client');
        }
        else if (step === 'frequency') setStep('service');
        else if (step === 'review') setStep('frequency');
    };

    const fab = tokens.fab;
    const card = tokens.card;

    // Frequency options with icons
    const freqOptions = [
        { id: 'single', label: 'Single', Icon: Repeat1 },
        { id: 'consecutive', label: 'Consecutive', Icon: CalendarDays },
        { id: 'weekly', label: 'Weekly', Icon: Calendar },
        { id: 'biweekly', label: 'Bi-Weekly', Icon: Repeat },
        { id: 'monthly', label: 'Monthly', Icon: CalendarSearch },
    ] as const;

    // -- Step Titles --
    const getStepTitle = () => {
        switch (step) {
            case 'client': return "Select Client";
            case 'service': return "Select Service";
            case 'frequency': return "Frequency";
            case 'review': return "Review";
            case 'success': return "Done";
        }
    };

    // Whether to show the proposal view
    const showProposal = !!selectedProposal?.metadata;
    const proposalMeta = selectedProposal?.metadata;

    // Proposal display values
    const proposalDates = proposalMeta ? (
        Array.isArray(proposalMeta.dates) ? proposalMeta.dates
            : Array.isArray(proposalMeta.proposedDates) ? proposalMeta.proposedDates : []
    ) : [];
    const proposalTotalMinutes = proposalMeta ? ((proposalMeta.sittings || 1) * (proposalMeta.serviceDuration || 60)) : 0;
    const proposalHours = Math.floor(proposalTotalMinutes / 60);
    const hasStoredDiscount = proposalMeta?.discountApplied && proposalMeta?.finalAmount !== undefined;
    const hasCurrentDiscount = appliedPromotion !== null;
    const hasDiscount = hasCurrentDiscount || hasStoredDiscount;
    const displayTotal = hasCurrentDiscount
        ? appliedPromotion.finalAmount / 100
        : hasStoredDiscount ? proposalMeta.finalAmount / 100 : proposalMeta?.totalCost;
    // -- Render --
    if (showCheckInModal && selectedAppointmentRaw) {
        return (
            <div className="flex flex-col w-full min-h-[50vh] pt-2 pb-6 px-1">
                {/* Header */}
                <motion.div variants={fab.animation.item} className={fab.itemRow}>
                    <button onClick={() => setShowCheckInModal(null)} className={fab.itemButton}>
                        <ArrowLeft className={fab.itemIconSize} />
                    </button>
                    <span className={fab.itemLabel + " uppercase tracking-widest font-bold flex-1"}>
                        Checkout
                    </span>
                </motion.div>

                <div className="flex-1 overflow-y-auto mt-4 px-2">
                    <AppointmentCheckInModal
                        isOpen={!!showCheckInModal}
                        checkIn={{ appointment: selectedAppointmentRaw, phase: showCheckInModal }}
                        onDismiss={() => setShowCheckInModal(null)}
                        updateAppointment={updateAppointmentMutation}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 w-full">
            {/* ===== LOADING STATE ===== */}
            {isLoadingProposal && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Loading Proposal</span>
                </div>
            )}

            {/* ===== PROPOSAL VIEW ===== */}
            {!isLoadingProposal && showProposal && proposalMeta && (
                <>
                    {/* Header */}
                    <motion.div variants={fab.animation.item}>
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70 mb-0.5">
                            {clientNameOverride || "Project Proposal"}
                        </p>
                        <h3 className="text-sm font-bold text-foreground leading-tight">
                            {proposalMeta.serviceName}
                        </h3>
                    </motion.div>

                    {/* Stats */}
                    <motion.div
                        variants={fab.animation.item}
                        className={cn(card.base, "grid grid-cols-3 gap-px rounded-[4px] overflow-hidden bg-white/[0.03]")}
                    >
                        {[
                            { label: "Total", value: hasDiscount ? `$${displayTotal}` : `$${proposalMeta.totalCost}`, accent: hasDiscount },
                            { label: "Time", value: `${proposalHours}h`, accent: false },
                            { label: "Sittings", value: String(proposalMeta.sittings), accent: false },
                        ].map(({ label, value, accent }) => (
                            <div key={label} className="p-2 flex flex-col items-center gap-0.5">
                                <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
                                <span className={cn("text-xs font-bold", accent ? "text-emerald-500" : "text-foreground")}>{value}</span>
                            </div>
                        ))}
                    </motion.div>

                    {/* Discount badge */}
                    {hasDiscount && (
                        <motion.div variants={fab.animation.item} className="flex items-center gap-1.5 px-2 py-1 rounded-[4px] bg-emerald-500/10">
                            <Tag className="w-3 h-3 text-emerald-500" />
                            <span className="text-[9px] font-medium text-emerald-500">
                                {hasCurrentDiscount ? appliedPromotion.name : proposalMeta.promotionName || 'Promotion'} applied
                            </span>
                        </motion.div>
                    )}

                    {/* Dates */}
                    {proposalDates.length > 0 && (
                        <motion.div variants={fab.animation.item} className="space-y-1">
                            <p className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Schedule</p>
                            <div className="max-h-[160px] overflow-y-auto no-scrollbar space-y-1 pr-1">
                                {proposalDates.map((dateStr: string, i: number) => (
                                    <div key={i} className={cn(card.base, card.bg, "flex items-center gap-2 p-1.5 rounded-[4px]")}>
                                        <span className="w-4 h-4 rounded-full bg-white/5 flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0">
                                            {i + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-semibold text-foreground truncate">
                                                {format(new Date(dateStr), "EEE, MMM d")}
                                            </p>
                                            <p className="text-[8px] text-muted-foreground">
                                                {format(new Date(dateStr), "h:mm a")} · {proposalMeta.serviceDuration}m
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Client actions — pending */}
                    {!isArtist && proposalMeta.status === 'pending' && (
                        <motion.div variants={fab.animation.item} className="space-y-2 pt-1">
                            {!appliedPromotion && artistId && (
                                <button
                                    className={cn(card.base, card.bg, card.interactive, "flex items-center gap-2 p-2 w-full rounded-[4px]")}
                                    onClick={() => setShowVoucherList(true)}
                                >
                                    <div className={cn(fab.itemButton, "shrink-0 !w-7 !h-7")}>
                                        <Tag className="w-3 h-3" />
                                    </div>
                                    <span className="text-[10px] font-semibold text-foreground">Apply Voucher</span>
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
                                    onClick={() => onAcceptProposal?.(appliedPromotion ? {
                                        id: appliedPromotion.id,
                                        discountAmount: appliedPromotion.discountAmount,
                                        finalAmount: appliedPromotion.finalAmount,
                                    } : undefined)}
                                    disabled={isPendingProposalAction}
                                    className="py-2 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    {isPendingProposalAction ? "..." : "Accept"}
                                </button>
                            </div>
                            <p className="text-[8px] text-muted-foreground text-center leading-tight">
                                By accepting, you agree to the cancellation and deposit policies above.
                            </p>
                        </motion.div>
                    )}

                    {/* Artist actions — pending */}
                    {isArtist && proposalMeta.status === 'pending' && (
                        <motion.div variants={fab.animation.item} className="space-y-2 pt-1">
                            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-[4px] bg-orange-500/10">
                                <span className="relative flex h-1.5 w-1.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500" />
                                </span>
                                <span className="text-[9px] font-medium text-orange-500">Awaiting client response</span>
                            </div>
                            <button
                                onClick={onCancelProposal}
                                className="w-full py-2 rounded-[4px] text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 bg-white/5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                            >
                                Cancel Proposal
                            </button>
                        </motion.div>
                    )}

                    {/* Status — accepted/rejected */}
                    {proposalMeta.status === 'accepted' && (
                        <motion.div variants={fab.animation.item} className="flex items-center gap-1.5 px-2 py-2 rounded-[4px] bg-emerald-500/10">
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-500">Accepted</span>
                        </motion.div>
                    )}

                    {!isArtist && proposalMeta.status === 'accepted' && artistSettings?.businessAddress && (
                        <motion.div variants={fab.animation.item}>
                            <button
                                className={cn(card.base, card.bg, card.interactive, "flex items-center gap-2 p-2 w-full rounded-[4px]")}
                                onClick={() => {
                                    const addr = encodeURIComponent(artistSettings.businessAddress);
                                    const platform = Capacitor.getPlatform();
                                    if (platform === 'ios') window.location.href = `maps://?q=${addr}`;
                                    else if (platform === 'android') window.location.href = `geo:0,0?q=${addr}`;
                                    else window.open(`https://maps.google.com/?q=${addr}`, '_blank');
                                }}
                            >
                                <div className={cn(fab.itemButton, "shrink-0 !w-7 !h-7")}>
                                    <MapPin className="w-3 h-3" />
                                </div>
                                <span className="text-[10px] font-semibold text-foreground">Open in Maps</span>
                            </button>
                        </motion.div>
                    )}

                    {proposalMeta.status === 'rejected' && (
                        <motion.div variants={fab.animation.item} className="flex items-center gap-1.5 px-2 py-2 rounded-[4px] bg-red-500/10">
                            <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                            <span className="text-[10px] font-bold text-red-500">Declined</span>
                        </motion.div>
                    )}

                    {/* Artist actions — completed state */}
                    {isArtist && selectedAppointmentRaw?.status === 'completed' && (
                        <motion.div variants={fab.animation.item} className="pt-1">
                            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-500/10 text-zinc-400 rounded-[4px] border border-zinc-500/20 justify-center">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Project Complete</span>
                            </div>
                        </motion.div>
                    )}

                    {/* Artist actions — check-in & checkout flow */}
                    {isArtist && proposalMeta.status === 'accepted' && selectedAppointmentRaw && selectedAppointmentRaw.status !== 'completed' && (
                        <motion.div variants={fab.animation.item} className="pt-1 flex flex-col gap-2">
                            {!(selectedAppointmentRaw.clientArrived === 1 || selectedAppointmentRaw.clientArrived === true) ? (
                                <button
                                    onClick={() => setShowCheckInModal('arrival')}
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
                                        <span className="text-[10px] font-bold uppercase tracking-widest">In Progress</span>
                                    </div>
                                    <button
                                        onClick={() => setShowCheckInModal('completion')}
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
                                className={cn(card.base, card.bgAccent, card.interactive, "flex items-center gap-2 p-2 w-full rounded-[4px] border border-primary/20")}
                            >
                                <div className={cn(fab.itemButtonHighlight, "shrink-0 !w-7 !h-7")}>
                                    <MessageCircle className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-[10px] font-bold text-foreground">Go to Chat</span>
                            </button>
                        </motion.div>
                    )}

                    {/* Pending Forms Action */}
                    {!isArtist && pendingForms && pendingForms.length > 0 && (
                        <motion.div variants={fab.animation.item} className="pt-1">
                            <button
                                onClick={() => setActiveForm(pendingForms[0])}
                                className={cn(card.base, "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20", card.interactive, "flex items-center gap-2 p-2 w-full rounded-[4px] border border-orange-500/20")}
                            >
                                <div className={cn(fab.itemButton, "shrink-0 !w-7 !h-7 bg-orange-500/20 text-orange-500")}>
                                    <FileSignature className="w-3.5 h-3.5" />
                                </div>
                                <div className="flex-1 flex justify-between items-center text-[10px] font-bold">
                                    <span>Sign Required Forms</span>
                                    <span className="w-4 h-4 bg-orange-500 text-white rounded-full flex items-center justify-center text-[8px]">{pendingForms.length}</span>
                                </div>
                            </button>
                        </motion.div>
                    )}
                </>
            )}

            {/* Forms Dialog */}
            {activeForm && (
                <FormSigningDialog
                    isOpen={!!activeForm}
                    onClose={() => setActiveForm(null)}
                    onSign={async (signature) => {
                        await signFormMutation.mutateAsync({
                            formId: activeForm.id,
                            signature
                        });
                    }}
                    formTitle={activeForm.title}
                    formContent={activeForm.content}
                    isSigning={signFormMutation.isPending}
                />
            )}

            {/* ===== BOOKING WIZARD ===== */}
            {!isLoadingProposal && !showProposal && (
                <>
                    {/* Header */}
                    <motion.div variants={fab.animation.item} className={fab.itemRow}>
                        {step !== 'service' && step !== 'success' && (
                            <button onClick={goBack} className={fab.itemButton}>
                                <ArrowLeft className={fab.itemIconSize} />
                            </button>
                        )}
                        <span className={fab.itemLabel + " uppercase tracking-widest font-bold flex-1"}>
                            {getStepTitle()}
                        </span>
                        {selectedService && step !== 'service' && (
                            <span className={fab.itemLabel}>{selectedService.name}</span>
                        )}
                    </motion.div>

                    {/* Step Content */}
                    {step === 'client' && (
                        <div className="flex flex-col gap-3 -my-2 w-full pt-1">
                            {!isAddingNewClient ? (
                                <>
                                    {/* Search Input */}
                                    <div className={cn(card.base, card.bg, "px-3 py-2 flex items-center gap-2 rounded-[4px]")}>
                                        <Loader2 className={cn("w-3.5 h-3.5 animate-spin text-muted-foreground", !isLoadingClients && "hidden")} />
                                        {!isLoadingClients && <CalendarSearch className="w-3.5 h-3.5 text-muted-foreground" />}
                                        <input
                                            type="text"
                                            placeholder="Search existing clients..."
                                            className="bg-transparent border-none outline-none text-[11px] placeholder:text-muted-foreground/50 w-full"
                                            value={clientSearch}
                                            onChange={(e) => setClientSearch(e.target.value)}
                                        />
                                    </div>

                                    {/* Client List */}
                                    <div className="flex flex-col gap-1.5 min-h-[140px]">
                                        {filteredClients?.map(client => (
                                            <motion.button
                                                key={client?.id}
                                                variants={fab.animation.item}
                                                className={cn(card.base, card.bg, card.interactive, "p-2.5 flex items-center gap-2.5 w-full text-left")}
                                                onClick={() => handleClientSelect(client)}
                                            >
                                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                                                    {client?.name?.charAt(0) || '?'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-semibold text-foreground truncate">{client?.name}</p>
                                                    <p className="text-[9px] text-muted-foreground truncate">{client?.email || 'No email'}</p>
                                                </div>
                                            </motion.button>
                                        ))}

                                        {clientSearch && filteredClients?.length === 0 && !isLoadingClients && (
                                            <div className="py-8 text-center">
                                                <p className="text-[10px] text-muted-foreground">No clients found matching "{clientSearch}"</p>
                                            </div>
                                        )}

                                        {!clientSearch && filteredClients.length === 0 && !isLoadingClients && (
                                            <div className="py-8 text-center">
                                                <p className="text-[10px] text-muted-foreground italic">Search for a client or add a new one</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Add New Button */}
                                    <button
                                        onClick={() => setIsAddingNewClient(true)}
                                        className={cn(card.base, card.bgAccent, card.interactive, "p-2.5 flex items-center justify-center gap-2 w-full mt-1 border border-primary/20")}
                                    >
                                        <div className={cn(fab.itemButtonHighlight, "!w-6 !h-6")}>
                                            <Send className="w-3 h-3" />
                                        </div>
                                        <span className="text-[10px] font-bold text-foreground">Add New Client</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    {/* New Client Form */}
                                    <div className="space-y-3">
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Client Name</label>
                                            <input
                                                type="text"
                                                className={cn(card.base, card.bg, "w-full px-3 py-2 text-[11px] outline-none border border-white/5 focus:border-primary/30 transition-colors")}
                                                placeholder="e.g. John Smith"
                                                value={newClientData.name}
                                                onChange={(e) => setNewClientData({ ...newClientData, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Email Address</label>
                                            <input
                                                type="email"
                                                className={cn(card.base, card.bg, "w-full px-3 py-2 text-[11px] outline-none border border-white/5 focus:border-primary/30 transition-colors")}
                                                placeholder="j.smith@example.com"
                                                value={newClientData.email}
                                                onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Phone Number (Optional)</label>
                                            <input
                                                type="tel"
                                                className={cn(card.base, card.bg, "w-full px-3 py-2 text-[11px] outline-none border border-white/5 focus:border-primary/30 transition-colors")}
                                                placeholder="0412 345 678"
                                                value={newClientData.phone}
                                                onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <button
                                                onClick={() => setIsAddingNewClient(false)}
                                                className="py-2.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider bg-white/5 text-muted-foreground hover:bg-white/10"
                                            >
                                                Back
                                            </button>
                                            <button
                                                onClick={handleCreateClientAndConvo}
                                                disabled={!newClientData.name || isCreatingClient}
                                                className="py-2.5 rounded-[4px] text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-1.5"
                                            >
                                                {isCreatingClient ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                Continue
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {step === 'service' && (
                        <div className="flex flex-col -my-2 w-full">
                            {artistServices.map(service => (
                                <motion.div
                                    key={service.id || service.name}
                                    variants={fab.animation.item}
                                    className={cn(card.base, card.bg, card.interactive, "p-2 flex items-center gap-2 w-full")}
                                    onClick={() => {
                                        setSelectedService(service);
                                        setTimeout(() => setStep('frequency'), 150);
                                    }}
                                >
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className="text-xs font-semibold text-foreground truncate">{service.name}</p>
                                        <p className="text-[9px] text-muted-foreground font-mono flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5 shrink-0" />
                                            {service.duration}m · ${service.price} · {service.sittings || 1}s
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                            {artistServices.length === 0 && (
                                <motion.div variants={fab.animation.item} className={cn(card.base, card.bg, "p-2 w-full")}>
                                    <span className={fab.itemLabel}>No services configured.</span>
                                </motion.div>
                            )}
                        </div>
                    )}

                    {step === 'frequency' && (
                        <div className="flex flex-col -my-2 w-full">
                            {freqOptions.map(({ id, label, Icon }) => {
                                const isSelected = frequency === id;
                                return (
                                    <motion.div
                                        key={id}
                                        variants={fab.animation.item}
                                        className={cn(card.base, card.bg, card.interactive, "p-2 flex items-center gap-2 w-full")}
                                        onClick={() => setFrequency(id as any)}
                                    >
                                        <div className={cn(isSelected ? fab.itemButtonHighlight : fab.itemButton, "shrink-0")}>
                                            <Icon className={fab.itemIconSize} />
                                        </div>
                                        <span className="text-xs font-semibold text-foreground flex-1">{label}</span>
                                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                                    </motion.div>
                                );
                            })}
                            <motion.div
                                variants={fab.animation.item}
                                className={cn(card.base, card.bgAccent, card.interactive, "p-2 flex items-center gap-2 w-full mt-1")}
                                onClick={() => setStep('review')}
                            >
                                <div className={cn(fab.itemButtonHighlight, "shrink-0")}>
                                    <CalendarSearch className={fab.itemIconSize} />
                                </div>
                                <span className="text-xs font-bold text-foreground flex-1">Find Dates</span>
                            </motion.div>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="flex flex-col -my-2 w-full">
                            {isLoadingAvailability && (
                                <motion.div variants={fab.animation.item} className={cn(card.base, card.bg, "p-3 flex items-center justify-center gap-2 w-full")}>
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    <span className={cn(fab.itemLabel, "animate-pulse")}>Scanning...</span>
                                </motion.div>
                            )}
                            {availabilityError && (
                                <motion.div variants={fab.animation.item} className={cn(card.base, "bg-destructive/10 p-2 w-full")}>
                                    <span className={fab.itemLabel + " text-destructive"}>
                                        <AlertCircle className="w-3 h-3 inline mr-1" />
                                        {availabilityError.message}
                                    </span>
                                </motion.div>
                            )}
                            {availability && (
                                <>
                                    <motion.div variants={fab.animation.item} className={cn(card.base, card.bg, "p-2 flex items-center justify-between w-full")}>
                                        <span className={fab.itemLabel}>Cost</span>
                                        <span className="text-xs font-bold text-foreground">${availability.totalCost}</span>
                                    </motion.div>
                                    {availability.dates.map((date: string | Date, i: number) => (
                                        <motion.div key={i} variants={fab.animation.item} className={cn(card.base, card.bg, "p-2 flex items-center justify-between w-full")}>
                                            <span className={fab.itemLabel}>{format(new Date(date), "EEE, MMM do")}</span>
                                            <span className="text-[10px] font-bold text-primary">{format(new Date(date), "h:mm a")}</span>
                                        </motion.div>
                                    ))}
                                    <motion.div
                                        variants={fab.animation.item}
                                        className={cn(card.base, card.bgAccent, card.interactive, "p-2 flex items-center gap-2 w-full mt-1")}
                                        onClick={handleConfirmBooking}
                                    >
                                        <div className={cn(fab.itemButtonHighlight, "shrink-0")}>
                                            {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        </div>
                                        <span className="text-xs font-bold text-foreground flex-1">Send Proposal</span>
                                    </motion.div>
                                </>
                            )}
                        </div>
                    )}

                    {step === 'success' && (
                        <div className="flex flex-col -my-2 w-full">
                            <motion.div variants={fab.animation.item} className={cn(card.base, card.bg, "p-4 flex flex-col items-center gap-2 w-full")}>
                                <div className={fab.itemButtonHighlight}><CheckCircle2 className="w-4 h-4" /></div>
                                <span className="text-xs font-bold text-foreground">Proposal Sent!</span>
                            </motion.div>
                            <motion.div
                                variants={fab.animation.item}
                                className={cn(card.base, card.bg, card.interactive, "p-2 flex items-center gap-2 w-full")}
                                onClick={onClose}
                            >
                                <div className={fab.itemButton}><CheckCircle2 className="w-4 h-4" /></div>
                                <span className="text-xs font-semibold text-foreground flex-1">Close</span>
                            </motion.div>
                        </div>
                    )}
                </>
            )}

            {/* Support Sheet */}
            {artistId && (
                <ApplyPromotionSheet
                    isOpen={showPromotionSheet}
                    onClose={() => setShowPromotionSheet(false)}
                    artistId={artistId}
                    originalAmount={(proposalMeta?.totalCost || 0) * 100}
                    onApply={(promo, discountAmount, finalAmount) => {
                        setAppliedPromotion({ id: promo.id, name: promo.name, discountAmount, finalAmount });
                    }}
                />
            )}
        </div>
    );
}
