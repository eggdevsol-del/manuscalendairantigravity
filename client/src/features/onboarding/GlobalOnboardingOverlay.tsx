import React from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import { OnboardingArtistFlow } from "./OnboardingArtistFlow";
import { OnboardingClientFlow } from "./OnboardingClientFlow";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function GlobalOnboardingOverlay() {
    const [, setLocation] = useLocation();
    const { user, refresh } = useAuth();
    const updateOnboardingMutation = trpc.auth.completeOnboarding.useMutation();

    if (!user) return null;

    const isArtist = user.role === "artist";

    const handleCompleteSequence = async () => {
        try {
            await updateOnboardingMutation.mutateAsync();
            await refresh(); // Re-fetches the user context to remove the overlay
            toast.success("Welcome aboard!");
        } catch (e) {
            toast.error("Failed to complete onboarding. Please try again.");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50 backdrop-blur-3xl px-4 sm:px-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={cn(
                    "w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-[2.5rem]",
                    "bg-card/95 border border-white/10 shadow-2xl relative scrollbar-hide"
                )}
            >
                <div className="p-6">
                    <AnimatePresence mode="wait">
                        {updateOnboardingMutation.isPending ? (
                            <motion.div
                                key="completing"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-20 space-y-4"
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
            </motion.div>
        </div>
    );
}
