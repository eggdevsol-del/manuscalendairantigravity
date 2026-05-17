import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface StripeConnectStepProps {
  onNext: () => void;
}

export function StripeConnectStep({ onNext }: StripeConnectStepProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Poll for verification status every 30s
  const { data: status, refetch } = trpc.merchantAuth.getMerchantStripeStatus.useQuery(
    undefined,
    {
      refetchInterval: 30000, // 30 seconds
      refetchOnWindowFocus: true,
    }
  );

  // Mutation to initiate Express onboarding
  const { mutate: connectStripe, isPending: isConnecting } = trpc.merchantAuth.connectStripe.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      setError(err.message || "Failed to connect to Stripe.");
      setIsRedirecting(false);
    },
  });

  const handleConnect = () => {
    setIsRedirecting(true);
    setError(null);
    connectStripe();
  };

  // State 2: Verified (Both flags true)
  useEffect(() => {
    if (status?.connected && status?.chargesEnabled && status?.payoutsEnabled) {
      onNext();
    }
  }, [status, onNext]);

  // Determine current UI state
  const isVerified = status?.connected && status?.chargesEnabled && status?.payoutsEnabled;
  const isPending = status?.connected && (!status?.chargesEnabled || !status?.payoutsEnabled);
  const isUninitiated = !status?.connected;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center justify-center py-12 text-center">
      
      {/* State 1: Pending */}
      {isPending && !isVerified && !error && (
        <div className="space-y-4 flex flex-col items-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <h3 className="text-xl font-bold">Stripe is verifying your account</h3>
          <p className="text-muted-foreground max-w-sm">
            This usually takes a few minutes. You can wait here, or return to your dashboard and we'll notify you when your store is live.
          </p>
          <Button variant="outline" onClick={() => refetch()} className="mt-4">
            Refresh Status
          </Button>
        </div>
      )}

      {/* State 3: Failed / Retry (or Not Initiated) */}
      {(isUninitiated || error) && !isVerified && (
        <div className="space-y-4 flex flex-col items-center">
          {error && <AlertCircle className="w-12 h-12 text-destructive mb-2" />}
          <h3 className="text-xl font-bold">Connect your Bank Account</h3>
          <p className="text-muted-foreground max-w-sm">
            Tattoi partners with Stripe for secure, fast payouts. You'll be redirected to Stripe to verify your identity and connect your bank.
          </p>
          
          {error && <p className="text-sm text-destructive font-medium">{error}</p>}

          <Button
            size="lg"
            onClick={handleConnect}
            disabled={isRedirecting || isConnecting}
            className="w-full max-w-xs shadow-lg rounded-full mt-4"
          >
            {isRedirecting || isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting...
              </>
            ) : (
              "Connect with Stripe"
            )}
          </Button>
        </div>
      )}

      {/* State 2: Verified (Transitional) */}
      {isVerified && (
        <div className="space-y-4 flex flex-col items-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          <h3 className="text-xl font-bold">Account Verified!</h3>
          <p className="text-muted-foreground">Moving you to the next step...</p>
        </div>
      )}

    </div>
  );
}
