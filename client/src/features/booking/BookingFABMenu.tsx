import { useState, useEffect } from "react";
import {
    Clock,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Scissors,
    CalendarSearch,
    Repeat,
    Repeat1,
    Calendar,
    CalendarDays,
    Send,
    ArrowLeft,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { toast } from "sonner";
import { FABMenu } from "@/ui/FABMenu";
import { tokens } from "@/ui/tokens";

type BookingStep = 'service' | 'frequency' | 'review' | 'success';

interface BookingFABMenuProps {
    conversationId: number;
    artistServices: any[];
    artistSettings?: any;
    onBookingSuccess: () => void;
    className?: string;
}

export function BookingFABMenu({
    conversationId,
    artistServices,
    artistSettings,
    onBookingSuccess,
    className
}: BookingFABMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<BookingStep>('service');
    const [selectedService, setSelectedService] = useState<any>(null);
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
        enabled: isOpen && step === 'review' && !!selectedService,
        retry: false,
    });

    const utils = trpc.useUtils();
    const sendMessageMutation = trpc.messages.send.useMutation({
        onSuccess: () => {
            utils.messages.list.invalidate({ conversationId });
            toast.success("Proposal Sent Successfully");
            handleClose();
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

    const handleClose = () => setIsOpen(false);

    const goBack = () => {
        if (step === 'frequency') setStep('service');
        else if (step === 'review') setStep('frequency');
    };

    // Reset when menu closes
    useEffect(() => {
        if (!isOpen) {
            const timer = setTimeout(() => {
                setStep('service');
                setSelectedService(null);
                setFrequency("consecutive");
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

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

    return (
        <FABMenu
            isOpen={isOpen}
            onOpenChange={setIsOpen}
            toggleIcon={<span className="text-xl font-black tracking-tight select-none">B</span>}
            className={className}
        >
            {/* Panel Header — SSOT label style */}
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

            {/* STEP: SERVICE — SSOT cards: transparent bg, 4px radius, no gap */}
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
                            <div className={cn(fab.itemButton, "shrink-0")}>
                                <Scissors className={fab.itemIconSize} />
                            </div>
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-xs font-semibold text-foreground truncate">{service.name}</p>
                                <p className="text-[9px] text-muted-foreground font-mono flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 shrink-0" />
                                    {service.duration}m · ${service.price} · {service.sittings || 1}s
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {step === 'service' && artistServices.length === 0 && (
                <motion.div variants={fab.animation.item} className={cn(card.base, card.bg, "p-2 w-full")}>
                    <span className={fab.itemLabel}>No services configured.</span>
                </motion.div>
            )}

            {/* STEP: FREQUENCY — SSOT cards: transparent bg, 4px radius, no gap */}
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
                                {isSelected && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                )}
                            </motion.div>
                        );
                    })}

                    {/* Find Dates action card */}
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

            {/* STEP: REVIEW — SSOT cards for data rows */}
            {step === 'review' && (
                <>
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
                        <div className="flex flex-col -my-2 w-full">
                            {/* Metrics */}
                            <motion.div variants={fab.animation.item} className={cn(card.base, card.bg, "p-2 flex items-center justify-between w-full")}>
                                <span className={fab.itemLabel}>Cost</span>
                                <span className="text-xs font-bold text-foreground">${availability.totalCost}</span>
                            </motion.div>
                            <motion.div variants={fab.animation.item} className={cn(card.base, card.bg, "p-2 flex items-center justify-between w-full")}>
                                <span className={fab.itemLabel}>Sittings</span>
                                <span className="text-xs font-bold text-foreground">
                                    {frequency === 'single' ? 1 : (selectedService?.sittings || 1)}
                                </span>
                            </motion.div>
                            <motion.div variants={fab.animation.item} className={cn(card.base, card.bg, "p-2 flex items-center justify-between w-full")}>
                                <span className={fab.itemLabel}>Duration</span>
                                <span className="text-xs font-bold text-foreground">{selectedService?.duration}m</span>
                            </motion.div>

                            {/* Dates */}
                            {availability.dates.map((date: string | Date, i: number) => (
                                <motion.div key={i} variants={fab.animation.item} className={cn(card.base, card.bg, "p-2 flex items-center justify-between w-full")}>
                                    <span className={fab.itemLabel}>{format(new Date(date), "EEE, MMM do")}</span>
                                    <span className="text-[10px] font-bold text-primary">{format(new Date(date), "h:mm a")}</span>
                                </motion.div>
                            ))}

                            {/* Send action */}
                            <motion.div
                                variants={fab.animation.item}
                                className={cn(card.base, card.bgAccent, card.interactive, "p-2 flex items-center gap-2 w-full mt-1")}
                                onClick={handleConfirmBooking}
                            >
                                <div className={cn(fab.itemButtonHighlight, "shrink-0")}>
                                    {sendMessageMutation.isPending ? (
                                        <Loader2 className={cn(fab.itemIconSize, "animate-spin")} />
                                    ) : (
                                        <Send className={fab.itemIconSize} />
                                    )}
                                </div>
                                <span className="text-xs font-bold text-foreground flex-1">
                                    {sendMessageMutation.isPending ? "Sending..." : "Send Proposal"}
                                </span>
                            </motion.div>
                        </div>
                    )}
                </>
            )}

            {/* STEP: SUCCESS — SSOT cards */}
            {step === 'success' && (
                <div className="flex flex-col -my-2 w-full">
                    <motion.div variants={fab.animation.item} className={cn(card.base, card.bg, "p-4 flex flex-col items-center gap-2 w-full")}>
                        <div className={fab.itemButtonHighlight}>
                            <CheckCircle2 className={fab.itemIconSize} />
                        </div>
                        <span className="text-xs font-bold text-foreground">Proposal Sent!</span>
                    </motion.div>
                    <motion.div
                        variants={fab.animation.item}
                        className={cn(card.base, card.bg, card.interactive, "p-2 flex items-center gap-2 w-full")}
                        onClick={handleClose}
                    >
                        <div className={cn(fab.itemButton, "shrink-0")}>
                            <CheckCircle2 className={fab.itemIconSize} />
                        </div>
                        <span className="text-xs font-semibold text-foreground flex-1">Close</span>
                    </motion.div>
                </div>
            )}
        </FABMenu>
    );
}
