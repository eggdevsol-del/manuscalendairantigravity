import { useState, useEffect } from "react";
import { ChevronLeft, Banknote } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { StripeExpressOnboarding } from "@/features/stripe/StripeExpressOnboarding";
import { Button } from "@/components/ui";

interface PaymentSettingsProps {
  onBack: () => void;
}

export function PaymentSettings({ onBack }: PaymentSettingsProps) {
  const connectStatus = trpc.artistSettings.getStripeConnectStatus.useQuery();
  const connectStripe = trpc.artistSettings.connectStripe.useMutation();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [autoStarted, setAutoStarted] = useState(false);
  
  const status = connectStatus.data;
  const accountType = status?.accountType || "standard";
  const isConnected = status?.connected && status?.onboardingComplete;
  const isPending = status?.connected && !status?.onboardingComplete;

  const handleStart = async () => {
    try {
      if (isConnected) {
        toast.info("Stripe is already connected.");
        return;
      }
      if (isPending && accountType === "express") {
        setShowOnboarding(true);
        return;
      }
      if (isPending && accountType === "standard") {
        toast.info("Redirecting to Stripe...");
        const result = await connectStripe.mutateAsync();
        if (result.url) window.location.href = result.url;
        return;
      }

      toast.info("Connecting to Stripe...");
      const result = await connectStripe.mutateAsync();
      
      if (result.accountType === "express") {
        setShowOnboarding(true);
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to connect Stripe");
    }
  };

  // Auto-start on mount if not connected
  useEffect(() => {
    if (status && !isConnected && !showOnboarding && !connectStripe.isPending && !autoStarted) {
        setAutoStarted(true);
        handleStart();
    }
  }, [status, isConnected, showOnboarding, connectStripe.isPending, autoStarted]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-xl font-semibold text-foreground">Bank Payouts</h2>
      </div>
      <div className="flex-1 w-full overflow-y-auto p-4 mobile-scroll touch-pan-y relative z-10">
        {isConnected ? (
          <div className="text-center p-6 mt-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 border border-emerald-500/40">
              <Banknote className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Payouts Enabled</h3>
            <p className="text-sm text-muted-foreground">Your bank account is successfully linked. You will now receive deposits automatically.</p>
          </div>
        ) : showOnboarding ? (
          <StripeExpressOnboarding 
            isResuming={isPending} 
            onComplete={() => {
              setShowOnboarding(false);
              connectStatus.refetch();
            }} 
          />
        ) : (
          <div className="text-center p-6 mt-10">
             <Button onClick={handleStart} disabled={connectStripe.isPending} className="w-full bg-[#E09F3E]/75 text-white hover:bg-[#E09F3E]">
               {connectStripe.isPending ? "Connecting..." : "Setup Bank Account"}
             </Button>
          </div>
        )}
      </div>
    </div>
  );
}
