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

    // Frequency icon map
    const freqIcon: Record<string, React.ComponentType<{ className?: string }>> = {
        single: Repeat1,
        consecutive: CalendarDays,
        weekly: Calendar,
        biweekly: Repeat,
        monthly: CalendarSearch,
    };

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
            panelClassName="w-[280px] items-stretch"
            className={className}
        >
            {/* Panel Header — SSOT label style */}
            <motion.div variants={fab.animation.item} className={fab.itemRow}>
                {step !== 'service' && step !== 'success' && (
                    <button
                        onClick={goBack}
                        className={fab.itemButton}
                    >
                        <ArrowLeft className={fab.itemIconSize} />
                    </button>
                )}
                <span className={fab.itemLabel + " uppercase tracking-widest font-bold flex-1"}>
                    {getStepTitle()}
                </span>
                {selectedService && step !== 'service' && (
                    <span className={fab.itemLabel}>
                        {selectedService.name}
                    </span>
                )}
            </motion.div>

            {/* STEP: SERVICE — SSOT item rows with small round buttons */}
            {step === 'service' && artistServices.map(service => (
                <motion.div
                    key={service.id || service.name}
                    variants={fab.animation.item}
                    className={fab.itemRow}
                >
                    <div className="flex-1 text-right">
                        <span className={fab.itemLabel}>{service.name}</span>
                        <span className={fab.itemLabel + " block text-[9px] opacity-60"}>
                            {service.duration}m · ${service.price} · {service.sittings || 1}s
                        </span>
                    </div>
                    <button
                        className={fab.itemButton}
                        onClick={() => {
                            setSelectedService(service);
                            setTimeout(() => setStep('frequency'), 150);
                        }}
                    >
                        <Scissors className={fab.itemIconSize} />
                    </button>
                </motion.div>
            ))}

            {step === 'service' && artistServices.length === 0 && (
                <motion.div variants={fab.animation.item} className={fab.itemRow}>
                    <span className={fab.itemLabel}>No services configured.</span>
                </motion.div>
            )}

            {/* STEP: FREQUENCY — SSOT item rows */}
            {step === 'frequency' && (
                <>
                    {[
                        { id: 'single', label: 'Single' },
                        { id: 'consecutive', label: 'Consecutive' },
                        { id: 'weekly', label: 'Weekly' },
                        { id: 'biweekly', label: 'Bi-Weekly' },
                        { id: 'monthly', label: 'Monthly' }
                    ].map((opt) => {
                        const Icon = freqIcon[opt.id] || Calendar;
                        const isSelected = frequency === opt.id;
                        return (
                            <motion.div
                                key={opt.id}
                                variants={fab.animation.item}
                                className={fab.itemRow}
                            >
                                <span className={fab.itemLabel}>{opt.label}</span>
                                <button
                                    className={cn(
                                        isSelected ? fab.itemButtonHighlight : fab.itemButton
                                    )}
                                    onClick={() => setFrequency(opt.id as any)}
                                >
                                    <Icon className={fab.itemIconSize} />
                                </button>
                            </motion.div>
                        );
                    })}

                    {/* Find Dates action — highlight button */}
                    <motion.div variants={fab.animation.item} className={fab.itemRow}>
                        <span className={fab.itemLabel}>Find Available Dates</span>
                        <button
                            className={fab.itemButtonHighlight}
                            onClick={() => setStep('review')}
                        >
                            <CalendarSearch className={fab.itemIconSize} />
                        </button>
                    </motion.div>
                </>
            )}

            {/* STEP: REVIEW — SSOT row layout for data display */}
            {step === 'review' && (
                <>
                    {isLoadingAvailability && (
                        <motion.div variants={fab.animation.item} className={cn(fab.itemRow, "justify-center py-6")}>
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            <span className={cn(fab.itemLabel, "animate-pulse")}>Scanning...</span>
                        </motion.div>
                    )}

                    {availabilityError && (
                        <motion.div variants={fab.animation.item} className={fab.itemRow}>
                            <span className={fab.itemLabel + " text-destructive"}>
                                <AlertCircle className="w-3 h-3 inline mr-1" />
                                {availabilityError.message}
                            </span>
                        </motion.div>
                    )}

                    {availability && (
                        <>
                            {/* Metrics as SSOT item rows */}
                            <motion.div variants={fab.animation.item} className={fab.itemRow}>
                                <span className={fab.itemLabel}>Total Cost</span>
                                <span className={fab.itemLabel + " font-bold text-foreground"}>${availability.totalCost}</span>
                            </motion.div>
                            <motion.div variants={fab.animation.item} className={fab.itemRow}>
                                <span className={fab.itemLabel}>Sittings</span>
                                <span className={fab.itemLabel + " font-bold text-foreground"}>
                                    {frequency === 'single' ? 1 : (selectedService?.sittings || 1)}
                                </span>
                            </motion.div>
                            <motion.div variants={fab.animation.item} className={fab.itemRow}>
                                <span className={fab.itemLabel}>Duration</span>
                                <span className={fab.itemLabel + " font-bold text-foreground"}>{selectedService?.duration}m</span>
                            </motion.div>

                            {/* Dates as compact SSOT rows */}
                            {availability.dates.map((date: string | Date, i: number) => (
                                <motion.div key={i} variants={fab.animation.item} className={fab.itemRow}>
                                    <span className={fab.itemLabel}>
                                        {format(new Date(date), "EEE, MMM do")}
                                    </span>
                                    <span className={fab.itemLabel + " font-bold text-foreground"}>
                                        {format(new Date(date), "h:mm a")}
                                    </span>
                                </motion.div>
                            ))}

                            {/* Send Proposal action — highlight button */}
                            <motion.div variants={fab.animation.item} className={fab.itemRow}>
                                <span className={fab.itemLabel}>
                                    {sendMessageMutation.isPending ? "Sending..." : "Send Proposal"}
                                </span>
                                <button
                                    className={fab.itemButtonHighlight}
                                    onClick={handleConfirmBooking}
                                    disabled={sendMessageMutation.isPending}
                                >
                                    {sendMessageMutation.isPending ? (
                                        <Loader2 className={cn(fab.itemIconSize, "animate-spin")} />
                                    ) : (
                                        <Send className={fab.itemIconSize} />
                                    )}
                                </button>
                            </motion.div>
                        </>
                    )}
                </>
            )}

            {/* STEP: SUCCESS — SSOT rows */}
            {step === 'success' && (
                <>
                    <motion.div variants={fab.animation.item} className={cn(fab.itemRow, "justify-center py-4")}>
                        <div className={fab.itemButtonHighlight}>
                            <CheckCircle2 className={fab.itemIconSize} />
                        </div>
                    </motion.div>
                    <motion.div variants={fab.animation.item} className={cn(fab.itemRow, "justify-center")}>
                        <span className={fab.itemLabel + " font-bold text-foreground"}>Proposal Sent!</span>
                    </motion.div>
                    <motion.div variants={fab.animation.item} className={fab.itemRow}>
                        <span className={fab.itemLabel}>Close</span>
                        <button className={fab.itemButton} onClick={handleClose}>
                            <CheckCircle2 className={fab.itemIconSize} />
                        </button>
                    </motion.div>
                </>
            )}
        </FABMenu>
    );
}
