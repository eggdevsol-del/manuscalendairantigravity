/**
 * AppointmentCheckInModal — SSOT multi-step check-in/out flow.
 * 
 * Flow:
 * 1. ARRIVAL: "Has the client arrived?" → Yes / No / Rescheduled
 * 2. COMPLETION: "Client done?" → Yes / No
 * 3. PAYMENT: "Has the client paid?" → Yes / No
 * 4. PAYMENT_METHOD: Select payment method → Done
 * 5. SEND_PAYMENT: "Send payment details?" → Yes (select method) / No
 * 6. MANUAL_END: Enter end time + amount + payment method (if "No" to client done)
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { tokens } from "@/ui/tokens";
import { CheckCircle2, XCircle, CalendarClock, CreditCard, DollarSign, Clock } from "lucide-react";
import type { ActiveCheckIn } from "@/features/appointments/useAppointmentCheckIn";

type Step =
    | 'arrival'           // Has the client arrived?
    | 'arrival_no'        // Client didn't arrive — future: reschedule
    | 'completion'        // Client done?
    | 'payment_check'     // Has the client paid?
    | 'payment_method'    // Which payment method?
    | 'send_payment'      // Send payment details?
    | 'send_method'       // Which method to send?
    | 'manual_end'        // Provide end time + amount
    | 'done';             // All data stored

interface Props {
    checkIn: ActiveCheckIn;
    onDismiss: () => void;
    updateAppointment: any; // useMutation return
}

const PAYMENT_METHODS = [
    { id: 'stripe' as const, label: 'Stripe', icon: CreditCard },
    { id: 'paypal' as const, label: 'PayPal', icon: CreditCard },
    { id: 'bank' as const, label: 'Bank Transfer', icon: DollarSign },
    { id: 'cash' as const, label: 'Cash', icon: DollarSign },
] as const;

export function AppointmentCheckInModal({ checkIn, onDismiss, updateAppointment }: Props) {
    const { appointment, phase } = checkIn;
    const [step, setStep] = useState<Step>(() => phase === 'arrival' ? 'arrival' : 'completion');

    // Sync step with phase if not in 'done' state
    if (step !== 'done') {
        const expectedStep = phase === 'arrival' ? 'arrival' : 'completion';
        if (step !== expectedStep && (step === 'arrival' || step === 'completion')) {
            setStep(expectedStep);
        }
    }
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
    const [manualEndTime, setManualEndTime] = useState('');
    const [manualAmount, setManualAmount] = useState('');

    // Fetch artist's enabled payment methods
    const { data: paymentSettings } = trpc.paymentMethodSettings.get.useQuery(undefined, {
        // This hook runs in artist context
    });

    const enabledMethods = PAYMENT_METHODS.filter(m => {
        if (!paymentSettings) return true; // show all if not configured
        return paymentSettings[`${m.id}Enabled` as keyof typeof paymentSettings];
    });

    const handleUpdate = async (data: Record<string, any>) => {
        await updateAppointment.mutateAsync({
            id: appointment.id,
            ...data,
        });
    };

    // ── Step handlers ──────────────────────────────────

    const handleArrivalYes = async () => {
        await handleUpdate({
            clientArrived: true,
            actualStartTime: appointment.startTime, // default to scheduled start
            status: 'confirmed',
        });
        setStep('done');
    };

    const handleArrivalNo = () => setStep('arrival_no');
    const handleArrivalRescheduled = async () => {
        await handleUpdate({ status: 'cancelled' });
        setStep('done');
    };

    const handleCompletionYes = () => setStep('payment_check');
    const handleCompletionNo = () => setStep('manual_end');

    const handlePaidYes = () => setStep('payment_method');
    const handlePaidNo = () => setStep('send_payment');

    const handlePaymentMethodDone = async () => {
        if (!selectedMethod) return;
        await handleUpdate({
            status: 'completed',
            clientPaid: true,
            amountPaid: appointment.price || 0,
            paymentMethod: selectedMethod,
            actualEndTime: new Date().toISOString(),
        });
        setStep('done');
    };

    const handleSendPaymentYes = () => setStep('send_method');
    const handleSendPaymentNo = async () => {
        await handleUpdate({
            status: 'completed',
            clientPaid: false,
            actualEndTime: new Date().toISOString(),
        });
        setStep('done');
    };

    const handleSendMethodDone = async () => {
        // In future: trigger payment request via selected method
        await handleUpdate({
            status: 'completed',
            clientPaid: false,
            paymentMethod: selectedMethod,
            actualEndTime: new Date().toISOString(),
        });
        setStep('done');
    };

    const handleManualEndDone = async () => {
        const endTime = manualEndTime ? new Date(manualEndTime).toISOString() : new Date().toISOString();
        const amount = manualAmount ? parseInt(manualAmount) : appointment.price || 0;
        await handleUpdate({
            status: 'completed',
            actualEndTime: endTime,
            amountPaid: amount,
            clientPaid: !!manualAmount,
            paymentMethod: selectedMethod,
        });
        setStep('done');
    };

    // ── Render helpers ──────────────────────────────────

    const StepContainer = ({ children }: { children: React.ReactNode }) => (
        <AnimatePresence mode="wait">
            <motion.div
                key={step}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center gap-4 text-center"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );

    const ActionButton = ({ onClick, variant, children, disabled }: {
        onClick: () => void;
        variant: 'primary' | 'secondary' | 'danger';
        children: React.ReactNode;
        disabled?: boolean;
    }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all active:scale-95",
                variant === 'primary' && "bg-primary text-primary-foreground hover:bg-primary/90",
                variant === 'secondary' && "bg-white/5 text-foreground/80 hover:bg-white/10",
                variant === 'danger' && "bg-red-500/10 text-red-500 hover:bg-red-500/20",
                disabled && "opacity-50 pointer-events-none"
            )}
        >
            {children}
        </button>
    );

    const MethodGrid = ({ onSelect }: { onSelect: (id: string) => void }) => (
        <div className="grid grid-cols-2 gap-2 w-full">
            {enabledMethods.map(m => (
                <button
                    key={m.id}
                    onClick={() => { setSelectedMethod(m.id); onSelect(m.id); }}
                    className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all",
                        selectedMethod === m.id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-white/10 bg-white/5 text-foreground/70 hover:bg-white/10"
                    )}
                >
                    <m.icon className="w-5 h-5" />
                    <span className="text-xs font-semibold">{m.label}</span>
                </button>
            ))}
        </div>
    );

    // ── Render step content ──────────────────────────────────

    const renderStep = () => {
        switch (step) {
            case 'arrival':
                return (
                    <StepContainer>
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                            <CalendarClock className="w-7 h-7 text-primary" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">Has the client arrived?</h3>
                        <p className="text-xs text-muted-foreground">
                            {appointment.title} — {appointment.clientName || 'Client'}
                        </p>
                        <div className="w-full space-y-2">
                            <ActionButton onClick={handleArrivalYes} variant="primary">Yes</ActionButton>
                            <ActionButton onClick={handleArrivalNo} variant="secondary">No</ActionButton>
                            <ActionButton onClick={handleArrivalRescheduled} variant="danger">Rescheduled</ActionButton>
                        </div>
                    </StepContainer>
                );

            case 'arrival_no':
                return (
                    <StepContainer>
                        <div className="w-14 h-14 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <Clock className="w-7 h-7 text-orange-500" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">Client hasn't arrived</h3>
                        <p className="text-xs text-muted-foreground">
                            You'll be notified again shortly. You can dismiss for now.
                        </p>
                        <ActionButton onClick={onDismiss} variant="secondary">Dismiss</ActionButton>
                    </StepContainer>
                );

            case 'completion':
                return (
                    <StepContainer>
                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">Client done?</h3>
                        <p className="text-xs text-muted-foreground">
                            {appointment.title} — {appointment.clientName || 'Client'}
                        </p>
                        <div className="w-full space-y-2">
                            <ActionButton onClick={handleCompletionYes} variant="primary">Yes</ActionButton>
                            <ActionButton onClick={handleCompletionNo} variant="secondary">No</ActionButton>
                        </div>
                    </StepContainer>
                );

            case 'payment_check':
                return (
                    <StepContainer>
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                            <DollarSign className="w-7 h-7 text-primary" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">Has the client paid?</h3>
                        <div className="w-full space-y-2">
                            <ActionButton onClick={handlePaidYes} variant="primary">Yes</ActionButton>
                            <ActionButton onClick={handlePaidNo} variant="secondary">No</ActionButton>
                        </div>
                    </StepContainer>
                );

            case 'payment_method':
                return (
                    <StepContainer>
                        <h3 className="text-lg font-bold text-foreground">Payment method</h3>
                        <MethodGrid onSelect={() => { }} />
                        <ActionButton
                            onClick={handlePaymentMethodDone}
                            variant="primary"
                            disabled={!selectedMethod}
                        >
                            Done
                        </ActionButton>
                    </StepContainer>
                );

            case 'send_payment':
                return (
                    <StepContainer>
                        <h3 className="text-lg font-bold text-foreground">Send payment details?</h3>
                        <div className="w-full space-y-2">
                            <ActionButton onClick={handleSendPaymentYes} variant="primary">Yes</ActionButton>
                            <ActionButton onClick={handleSendPaymentNo} variant="secondary">No</ActionButton>
                        </div>
                    </StepContainer>
                );

            case 'send_method':
                return (
                    <StepContainer>
                        <h3 className="text-lg font-bold text-foreground">Which payment method?</h3>
                        <MethodGrid onSelect={() => { }} />
                        <ActionButton
                            onClick={handleSendMethodDone}
                            variant="primary"
                            disabled={!selectedMethod}
                        >
                            Send & Complete
                        </ActionButton>
                    </StepContainer>
                );

            case 'manual_end':
                return (
                    <StepContainer>
                        <h3 className="text-lg font-bold text-foreground">Session details</h3>
                        <div className="w-full space-y-3">
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1 text-left">End time</label>
                                <input
                                    type="datetime-local"
                                    value={manualEndTime}
                                    onChange={(e) => setManualEndTime(e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1 text-left">Amount paid ($)</label>
                                <input
                                    type="number"
                                    value={manualAmount}
                                    onChange={(e) => setManualAmount(e.target.value)}
                                    placeholder="0"
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-muted-foreground mb-1 text-left">Payment method</label>
                                <MethodGrid onSelect={() => { }} />
                            </div>
                            <ActionButton onClick={handleManualEndDone} variant="primary">
                                Complete Session
                            </ActionButton>
                        </div>
                    </StepContainer>
                );

            case 'done':
                return (
                    <StepContainer>
                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">All done!</h3>
                        <p className="text-xs text-muted-foreground">Session data saved.</p>
                        <ActionButton onClick={onDismiss} variant="primary">Close</ActionButton>
                    </StepContainer>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
                style={{
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    WebkitBackdropFilter: 'blur(4px)',
                    backdropFilter: 'blur(4px)',
                }}
                onClick={step === 'done' ? onDismiss : undefined}
            />
            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-[340px] rounded-3xl border border-white/10 bg-background/95 backdrop-blur-[20px] shadow-2xl p-6"
            >
                {renderStep()}
            </motion.div>
        </div>
    );
}
