import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { DotsCheckout } from "@/components/ui/ssot/DotsCheckout";
import { Action, Panel, Status } from "../design/primitives";

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
  const utils = trpc.useUtils();
  useEffect(() => {
    if (!submitted && !active) return;
    const refresh = () => {
      void utils.billing.invalidate();
      void utils.studios.invalidate();
      void utils.artistSettings.invalidate();
    };
    refresh();
    const timers = [600, 1500].map(delay => setTimeout(refresh, delay));
    return () => timers.forEach(clearTimeout);
  }, [submitted, active, utils]);
  return (
    <SheetShell isOpen title={`${name} subscription`} onClose={onClose}>
      <div className="v3-stack">
        {active ? (
          <Panel>
            <Status tone="success">{name} is active</Status>
            <p>
              Your subscription has been confirmed. Your plan benefits are
              ready.
            </p>
            <Action onClick={onClose}>Continue</Action>
          </Panel>
        ) : submitted ? (
          <Panel>
            <h2>Confirming your subscription</h2>
            <p role="status">
              Payment was submitted. Your plan will update when confirmation
              arrives. Please don’t pay again.
            </p>
            <Action tone="secondary" onClick={onRefresh}>
              Check status
            </Action>
          </Panel>
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
