import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBottomNav, useRegisterFABActions } from "@/contexts/BottomNavContext";
import { PageHeader, PageShell } from "@/components/ui/ssot";
import { Button, Card, Switch } from "@/components/ui";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { Check, Info, Sparkles, Building, User, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Subscriptions() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const [isAnnual, setIsAnnual] = useState(false);

    // Fetch the studio data to check current tier
    const { data: currentStudio, isLoading: isLoadingStudio } = trpc.studios.getCurrentStudio.useQuery(undefined, {
        enabled: !!user,
    });

    const plans = [
        {
            id: "solo",
            name: "Solo Artist",
            icon: User,
            tagline: "Everything an independent artist needs to thrive.",
            priceMonthly: 29,
            priceAnnual: 24, // $288/yr
            features: [
                "Smart Calendar & Booking Link",
                "Automated Reminders (SMS/Email)",
                "Client & Portfolio Management",
                "Digital Intake & Consent Forms",
                "Waitlist & Flash Tattoo Claims",
                "Basic Analytics Dashboard"
            ],
            isPopular: false,
            color: "blue",
        },
        {
            id: "studio",
            name: "Studio Manager",
            icon: Building,
            tagline: "Scale your business with shared resources & team scheduling.",
            priceMonthly: 99,
            priceAnnual: 79, // $948/yr
            features: [
                "Everything in Solo",
                "Multi-Artist Master Calendar",
                "Centralized Client Database",
                "Owner / Manager / Artist Roles",
                "Studio Analytics & Revenue Reports",
                "+$15/mo per additional seat"
            ],
            isPopular: true,
            color: "purple",
        }
    ];

    const currentTier = currentStudio?.subscriptionTier || "solo";

    // Mutations for Stripe Checkouts
    const createCheckout = trpc.billing.createCheckoutSession.useMutation({
        onSuccess: (data) => {
            if (data.url) window.location.href = data.url;
        },
        onError: (err) => {
            toast.error(err.message || "Failed to initiate checkout");
        }
    });

    const createPortal = trpc.billing.createPortalSession.useMutation({
        onSuccess: (data) => {
            if (data.url) window.location.href = data.url;
        },
        onError: (err) => {
            toast.error(err.message || "Failed to open billing portal");
        }
    });

    // We also need the createStudio endpoint if they don't even have a studio yet
    const createStudio = trpc.studios.createStudio.useMutation({
        onSuccess: (data) => {
            // Upon creating studio, instantly proceed to billing
            createCheckout.mutate({ studioId: data.studioId });
        },
        onError: (err) => {
            toast.error(err.message || "Failed to create studio space");
        }
    });

    // STRIPE BYPASS FOR TESTING
    const utils = trpc.useUtils();
    const testUpgradeStudio = trpc.studios.testUpgradeStudio.useMutation({
        onSuccess: () => {
            toast.success("Testing Bypass: Subscription Plan Activated!");
            utils.studios.getCurrentStudio.invalidate();
        },
        onError: (err) => {
            toast.error(err.message || "Failed to bypass upgrade");
        }
    });

    const handleAction = (planId: "solo" | "studio") => {
        // BYPASS STRIPE FOR TESTING
        testUpgradeStudio.mutate({ tier: planId });
    };

    const isPending = createCheckout.isPending || createPortal.isPending || createStudio.isPending || testUpgradeStudio.isPending;

    return (
        <PageShell>
            <PageHeader title="Subscriptions" onBack={() => setLocation("/settings")} />

            <div className={cn(tokens.contentContainer.base, "pb-24 pt-6 overflow-y-auto h-full")}>

                {/* Hero / Header */}
                <div className="text-center mb-8 px-4">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        Choose Your Plan
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                        Simple, transparent pricing to help you grow your tattoo business.
                    </p>
                </div>

                {/* Billing Toggle */}
                <div className="flex items-center justify-center gap-3 mb-10">
                    <span className={cn("text-sm font-medium transition-colors", !isAnnual ? "text-foreground" : "text-muted-foreground")}>
                        Monthly
                    </span>
                    <Switch
                        checked={isAnnual}
                        onCheckedChange={setIsAnnual}
                        className="data-[state=checked]:bg-primary"
                    />
                    <span className={cn("text-sm font-medium transition-colors flex items-center gap-1.5", isAnnual ? "text-foreground" : "text-muted-foreground")}>
                        Annually
                        <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                            Save 20%
                        </span>
                    </span>
                </div>

                {/* Pricing Cards */}
                <div className="space-y-6 px-4">
                    {plans.map((plan) => {
                        const isCurrentPlan = currentTier === plan.id;
                        const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;

                        return (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.4 }}
                                className={cn(
                                    "relative rounded-3xl p-6 border overflow-hidden",
                                    plan.isPopular ? "bg-card border-primary/50 shadow-xl shadow-primary/10" : "bg-white/5 border-white/10",
                                )}
                            >
                                {plan.isPopular && (
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
                                )}

                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <plan.icon className={cn(
                                                "w-5 h-5",
                                                plan.color === 'blue' ? "text-blue-400" : "text-purple-400"
                                            )} />
                                            <h3 className="text-xl font-bold text-foreground">
                                                {plan.name}
                                            </h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {plan.tagline}
                                        </p>
                                    </div>
                                    {isCurrentPlan && (
                                        <span className="bg-white/10 text-white text-xs px-2.5 py-1 rounded-full font-medium shrink-0">
                                            Current Plan
                                        </span>
                                    )}
                                </div>

                                <div className="mb-6 flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold text-foreground">
                                        ${price}
                                    </span>
                                    <span className="text-muted-foreground font-medium">
                                        /mo
                                    </span>
                                </div>

                                <div className="space-y-3 mb-8">
                                    {plan.features.map((feature, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <div className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                                                <Check className="w-2.5 h-2.5 text-primary" />
                                            </div>
                                            <span className="text-sm text-foreground/80 leading-tight">
                                                {feature}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <Button
                                    onClick={() => handleAction(plan.id)}
                                    disabled={isPending || isLoadingStudio}
                                    className={cn(
                                        "w-full h-12 rounded-xl font-bold text-sm tracking-wide gap-2",
                                        isCurrentPlan ? "bg-white/10 text-foreground hover:bg-white/20" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25"
                                    )}
                                >
                                    {isCurrentPlan ? "Manage Subscription" : "Upgrade Plan"}
                                    {!isCurrentPlan && <ArrowRight className="w-4 h-4" />}
                                </Button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </PageShell>
    );
}
