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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { tokens } from "@/ui/tokens";
import { ApplyPromotionSheet } from "@/features/promotions";

type BookingStep = 'service' | 'frequency' | 'review' | 'success';

interface ProposalData {
    metadata: any;
    message: any;
}

interface BookingWizardContentProps {
    conversationId: number;
    artistServices: any[];
    artistSettings?: any;
    isArtist: boolean;
    onBookingSuccess: () => void;
    onClose: () => void;
    /** Proposal to show in the FAB (overrides booking wizard) */
    selectedProposal?: ProposalData | null;
    onAcceptProposal?: (appliedPromotion?: { id: number; discountAmount: number; finalAmount: number }) => void;
    onRejectProposal?: () => void;
    onCancelProposal?: () => void;
    isPendingProposalAction?: boolean;
    artistId?: string;
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
    conversationId,
    artistServices,
    artistSettings,
    isArtist,
    onBookingSuccess,
    onClose,
    selectedProposal,
    onAcceptProposal,
    onRejectProposal,
    onCancelProposal,
    isPendingProposalAction,
    artistId,
}: BookingWizardContentProps) {
    const [step, setStep] = useState<BookingStep>('service');
    const [selectedService, setSelectedService] = useState<any>(null);
    const [showPromotionSheet, setShowPromotionSheet] = useState(false);
    const [appliedPromotion, setAppliedPromotion] = useState<{
        id: number; name: string; discountAmount: number; finalAmount: number;
    } | null>(null);
    const [frequency, setFrequency] = useState<"single" | "consecutive" | "weekly" | "biweekly" | "monthly">("consecutive");
    const [startDate] = useState(new Date());

    // -- Queries & Mutations --
    const {
        data: availability,
        isPending: isLoadingAvailability,
        error: availabilityError
    } = trpc.booking.checkAvailability.useQuery({
        conversationId,
        serviceName: selectedService?.name || '',
        serviceDuration: selectedService?.duration || 60,
        sittings: frequency === 'single' ? 1 : (selectedService?.sittings || 1),
        price: Number(selectedService?.price) || 0,
        frequency,
        startDate,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, {
        enabled: step === 'review' && !!selectedService,
        retry: false,
    });

    const utils = trpc.useUtils();
    const sendMessageMutation = trpc.messages.send.useMutation({
        onSuccess: () => {
            utils.messages.list.invalidate({ conversationId });
            toast.success("Proposal Sent Successfully");
            onClose();
            onBookingSuccess();
        },
        onError: (err) => {
            toast.error("Failed to send proposal: " + err.message);
        }
    });

    // -- Handlers --
    const handleConfirmBooking = () => {
        if (!availability?.dates || !selectedService) return;

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

    const goBack = () => {
        if (step === 'frequency') setStep('service');
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

    return (
        <div className="flex flex-col gap-2 w-full">
            {/* ===== PROPOSAL VIEW ===== */}
            {showProposal && proposalMeta && (
                <>
                    {/* Header */}
                    <motion.div variants={fab.animation.item}>
                        <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary/70 mb-0.5">
                            Project Proposal
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
                            {proposalDates.slice(0, 4).map((dateStr: string, i: number) => (
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
                        </motion.div>
                    )}

                    {/* Client actions — pending */}
                    {!isArtist && proposalMeta.status === 'pending' && (
                        <motion.div variants={fab.animation.item} className="space-y-2 pt-1">
                            {!appliedPromotion && artistId && (
                                <button
                                    className={cn(card.base, card.bg, card.interactive, "flex items-center gap-2 p-2 w-full rounded-[4px]")}
                                    onClick={() => setShowPromotionSheet(true)}
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
                </>
            )}

            {/* ===== BOOKING WIZARD ===== */}
            {!showProposal && (
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
