import { useState, useEffect } from "react";
import { ChevronLeft, Banknote, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { StripeExpressOnboarding } from "@/features/stripe/StripeExpressOnboarding";
import { Button } from "@/components/ui";

interface PaymentSettingsProps {
  onBack: () => void;
}

/**
 * PaymentSettings — Bank Payouts panel (FAB sub-view)
 *
 * Flow:
 *  1. User taps "Bank Payouts" in FAB menu
 *  2. We check getStripeConnectStatus
 *  3. If no account → show "Connect Your Bank" with a manual button
 *  4. If Custom account exists (complete or incomplete) → show embedded onboarding
 *  5. If connected → show "Payouts Enabled"
 *
 * The embedded Stripe component handles the entire KYC/bank-linking process
 * inside the Tattoi UI using @stripe/react-connect-js. No redirects.
 */
export function PaymentSettings({ onBack }: PaymentSettingsProps) {
  const connectStatus = trpc.artistSettings.getStripeConnectStatus.useQuery();
  const connectStripe = trpc.artistSettings.connectStripe.useMutation();
  const [phase, setPhase] = useState<
    "loading" | "idle" | "creating" | "onboarding" | "connected" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const status = connectStatus.data;

  // Derive state from query
  useEffect(() => {
    if (connectStatus.isLoading) {
      setPhase("loading");
      return;
    }
    if (connectStatus.isError) {
      setPhase("error");
      setErrorMsg("Failed to check payment status. Please try again.");
      return;
    }
    if (!status) return;

    const isConnected = status.connected && status.onboardingComplete;
    const isPending = status.connected && !status.onboardingComplete;

    if (isConnected) {
      setPhase("connected");
    } else if (isPending && status.accountType === "custom") {
      // Custom account exists but onboarding incomplete → show embedded
      setPhase("onboarding");
    } else if (isPending && status.accountType === "standard") {
      // Standard account incomplete — shouldn't happen with Express enabled
      // but handle gracefully
      setPhase("idle");
    } else {
      // No account at all
      setPhase("idle");
    }
  }, [status, connectStatus.isLoading, connectStatus.isError]);

  const handleCreateAccount = async () => {
    try {
      setPhase("creating");
      setErrorMsg(null);

      const result = await connectStripe.mutateAsync();

      if (result.alreadyConnected) {
        setPhase("connected");
        return;
      }

      if (result.accountType === "custom") {
        // Account created on Stripe — wait a moment for propagation
        // then show the embedded onboarding
        await new Promise(resolve => setTimeout(resolve, 1500));
        setPhase("onboarding");
      } else if (result.url) {
        // Standard fallback — shouldn't happen with STRIPE_CUSTOM_ENABLED=true
        // but handle it
        window.location.href = result.url;
      }
    } catch (err: any) {
      console.error("[PaymentSettings] Account creation failed:", err);
      setErrorMsg(err.message || "Failed to create Stripe account. Please try again.");
      setPhase("error");
    }
  };

  const handleOnboardingComplete = () => {
    setPhase("connected");
    connectStatus.refetch();
    toast.success("Bank payouts enabled! 🎉");
  };

  const handleRetry = () => {
    setErrorMsg(null);
    connectStatus.refetch();
    setPhase("loading");
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-6 pb-4 shrink-0 bg-transparent z-20 border-b border-white/5">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h2 className="text-xl font-semibold text-foreground">Bank Payouts</h2>
      </div>

      {/* Content */}
      <div className="flex-1 w-full overflow-y-auto p-4 mobile-scroll touch-pan-y relative z-10">

        {/* 1. Loading */}
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center p-8 mt-10 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Checking payment status...</p>
          </div>
        )}

        {/* 2. Connected — All done */}
        {phase === "connected" && (
          <div className="text-center p-6 mt-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4 border border-emerald-500/40">
              <Banknote className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Payouts Enabled</h3>
            <p className="text-sm text-muted-foreground">Your bank account is successfully linked. You will now receive deposits automatically.</p>
          </div>
        )}

        {/* 3. Idle — No account yet, show connect button */}
        {phase === "idle" && (
          <div className="text-center p-6 mt-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20">
              <Banknote className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold">Connect Your Bank</h3>
            <p className="text-sm text-muted-foreground">
              Link a bank account to start receiving booking deposits directly.
              All details are collected securely within the app.
            </p>
            <Button
              onClick={handleCreateAccount}
              disabled={connectStripe.isPending}
              className="w-full mt-4 bg-[#E09F3E]/75 text-white hover:bg-[#E09F3E]"
            >
              Setup Bank Account
            </Button>
          </div>
        )}

        {/* 4. Creating — Spinner while account is being set up on Stripe */}
        {phase === "creating" && (
          <div className="flex flex-col items-center justify-center p-8 mt-10 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Setting up your payment account...</p>
            <p className="text-xs text-muted-foreground/60">This may take a few seconds</p>
          </div>
        )}

        {/* 5. Onboarding — Embedded Stripe component */}
        {phase === "onboarding" && (
          <StripeExpressOnboarding
            isResuming={status?.connected && !status?.onboardingComplete}
            onComplete={handleOnboardingComplete}
          />
        )}

        {/* 6. Error state */}
        {phase === "error" && (
          <div className="text-center p-6 mt-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-red-400">Connection Error</h3>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button
              onClick={handleRetry}
              variant="outline"
              className="mt-4 gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
