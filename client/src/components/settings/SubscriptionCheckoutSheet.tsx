import { useState } from "react";
import { FullScreenSheet } from "@/components/ui/ssot/FullScreenSheet";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";

export function SubscriptionCheckoutSheet({
  clientSecret,
  name,
  active,
  onClose,
  onRefresh,
}: {
  clientSecret: string;
  name: string;
  active: boolean;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  return (
    <FullScreenSheet
      open
      surfaceClassName="bg-background"
      onClose={onClose}
      title={`${name} subscription`}
      contextTitle={active ? `${name} is active` : `Join ${name}`}
    >
      <div className="max-w-lg mx-auto w-full pb-24">
        {active ? (
          <div role="status" className="space-y-4">
            <p>Your subscription is active. Your plan benefits are ready.</p>
            <button onClick={onClose} className="underline py-3">
              Continue
            </button>
          </div>
        ) : submitted ? (
          <div role="status" className="space-y-4">
            <p>
              Confirming your subscription… Your plan will update when payment
              confirmation arrives.
            </p>
            <button onClick={onRefresh} className="underline py-3">
              Check status
            </button>
          </div>
        ) : (
          <DotsCheckout
            clientSecret={clientSecret}
            amountCents={0}
            onBack={onClose}
            onComplete={() => {
              setSubmitted(true);
              onRefresh();
            }}
          />
        )}
      </div>
    </FullScreenSheet>
  );
}
