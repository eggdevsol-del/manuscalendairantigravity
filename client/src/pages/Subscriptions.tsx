import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { PageHeader, PageShell } from "@/components/ui/ssot";
import { Button, Switch } from "@/components/ui";
import { tokens } from "@/ui/tokens";
import { cn } from "@/lib/utils";
import { Check, ArrowRight, Zap, Building2 } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Subscriptions() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [isAnnual, setIsAnnual] = useState(false);

  // Fetch data
  const { data: currentStudio, isLoading: isLoadingStudio } =
    trpc.studios.getCurrentStudio.useQuery(undefined, {
      enabled: user?.role === "studio" || user?.role === "admin",
    });

  const { data: artistSettings, isLoading: isLoadingArtist } =
    trpc.artistSettings.get.useQuery(undefined, {
      enabled: user?.role === "artist" || user?.role === "admin",
    });

  const isArtist = user?.role === "artist";
  const currentTier = isArtist
    ? artistSettings?.subscriptionTier || "basic"
    : currentStudio?.subscriptionTier || "solo";

  // Mutations for Stripe Checkouts (Artist)
  const createArtistCheckout = trpc.billing.createArtistCheckoutSession.useMutation(
    {
      onSuccess: data => {
        if (data.url) window.location.href = data.url;
      },
      onError: err => {
        toast.error(err.message || "Failed to initiate checkout");
      },
    }
  );

  const createArtistPortal = trpc.billing.createArtistPortalSession.useMutation({
    onSuccess: data => {
      if (data.url) window.location.href = data.url;
    },
    onError: err => {
      toast.error(err.message || "Failed to open billing portal");
    },
  });

  // Mutations for Stripe Checkouts (Studio)
  const createStudioCheckout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: data => {
      if (data.url) window.location.href = data.url;
    },
    onError: err => {
      toast.error(err.message || "Failed to initiate checkout");
    },
  });

  const createStudioPortal = trpc.billing.createPortalSession.useMutation({
    onSuccess: data => {
      if (data.url) window.location.href = data.url;
    },
    onError: err => {
      toast.error(err.message || "Failed to open billing portal");
    },
  });

  const plans = isArtist
    ? [
      {
        id: "pro",
        name: "Pro Artist",
        icon: Zap,
        tagline: "Everything you need to automate your bookings, deposits, and reminders.",
        priceMonthly: 29.99,
        priceAnnual: 24.99, // $299.88/yr
        features: [
          "Unlimited Appointments",
          "Advanced Multi-Step Booking Wizard",
          "Automated Deposits via Stripe",
          "Automated Reminders (SMS/Email)",
          "Promotional Vouchers & Discounts",
          "Remove Tattoi Branding (White-label)",
          "Custom Booking Funnel Theme & Colors",
          "Custom Policy & Form Content",
        ],
        isPopular: true,
        color: "purple",
        // MOCK STRIPE IDS FOR NOW
        stripePriceIdMonthly: "price_mock_pro_monthly",
        stripePriceIdAnnual: "price_mock_pro_annual",
      },
    ]
    : [
      {
        id: "studio",
        name: "Studio Space",
        icon: Building2,
        tagline: "Multi-artist management, shared resources, and advanced analytics.",
        priceMonthly: 99.99,
        priceAnnual: 79.99, // $959.88/yr
        features: [
          "Unlimited Staff & Artists",
          "Centralized Reception Desk",
          "Shared Resources & Rooms",
          "Studio-wide Deposit Collection",
          "Aggregated P&L Analytics",
          "Custom Studio Branding",
        ],
        isPopular: true,
        color: "orange",
        stripePriceIdMonthly: "price_mock_studio_monthly",
        stripePriceIdAnnual: "price_mock_studio_annual",
      },
    ];

  const handleAction = (plan: any) => {
    // If user is basic or elite, we consider "pro" as the upgrade/manage path 
    const isCurrentPlan = currentTier === plan.id || (plan.id === "pro" && currentTier === "elite");

    if (isArtist) {
      if (isCurrentPlan) {
        createArtistPortal.mutate();
      } else {
        const priceId = isAnnual ? plan.stripePriceIdAnnual : plan.stripePriceIdMonthly;
        createArtistCheckout.mutate({ priceId });
      }
    } else {
      if (isCurrentPlan) {
        if (!currentStudio?.id) return;
        createStudioPortal.mutate({ studioId: currentStudio.id });
      } else {
        if (!currentStudio?.id) return; // Normally they'd create studio first
        createStudioCheckout.mutate({ studioId: currentStudio.id });
      }
    }
  };

  const isPending =
    createArtistCheckout.isPending ||
    createArtistPortal.isPending ||
    createStudioCheckout.isPending ||
    createStudioPortal.isPending ||
    isLoadingStudio ||
    isLoadingArtist;

  return (
    <PageShell>
      <PageHeader title="Subscriptions" onBack={() => setLocation("/settings")} />

      <div className={cn(tokens.contentContainer.base, "pb-24 pt-6 overflow-y-auto h-full")}>
        {/* Hero / Header */}
        <div className="text-center mb-8 px-4">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
            {isArtist ? "Unlock Pro Features" : "Choose Your Plan"}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            Simple, transparent pricing to help you grow your tattoo business.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span
            className={cn(
              "text-sm font-medium transition-colors",
              !isAnnual ? "text-foreground" : "text-muted-foreground"
            )}
          >
            Monthly
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
            className="data-[state=checked]:bg-primary"
          />
          <span
            className={cn(
              "text-sm font-medium transition-colors flex items-center gap-1.5",
              isAnnual ? "text-foreground" : "text-muted-foreground"
            )}
          >
            Annually
            <span className="bg-green-500/20 text-green-400 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Save 20%
            </span>
          </span>
        </div>

        {/* Pricing Cards */}
        <div className="space-y-6 px-4 max-w-lg mx-auto">
          {plans.map(plan => {
            const isCurrentPlan = currentTier === plan.id || (plan.id === "pro" && currentTier === "elite");
            const price = isAnnual ? plan.priceAnnual : plan.priceMonthly;

            // Simplified styling based on color mapping
            const colorClasses = {
              purple: "text-purple-400",
              orange: "text-orange-400",
            }[plan.color as "purple" | "orange"] || "text-primary";

            const borderGradient = {
              purple: "from-purple-500 to-primary",
              orange: "from-orange-400 to-red-500",
            }[plan.color as "purple" | "orange"];

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className={cn(
                  "relative rounded-3xl p-6 border overflow-hidden",
                  plan.isPopular
                    ? "bg-card border-white/20 shadow-xl"
                    : "bg-white/5 border-white/10"
                )}
              >
                {plan.isPopular && borderGradient && (
                  <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${borderGradient}`} />
                )}

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <plan.icon className={cn("w-5 h-5", colorClasses)} />
                      <h3 className="text-xl font-bold text-foreground">
                        {plan.name}
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{plan.tagline}</p>
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
                  <span className="text-muted-foreground font-medium">/mo</span>
                </div>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
                        <Check className={cn("w-2.5 h-2.5", colorClasses)} />
                      </div>
                      <span className="text-sm text-foreground/80 leading-tight">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => handleAction(plan)}
                  disabled={isPending}
                  variant={isCurrentPlan ? "outline" : plan.isPopular ? "hero" : "default"}
                  className={cn(
                    "w-full h-12 rounded-xl font-bold text-sm tracking-wide gap-2",
                  )}
                >
                  {isCurrentPlan ? "Manage Subscription" : "Subscribe Now"}
                  {!isCurrentPlan && <ArrowRight className="w-4 h-4" />}
                </Button>
              </motion.div>
            );
          })}

          {isArtist && currentTier === "basic" && (
            <div className="text-center mt-6">
              <p className="text-sm text-muted-foreground font-medium">
                You do not have an active subscription.
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
