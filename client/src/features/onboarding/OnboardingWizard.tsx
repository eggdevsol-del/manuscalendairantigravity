import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { OnboardingArtistFlow } from "./OnboardingArtistFlow";
import { OnboardingClientFlow } from "./OnboardingClientFlow";
import { PageShell } from "@/components/ui/ssot";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function OnboardingWizard() {
    const [, setLocation] = useLocation();
    const { user, refresh } = useAuth();
    const updateOnboardingMutation = trpc.auth.completeOnboarding.useMutation();

    // If missing auth context totally, they'll bounce out via the App.tsx guard.
    if (!user) return null;

    const isArtist = user.role === "artist";

    const handleCompleteSequence = async () => {
        try {
            await updateOnboardingMutation.mutateAsync();
            await refresh();
            toast.success("Welcome aboard!");
            setLocation("/dashboard");
        } catch (e) {
            toast.error("Failed to complete onboarding. Please try again.");
        }
    };

    return (
        <PageShell
            title="Welcome to CalendAIr"
            showBack={false}
            className="bg-background relative"
        >
            <div className="flex flex-col h-full w-full max-w-md mx-auto pt-4 pb-24">
                <AnimatePresence mode="wait">
                    {updateOnboardingMutation.isPending ? (
                        <motion.div
                            key="completing"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center flex-1 space-y-4"
                        >
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
                                Finalizing Setup...
                            </p>
                        </motion.div>
                    ) : isArtist ? (
                        <OnboardingArtistFlow
                            key="artist"
                            onComplete={handleCompleteSequence}
                        />
                    ) : (
                        <OnboardingClientFlow
                            key="client"
                            onComplete={handleCompleteSequence}
                        />
                    )}
                </AnimatePresence>
            </div>
        </PageShell>
    );
}
