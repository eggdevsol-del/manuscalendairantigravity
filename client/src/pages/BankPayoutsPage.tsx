import { ChevronLeft, Banknote, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { StripeExpressOnboarding } from "@/features/stripe/StripeExpressOnboarding";
import { Button } from "@/components/ui";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

/**
 * BankPayoutsPage — Full-screen Bank Payouts page
 *
 * Replaces the old FAB sub-panel approach. The Stripe Connect embedded
 * onboarding component needs full viewport width to render properly,
 * especially on Android PWA where the iframe collapses inside constrained
 * FAB panels with overflow-hidden and glassmorphism.
 */
export default function BankPayoutsPage() {
  const [, setLocation] = useLocation();
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
      setPhase("onboarding");
    } else if (isPending && status.accountType === "standard") {
      setPhase("idle");
    } else {
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
        await new Promise(resolve => setTimeout(resolve, 1500));
        setPhase("onboarding");
      } else if (result.url) {
        window.location.href = result.url;
      }
    } catch (err: any) {
      console.error("[BankPayoutsPage] Account creation failed:", err);
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
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0 border-b border-white/5">
        <button
          onClick={() => setLocation("/")}
          className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Bank Payouts</h1>
      </div>

      {/* Content */}
      <div className="flex-1 w-full overflow-y-auto px-4 py-6 mobile-scroll touch-pan-y">

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

        {/* 5. Onboarding — Embedded Stripe component (full width, no FAB constraints) */}
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
