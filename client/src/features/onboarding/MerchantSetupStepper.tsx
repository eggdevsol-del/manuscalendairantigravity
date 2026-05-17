import React, { useEffect } from "react";
import { CheckCircle2, Circle, Loader2, Store } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { motion } from "framer-motion";

export function MerchantSetupStepper() {
  const { data: stripeStatus, refetch } = trpc.merchantAuth.getMerchantStripeStatus.useQuery(undefined, {
    refetchInterval: 15000, // Poll every 15s to check if webhook verified
  });

  const isConnected = stripeStatus?.connected;
  const isVerified = stripeStatus?.chargesEnabled && stripeStatus?.payoutsEnabled;

  const steps = [
    {
      label: "Store Claimed",
      status: "complete", // Assumed complete if they are seeing this component
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    },
    {
      label: "Stripe Connected",
      status: isConnected ? "complete" : "pending",
      icon: isConnected ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      ) : (
        <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
      ),
    },
    {
      label: "Store Live",
      status: isVerified ? "complete" : "pending",
      icon: isVerified ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      ) : (
        <Store className="w-5 h-5 text-muted-foreground" />
      ),
    },
  ];

  return (
    <div className="bg-card/50 backdrop-blur-md border border-border rounded-3xl p-6 shadow-sm mb-8 animate-in fade-in slide-in-from-bottom-4">
      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
        Store Setup Progress
      </h3>

      <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative">
        {/* Connection Line (desktop) */}
        <div className="hidden md:block absolute top-1/2 left-0 right-0 h-[2px] bg-border -z-10 -translate-y-1/2">
          <motion.div 
            className="h-full bg-emerald-500/50" 
            initial={{ width: "0%" }}
            animate={{ width: isVerified ? "100%" : isConnected ? "50%" : "0%" }}
            transition={{ duration: 1 }}
          />
        </div>

        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2 bg-background/80 md:bg-transparent p-2 rounded-xl">
            <div className="bg-background rounded-full p-1 border-2 border-background shadow-sm">
              {step.icon}
            </div>
            <span className={`text-sm font-medium ${step.status === "complete" ? "text-foreground" : "text-muted-foreground"}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
      
      {!isVerified && (
        <p className="text-sm text-muted-foreground text-center mt-6">
          {isConnected 
            ? "Waiting for Stripe to verify your identity. This usually takes a few minutes."
            : "Please complete your Stripe onboarding to activate your store."}
        </p>
      )}
    </div>
  );
}
