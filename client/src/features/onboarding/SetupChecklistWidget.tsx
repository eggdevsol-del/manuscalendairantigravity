import React from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBottomNav } from "@/contexts/BottomNavContext";
import { Button } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Circle, ChevronRight, User, MapPin, Clock, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
            title: "Upload Profile Picture",
            description: "Help clients recognize you.",
            isComplete: hasProfileImage,
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
        <div className="dashboard-setup-widget w-full rounded-2xl bg-card border border-white/10 shadow-xl overflow-hidden mb-6 relative">
            <div className="p-5 border-b border-white/5 relative bg-black/20">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-foreground tracking-tight">Studio Setup Checklist</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">Prepare your studio to accept bookings.</p>
                    </div>
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-accent/20 border border-accent/40 shadow-[0_0_15px_rgba(224,159,62,0.2)] shrink-0">
                        <span className="text-accent font-bold text-sm">{completedTasks}/{tasks.length}</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-accent"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPercentage}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
            </div>

            <div className="divide-y divide-white/5 bg-transparent">
                <AnimatePresence>
                    {tasks.map((task, index) => (
                        <motion.button
                            key={task.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            onClick={task.onClick}
                            className="w-full flex items-center p-4 hover:bg-white/[0.03] transition-colors text-left group"
                        >
                            <div className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors",
                                task.isComplete ? "text-emerald-500 bg-emerald-500/10" : "text-muted-foreground bg-white/5 group-hover:bg-white/10 group-hover:text-foreground"
                            )}>
                                {task.isComplete ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                            </div>

                            <div className="flex-1 ml-4 pr-2">
                                <h4 className={cn(
                                    "text-sm font-semibold transition-colors",
                                    task.isComplete ? "text-muted-foreground line-through decoration-white/20" : "text-foreground group-hover:text-accent"
                                )}>
                                    {task.title}
                                </h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                            </div>

                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                        </motion.button>
                    ))}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {isReadyToComplete && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="p-4 bg-emerald-500/10 border-t border-emerald-500/20"
                    >
                        <Button
                            onClick={handleFinalizeSetup}
                            disabled={updateOnboardingMutation.isPending}
                            className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all"
                        >
                            {updateOnboardingMutation.isPending ? "Finalizing..." : "Complete Setup & Launch"}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
