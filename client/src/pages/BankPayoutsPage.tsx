import { Banknote, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { OnboardingWizard } from "@/features/stripe/OnboardingWizard";
import { PayoutDashboard } from "@/features/stripe/PayoutDashboard";
import { PageShell, PageHeader } from "@/components/ui/ssot";
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
    <PageShell>
      <PageHeader title="Bank Payouts" onBack={() => setLocation("/settings")} />

      <div className="flex-1 min-h-0 w-full max-w-5xl mx-auto overflow-y-auto px-4 pt-6 pb-32 mobile-scroll touch-pan-y">
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
            <Button onClick={handleCreateAccount} disabled={connectStripe.isPending} className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
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
            <div className="w-16 h-16 rounded-full bg-[var(--color-status-danger-bg)] flex items-center justify-center mx-auto mb-4 border border-[var(--color-status-danger-border)]">
              <AlertCircle className="w-8 h-8 text-[var(--color-status-danger-text)]" />
            </div>
            <h3 className="text-lg font-bold text-[var(--color-status-danger-text)]">Connection Error</h3>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <Button onClick={() => { setErrorMsg(null); connectStatus.refetch(); setPhase("loading"); }} variant="outline" className="mt-4 gap-2">
              <RefreshCw className="w-4 h-4" /> Try Again
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
