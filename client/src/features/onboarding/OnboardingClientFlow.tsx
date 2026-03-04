import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input, Label } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Camera, RefreshCw } from "lucide-react";

interface OnboardingClientFlowProps {
    onComplete: () => Promise<void>;
}

export function OnboardingClientFlow({ onComplete }: OnboardingClientFlowProps) {
    const { user, refresh } = useAuth();
    const [step, setStep] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [name, setName] = useState(user?.name || "");
    const [phone, setPhone] = useState(user?.phone || "");
    const [avatar, setAvatar] = useState(user?.avatar || "");
    const updateProfileMutation = trpc.auth.updateProfile.useMutation();

    const handleNext = async () => {
        if (step === 1) {
            if (!name) {
                toast.error("Please provide a name.");
                return;
            }
            setIsSubmitting(true);
            try {
                await updateProfileMutation.mutateAsync({
                    name,
                    phone,
                    avatar
                });
                await refresh();
                setStep(2);
            } catch (e) {
                toast.error("Failed to save profile details.");
            } finally {
                setIsSubmitting(false);
            }
        } else if (step === 2) {
            onComplete();
        }
    };

    const currentStepVariant = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
    };

    return (
        <div className="flex flex-col h-full w-full max-w-sm mx-auto p-6 relative bg-card border border-white/5 rounded-3xl shadow-2xl">
            <div className="mb-6 space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                    {step === 1 ? "Complete Your Profile" : "All Set!"}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {step === 1
                        ? "Let's make sure artists know who they are talking to."
                        : "Your client profile is ready."}
                </p>
            </div>

            <div className="flex-1 relative">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step-1"
                            variants={currentStepVariant}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="space-y-4"
                        >
                            <div className="flex justify-center mb-6">
                                <div className="w-24 h-24 rounded-full bg-accent/30 border-2 border-primary/20 flex flex-col items-center justify-center text-primary/50 cursor-pointer hover:bg-accent/50 transition-colors">
                                    <Camera className="w-8 h-8 mb-1" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Photo</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                                <Input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    className="bg-accent/5"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number (Optional)</Label>
                                <Input
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="e.g. +61 400 000 000"
                                    className="bg-accent/5"
                                />
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step-2"
                            variants={currentStepVariant}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="flex flex-col items-center justify-center text-center space-y-4 py-8"
                        >
                            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                                <RefreshCw className="w-8 h-8 text-emerald-500" />
                            </div>

                            <p className="text-sm text-muted-foreground">
                                You are now ready to explore Artist portfolios, schedule consultations, and book projects!
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="mt-8">
                <Button
                    className="w-full h-12 text-sm font-bold tracking-wide uppercase"
                    onClick={handleNext}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Saving..." : step === 1 ? "Continue" : "Go to Dashboard"}
                </Button>
            </div>
        </div>
    );
}
