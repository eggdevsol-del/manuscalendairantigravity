import { ChevronLeft, Banknote, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { OnboardingWizard } from "@/features/stripe/OnboardingWizard";
import { PayoutDashboard } from "@/features/stripe/PayoutDashboard";
import { Button } from "@/components/ui";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

/**
 * BankPayoutsPage — Full-screen page for Stripe Connect onboarding + payout management.
 *
 * Pre-onboarding: shows a native 5-step wizard to collect required info.
 * Post-onboarding: shows payout dashboard with status, balance, and schedule.
 */
export default function BankPayoutsPage() {
  const [, setLocation] = useLocation();
  const connectStatus = trpc.artistSettings.getStripeConnectStatus.useQuery();
  const connectStripe = trpc.artistSettings.connectStripe.useMutation();
  const [phase, setPhase] = useState<
    "loading" | "idle" | "creating" | "wizard" | "dashboard" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const status = connectStatus.data;

  useEffect(() => {
    if (connectStatus.isLoading) { setPhase("loading"); return; }
    if (connectStatus.isError) { setPhase("error"); setErrorMsg("Failed to check payment status."); return; }
    if (!status) return;

    if (status.connected && status.onboardingComplete) {
      setPhase("dashboard");
    } else if (status.connected && status.accountType === "custom") {
      // Has custom account but onboarding not complete — show wizard
      setPhase("wizard");
    } else {
      setPhase("idle");
    }
  }, [status, connectStatus.isLoading, connectStatus.isError]);

  const handleCreateAccount = async () => {
    try {
      setPhase("creating");
      setErrorMsg(null);
      const result = await connectStripe.mutateAsync();
      if (result.alreadyConnected) { setPhase("dashboard"); return; }
      if (result.accountType === "custom") {
        await new Promise(r => setTimeout(r, 500));
        setPhase("wizard");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create account.");
      setPhase("error");
    }
  };

  const handleWizardComplete = () => {
    connectStatus.refetch();
    setPhase("dashboard");
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 shrink-0 border-b border-white/5">
        <button onClick={() => setLocation("/")} className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">Bank Payouts</h1>
      </div>

      <div className="flex-1 w-full overflow-y-auto px-4 py-6 mobile-scroll touch-pan-y">
        {phase === "loading" && (
          <div className="flex flex-col items-center justify-center p-8 mt-10 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Checking payment status...</p>
          </div>
        )}

        {phase === "idle" && (
          <div className="text-center p-6 mt-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20">
              <Banknote className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold">Connect Your Bank</h3>
            <p className="text-sm text-muted-foreground">Link a bank account to start receiving booking deposits. Takes about 2 minutes.</p>
            <Button onClick={handleCreateAccount} disabled={connectStripe.isPending} className="w-full mt-4 bg-[#E09F3E]/75 text-white hover:bg-[#E09F3E]">
              Get Started
            </Button>
          </div>
        )}

        {phase === "creating" && (
          <div className="flex flex-col items-center justify-center p-8 mt-10 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Setting up your account...</p>
          </div>
        )}

        {phase === "wizard" && <OnboardingWizard onComplete={handleWizardComplete} />}

        {phase === "dashboard" && <PayoutDashboard onDisconnect={() => { connectStatus.refetch(); setPhase("idle"); }} />}

        {phase === "error" && (
          <div className="text-center p-6 mt-10 space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-red-400">Connection Error</h3>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button onClick={() => { setErrorMsg(null); connectStatus.refetch(); setPhase("loading"); }} variant="outline" className="mt-4 gap-2">
              <RefreshCw className="w-4 h-4" /> Try Again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
