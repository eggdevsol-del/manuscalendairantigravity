import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Calendar, AlertCircle, CheckCircle2, Clock, Check, X, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FullScreenSheet } from "@/components/ui/ssot";

type WizardStep = 'service' | 'frequency' | 'review' | 'manual' | 'success';

interface BookingWizardProps {
    isOpen: boolean;
    onClose: () => void;
    conversationId: number;
    artistServices: any[];
    artistSettings?: any;
    onBookingSuccess: () => void;
    overlayName?: string;
    overlayId?: string;
}

// -- Canonical Components --

function SelectableCard({
    selected,
    onClick,
    title,
    subtitle,
    children,
    rightElement
}: {
    selected: boolean;
    onClick: () => void;
    title: string;
    subtitle?: React.ReactNode;
    children?: React.ReactNode;
    rightElement?: React.ReactNode;
}) {
    return (
        <div
            className={cn(
                "p-4 border rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-between group",
                selected
                    ? "bg-primary/10 border-primary/50"
                    : "bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/10 dark:hover:bg-white/10 hover:border-black/20 dark:hover:border-white/20"
            )}
            onClick={onClick}
        >
            <div className="flex-1">
                <h3 className={cn("font-semibold text-base transition-colors", selected ? "text-primary" : "text-foreground group-hover:text-foreground")}>
                    {title}
                </h3>
                {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
                {children}
            </div>

            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border transition-all ml-4",
                selected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "bg-transparent border-black/20 dark:border-white/20 text-transparent group-hover:border-black/40 dark:group-hover:border-white/40"
            )}>
                {rightElement || <Check className="w-4 h-4" />}
            </div>
        </div>
    );
}

export function BookingWizard({ isOpen, onClose, conversationId, artistServices, artistSettings, onBookingSuccess }: BookingWizardProps) {
    const [step, setStep] = useState<WizardStep>('service');
    const [selectedService, setSelectedService] = useState<any>(null);
    const [frequency, setFrequency] = useState<"single" | "consecutive" | "weekly" | "biweekly" | "monthly">("consecutive");
    const [startDate] = useState(new Date());

    // -- Queries & Mutations --

    // 1. Availability Query (Only runs on Review step)
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

    // 2. Send Proposal Mutation
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

    const reset = () => {
        setStep('service');
        setSelectedService(null);
        setFrequency("consecutive");
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const goBack = () => {
        if (step === 'frequency') setStep('service');
        if (step === 'review') setStep('frequency');
        if (step === 'manual') setStep('review');
    };

    // -- Header Titles --
    const getStepTitle = () => {
        switch (step) {
            case 'service': return "Select Service";
            case 'frequency': return "Select Frequency";
            case 'review': return "Review Proposal";
            case 'manual': return "Select Dates";
            case 'success': return "Proposal Sent";
        }
    };

    // -- Context Area Content --
    const getContextContent = () => {
        switch (step) {
            case 'service':
                return (
                    <p className="text-4xl font-light text-foreground/90 tracking-tight">Booking</p>
                );
            case 'frequency':
                return (
                    <div>
                        <p className="text-lg font-bold text-white">{selectedService?.name}</p>
                        <p className="text-sm text-white/70">{selectedService?.duration}min • ${selectedService?.price}</p>
                    </div>
                );
            case 'review':
                return (
                    <div>
                        <p className="text-4xl font-light text-foreground/90 tracking-tight">Summary</p>
                        <p className="text-sm text-muted-foreground mt-1">{frequency} • {selectedService?.name}</p>
                    </div>
                );
            case 'manual':
                return (
                    <div>
                        <p className="text-4xl font-light text-foreground/90 tracking-tight">Manual Selection</p>
                        <p className="text-sm text-muted-foreground mt-1">Choose specific dates for this project</p>
                    </div>
                );
            case 'success':
                return (
                    <p className="text-4xl font-light text-foreground/90 tracking-tight">Done</p>
                );
        }
    };

    // -- Render Content --

    return (
        <FullScreenSheet
            open={isOpen}
            onClose={handleClose}
            title={getStepTitle()}
            contextContent={getContextContent()}
            onBack={step === 'success' ? undefined : (step === 'service' ? onClose : goBack)}
        >
            <div className="space-y-4">
                {/* STEP: SERVICE */}
                {step === 'service' && (
                    <div className="space-y-3">
                        {artistServices.map(service => (
                            <SelectableCard
                                key={service.id || service.name}
                                selected={!!selectedService && (
                                    (selectedService.id && selectedService.id === service.id) ||
                                    (selectedService.name === service.name)
                                )}
                                onClick={() => {
                                    setSelectedService(service);
                                    setTimeout(() => setStep('frequency'), 200);
                                }}
                                title={service.name}
                                subtitle={
                                    <div className="flex gap-3 text-xs text-muted-foreground font-mono">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {service.duration}m</span>
                                        <span className={cn("font-bold", (selectedService && (
                                            (selectedService.id && selectedService.id === service.id) ||
                                            (selectedService.name === service.name)
                                        )) ? "text-primary" : "text-muted-foreground")}>${service.price}</span>
                                        <span>• {service.sittings || 1} sitting{(service.sittings || 1) > 1 ? 's' : ''}</span>
                                    </div>
                                }
                                rightElement={<Check className="w-4 h-4" />}
                            />
                        ))}
                    </div>
                )}

                {/* STEP: FREQUENCY */}
                {step === 'frequency' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-3">
                            {[
                                { id: 'single', label: 'Single Sitting', sub: 'One session only' },
                                { id: 'consecutive', label: 'Consecutive Days', sub: 'Best for intensive projects' },
                                { id: 'weekly', label: 'Weekly', sub: 'Same day each week' },
                                { id: 'biweekly', label: 'Bi-Weekly', sub: 'Every two weeks' },
                                { id: 'monthly', label: 'Monthly', sub: 'Once a month' }
                            ].map((opt) => (
                                <SelectableCard
                                    key={opt.id}
                                    selected={frequency === opt.id}
                                    onClick={() => setFrequency(opt.id as any)}
                                    title={opt.label}
                                    subtitle={opt.sub}
                                    rightElement={frequency === opt.id ? <div className="w-2.5 h-2.5 rounded-full bg-primary" /> : <div />}
                                />
                            ))}
                        </div>

                        <Button
                            className="w-full shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-semibold"
                            onClick={() => setStep('review')}
                        >
                            Find Available Dates
                        </Button>
                    </div>
                )}

                {/* STEP: REVIEW */}
                {step === 'review' && (
                    <div className="space-y-6">
                        {isLoadingAvailability && (
                            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                                <p className="text-sm font-medium text-muted-foreground animate-pulse">Scanning calendar...</p>
                            </div>
                        )}

                        {availabilityError && (
                            <Card className="p-5 bg-destructive/10 border-0 rounded-2xl">
                                <h5 className="font-bold text-destructive flex items-center gap-2 mb-2 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    Calculation Failed
                                </h5>
                                <p className="text-xs text-destructive/80 leading-relaxed">
                                    {availabilityError.message}
                                </p>
                            </Card>
                        )}

                        {availability && (
                            <>
                                {/* Unified Sheet Header for Metrics */}
                                <div className="p-0">
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Cost</span>
                                            <span className="text-2xl font-bold text-foreground tracking-tight">${availability.totalCost}</span>
                                        </div>
                                        <div className="h-8 w-px bg-white/10 mx-4" />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Sittings</span>
                                            <span className="text-2xl font-bold text-foreground tracking-tight">{frequency === 'single' ? 1 : (selectedService?.sittings || 1)}</span>
                                        </div>
                                        <div className="h-8 w-px bg-white/10 mx-4" />
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Duration</span>
                                            <span className="text-2xl font-bold text-foreground tracking-tight">{selectedService?.duration}m</span>
                                        </div>
                                    </div>
                                </div>

                                <Card className="bg-white/5 border-0 rounded-2xl overflow-hidden p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">PROPOSED SCHEDULE</span>
                                        <span className="text-[10px] font-bold bg-primary/20 text-primary px-2 py-0.5 rounded-full">{availability.dates.length} Dates</span>
                                    </div>
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {availability.dates.map((date: string | Date, i: number) => (
                                            <div key={i} className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground font-bold text-xs">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm font-bold text-foreground">{format(new Date(date), "EEEE, MMM do")}</p>
                                                    <p className="text-xs text-muted-foreground">{format(new Date(date), "yyyy")}</p>
                                                </div>
                                                <div className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                                                    {format(new Date(date), "h:mm a")}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Card>

                                <div className="flex gap-2">
                                    <Button
                                        variant="secondary"
                                        className="flex-1 h-12 text-base font-semibold"
                                        onClick={() => setStep('manual')}
                                    >
                                        Choose Manually
                                    </Button>
                                    <Button
                                        className="flex-[2] shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-semibold"
                                        onClick={handleConfirmBooking}
                                        disabled={sendMessageMutation.isPending}
                                    >
                                        {sendMessageMutation.isPending ? "Sending..." : "Send Proposal"}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* STEP: MANUAL */}
                {step === 'manual' && (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <Calendar className="w-16 h-16 text-muted-foreground/30" />
                        <div className="text-center">
                            <h3 className="text-lg font-semibold text-foreground">Manual Date Selection</h3>
                            <p className="text-sm text-muted-foreground mt-1">This feature is coming soon.</p>
                        </div>
                    </div>
                )}

                {/* STEP: SUCCESS */}
                {step === 'success' && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
                        <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-2">
                            <CheckCircle2 className="w-10 h-10 text-primary" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-foreground tracking-tight">Proposal Sent!</h3>
                            <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
                                The project proposal has been sent to the client.
                            </p>
                        </div>
                        <Button
                            onClick={handleClose}
                            className="w-full shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base font-semibold"
                        >
                            Return to Chat
                        </Button>
                    </div>
                )}
            </div>
        </FullScreenSheet>
    );
}
