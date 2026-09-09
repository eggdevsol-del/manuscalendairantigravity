import { useState } from "react";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
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
    <SheetShell
      isOpen
      onClose={onClose}
      title={`${name} subscription`}
      description={
        active
          ? `${name} is active`
          : `Review your monthly plan and pay securely.`
      }
    >
      <div className="max-w-lg mx-auto w-full pb-4">
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
    </SheetShell>
  );
}
