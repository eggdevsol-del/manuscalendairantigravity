import { useState, useEffect } from "react";
import {
    X,
    Clock,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Calendar,
    ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { toast } from "sonner";
import { SelectionCard } from "@/components/ui/ssot";

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

    const handleClose = () => {
        setIsOpen(false);
    };

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

    // Animation variants
    const panelVariants = {
        hidden: { opacity: 0, scale: 0.85, y: 20 },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                type: "spring" as const,
                stiffness: 300,
                damping: 25,
                delayChildren: 0.1,
                staggerChildren: 0.04
            }
        },
        exit: {
            opacity: 0,
            scale: 0.85,
            y: 20,
            transition: { duration: 0.2 }
        }
    };

    const itemVariants = {
        hidden: { y: 12, opacity: 0 },
        visible: { y: 0, opacity: 1 }
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
        <div className={cn("fixed bottom-[126px] right-5 z-[55] flex flex-col items-end gap-3", className)}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={panelVariants}
                        className="mb-2 rounded-[2rem] border border-white/10 shadow-2xl flex flex-col bg-gray-100/[0.75] dark:bg-slate-950/[0.85] backdrop-blur-[32px] w-[320px] max-h-[60vh] overflow-hidden"
                    >
                        {/* Panel Header */}
                        <div className="flex items-center justify-between px-5 pt-5 pb-3">
                            <div className="flex items-center gap-2">
                                {step !== 'service' && step !== 'success' && (
                                    <button
                                        onClick={goBack}
                                        className="p-1 rounded-full hover:bg-white/10 transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                )}
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    {getStepTitle()}
                                </span>
                            </div>
                            {selectedService && step !== 'service' && (
                                <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    {selectedService.name}
                                </span>
                            )}
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto px-4 pb-5 custom-scrollbar">
                            {/* STEP: SERVICE */}
                            {step === 'service' && (
                                <motion.div
                                    variants={panelVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="space-y-2"
                                >
                                    {artistServices.map(service => (
                                        <motion.div key={service.id || service.name} variants={itemVariants}>
                                            <button
                                                onClick={() => {
                                                    setSelectedService(service);
                                                    setTimeout(() => setStep('frequency'), 150);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between gap-3 p-3 rounded-2xl transition-all",
                                                    "bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30",
                                                    "active:scale-[0.98]"
                                                )}
                                            >
                                                <div className="flex-1 text-left">
                                                    <p className="text-sm font-semibold text-foreground">{service.name}</p>
                                                    <div className="flex gap-2 text-[10px] text-muted-foreground font-mono mt-0.5">
                                                        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{service.duration}m</span>
                                                        <span className="font-bold text-foreground/70">${service.price}</span>
                                                        <span>• {service.sittings || 1} sitting{(service.sittings || 1) > 1 ? 's' : ''}</span>
                                                    </div>
                                                </div>
                                                <div className="w-2 h-2 rounded-full bg-primary/30" />
                                            </button>
                                        </motion.div>
                                    ))}
                                    {artistServices.length === 0 && (
                                        <p className="text-xs text-muted-foreground text-center py-6">
                                            No services configured. Add services in Settings.
                                        </p>
                                    )}
                                </motion.div>
                            )}

                            {/* STEP: FREQUENCY */}
                            {step === 'frequency' && (
                                <motion.div
                                    variants={panelVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="space-y-2"
                                >
                                    {[
                                        { id: 'single', label: 'Single Sitting', sub: 'One session only' },
                                        { id: 'consecutive', label: 'Consecutive', sub: 'Back-to-back days' },
                                        { id: 'weekly', label: 'Weekly', sub: 'Same day each week' },
                                        { id: 'biweekly', label: 'Bi-Weekly', sub: 'Every two weeks' },
                                        { id: 'monthly', label: 'Monthly', sub: 'Once a month' }
                                    ].map((opt) => (
                                        <motion.div key={opt.id} variants={itemVariants}>
                                            <button
                                                onClick={() => setFrequency(opt.id as any)}
                                                className={cn(
                                                    "w-full flex items-center justify-between gap-3 p-3 rounded-2xl transition-all",
                                                    "border active:scale-[0.98]",
                                                    frequency === opt.id
                                                        ? "bg-primary/10 border-primary/30"
                                                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                                                )}
                                            >
                                                <div className="text-left">
                                                    <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                                                    <p className="text-[10px] text-muted-foreground">{opt.sub}</p>
                                                </div>
                                                <div className={cn(
                                                    "w-2.5 h-2.5 rounded-full transition-colors",
                                                    frequency === opt.id ? "bg-primary" : "bg-white/10"
                                                )} />
                                            </button>
                                        </motion.div>
                                    ))}

                                    <motion.div variants={itemVariants}>
                                        <Button
                                            className="w-full mt-3 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground h-10 text-sm font-semibold rounded-xl"
                                            onClick={() => setStep('review')}
                                        >
                                            Find Available Dates
                                        </Button>
                                    </motion.div>
                                </motion.div>
                            )}

                            {/* STEP: REVIEW */}
                            {step === 'review' && (
                                <motion.div
                                    variants={panelVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="space-y-3"
                                >
                                    {isLoadingAvailability && (
                                        <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                            <p className="text-xs font-medium text-muted-foreground animate-pulse">Scanning calendar...</p>
                                        </div>
                                    )}

                                    {availabilityError && (
                                        <Card className="p-4 bg-destructive/10 border-0 rounded-xl">
                                            <h5 className="font-bold text-destructive flex items-center gap-2 mb-1 text-xs">
                                                <AlertCircle className="w-3 h-3" />
                                                Failed
                                            </h5>
                                            <p className="text-[10px] text-destructive/80 leading-relaxed">
                                                {availabilityError.message}
                                            </p>
                                        </Card>
                                    )}

                                    {availability && (
                                        <>
                                            {/* Metrics Row */}
                                            <div className="flex items-center justify-between px-1">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Cost</span>
                                                    <span className="text-lg font-bold text-foreground">${availability.totalCost}</span>
                                                </div>
                                                <div className="h-6 w-px bg-white/10" />
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Sittings</span>
                                                    <span className="text-lg font-bold text-foreground">{frequency === 'single' ? 1 : (selectedService?.sittings || 1)}</span>
                                                </div>
                                                <div className="h-6 w-px bg-white/10" />
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Duration</span>
                                                    <span className="text-lg font-bold text-foreground">{selectedService?.duration}m</span>
                                                </div>
                                            </div>

                                            {/* Dates List */}
                                            <Card className="bg-white/5 border-0 rounded-xl overflow-hidden p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Schedule</span>
                                                    <span className="text-[9px] font-bold bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">
                                                        {availability.dates.length} Dates
                                                    </span>
                                                </div>
                                                <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                                    {availability.dates.map((date: string | Date, i: number) => (
                                                        <div key={i} className="flex items-center gap-3">
                                                            <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground font-bold text-[10px]">
                                                                {i + 1}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-xs font-semibold text-foreground">{format(new Date(date), "EEE, MMM do")}</p>
                                                            </div>
                                                            <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                                                                {format(new Date(date), "h:mm a")}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </Card>

                                            {/* Action Buttons */}
                                            <Button
                                                className="w-full shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground h-10 text-sm font-semibold rounded-xl"
                                                onClick={handleConfirmBooking}
                                                disabled={sendMessageMutation.isPending}
                                            >
                                                {sendMessageMutation.isPending ? (
                                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending...</>
                                                ) : (
                                                    "Send Proposal"
                                                )}
                                            </Button>
                                        </>
                                    )}
                                </motion.div>
                            )}

                            {/* STEP: SUCCESS */}
                            {step === 'success' && (
                                <motion.div
                                    variants={panelVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="flex flex-col items-center justify-center py-8 space-y-4 text-center"
                                >
                                    <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center">
                                        <CheckCircle2 className="w-7 h-7 text-primary" />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-bold text-foreground tracking-tight">Sent!</h3>
                                        <p className="text-xs text-muted-foreground">Proposal sent to client.</p>
                                    </div>
                                    <Button
                                        onClick={handleClose}
                                        className="w-full shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground h-10 text-sm font-semibold rounded-xl"
                                    >
                                        Done
                                    </Button>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main "B" FAB Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-colors border border-white/10",
                    isOpen ? "bg-white text-slate-900 dark:bg-white dark:text-slate-900" : "bg-primary text-white"
                )}
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={isOpen ? "close" : "open"}
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {isOpen ? (
                            <X className="h-6 w-6" />
                        ) : (
                            <span className="text-xl font-black tracking-tight select-none">B</span>
                        )}
                    </motion.div>
                </AnimatePresence>
            </motion.button>
        </div>
    );
}
