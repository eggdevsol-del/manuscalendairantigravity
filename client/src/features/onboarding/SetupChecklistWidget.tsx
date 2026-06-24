import React from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { Button } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, ChevronRight, User, MapPin, Clock, Briefcase, Banknote } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * SetupChecklistWidget — Progressive onboarding via Dashboard.
 *
 * SSOT: This is the single onboarding mechanism for artists.
 * The old 7-step OnboardingArtistFlow overlay has been removed.
 * Artists are guided through setup contextually via this checklist.
 *
 * Tasks:
 *  1. Upload Profile Picture → Settings > Profile
 *  2. Set Studio Location → Settings > Business
 *  3. Configure Work Hours → Settings > Work Hours
 *  4. Add a Service → Settings > Work Hours (shared panel)
 *  5. Set up Bank Payouts → /bank-payouts (Stripe Express)
 */
export function SetupChecklistWidget() {
    const { user, refresh } = useAuth();
    const { requestSettingsView } = useBottomNav();
    const updateOnboardingMutation = trpc.auth.completeOnboarding.useMutation();

    const { data: artistSettings, isLoading } = trpc.artistSettings.get.useQuery(undefined, {
        enabled: !!user && user.role === "artist",
    });

    if (!user || user.role !== "artist" || user.hasCompletedOnboarding !== 0 || isLoading) {
        return null; // Only show for artists who haven't finished setup
    }

    // Evaluate Checklist State
    const hasProfileImage = !!user.avatar && user.avatar.length > 0;
    const hasPhone = !!user.phone && user.phone.length > 0;
    const hasProfileComplete = hasProfileImage && hasPhone;
    const hasBusinessAddress = !!artistSettings?.businessAddress && artistSettings.businessAddress.length > 0;

    // Check if WorkSchedule JSON has valid keys
    let hasWorkHours = false;
    try {
        const schedule = JSON.parse(artistSettings?.workSchedule || "{}");
        hasWorkHours = Object.keys(schedule).length > 0;
    } catch (e) { }

    // Check if Services JSON has at least one service
    let hasServices = false;
    try {
        const servicesArray = JSON.parse(artistSettings?.services || "[]");
        hasServices = Array.isArray(servicesArray) && servicesArray.length > 0;
    } catch (e) { }

    const tasks = [
        {
            id: "profile",
            title: "Complete Your Profile",
            description: "Add a photo and phone number so clients can reach you.",
            isComplete: hasProfileComplete,
            icon: User,
            onClick: () => requestSettingsView("profile"),
        },
        {
            id: "business",
            title: "Set Studio Location",
            description: "Tell clients where to find you.",
            isComplete: hasBusinessAddress,
            icon: MapPin,
            onClick: () => requestSettingsView("business"),
        },
        {
            id: "hours",
            title: "Configure Work Hours",
            description: "Define your weekly availability.",
            isComplete: hasWorkHours,
            icon: Clock,
            onClick: () => requestSettingsView("work-hours"),
        },
        {
            id: "services",
            title: "Add a Service",
            description: "What tattoos do you offer?",
            isComplete: hasServices,
            icon: Briefcase,
            onClick: () => requestSettingsView("work-hours"), // Shared panel
        },
        {
            id: "payments",
            title: "Set up Bank Payouts",
            description: "Connect Stripe to receive booking deposits.",
            isComplete: artistSettings?.stripeConnectPayoutsEnabled === 1,
            icon: Banknote,
            onClick: () => {
                // Navigate to dedicated page (Stripe iframe needs full viewport)
                window.location.href = "/bank-payouts";
            },
        }
    ];

    const completedTasks = tasks.filter(t => t.isComplete).length;
    const progressPercentage = Math.round((completedTasks / tasks.length) * 100);
    const isReadyToComplete = completedTasks === tasks.length;

    const handleFinalizeSetup = async () => {
        try {
            await updateOnboardingMutation.mutateAsync();
            await refresh();
            toast.success("Studio Setup Complete! You're ready to accept bookings.");
        } catch (error) {
            toast.error("Failed to sequence complete signal.");
        }
    };

    return (
        <div className="w-full rounded-2xl bg-white overflow-hidden mb-6">
            <div className="p-5 pb-4">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-foreground tracking-tight">Studio Setup</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">Complete these steps to accept bookings.</p>
                    </div>
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 shrink-0">
                        <span className="text-primary font-bold text-xs">{completedTasks}/{tasks.length}</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
            </div>

            <div className="border-t border-gray-50">
                <AnimatePresence>
                    {tasks.map((task, index) => (
                        <motion.button
                            key={task.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.08 }}
                            onClick={task.onClick}
                            className="w-full flex items-center px-5 py-3.5 hover:bg-gray-50 transition-colors text-left group border-b border-gray-50 last:border-b-0"
                        >
                            <div className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors",
                                task.isComplete ? "text-emerald-500 bg-emerald-50" : "text-muted-foreground bg-gray-100 group-hover:text-foreground"
                            )}>
                                {task.isComplete ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                            </div>

                            <div className="flex-1 ml-3 pr-2">
                                <h4 className={cn(
                                    "text-sm font-medium transition-colors",
                                    task.isComplete ? "text-muted-foreground line-through" : "text-foreground"
                                )}>
                                    {task.title}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                            </div>

                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </motion.button>
                    ))}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {isReadyToComplete && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="p-4 bg-emerald-50 border-t border-emerald-100"
                    >
                        <Button
                            onClick={handleFinalizeSetup}
                            disabled={updateOnboardingMutation.isPending}
                            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all"
                        >
                            {updateOnboardingMutation.isPending ? "Finalizing..." : "Complete Setup & Launch"}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
