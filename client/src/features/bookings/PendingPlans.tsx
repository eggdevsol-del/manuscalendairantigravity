import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui";
import { SessionPlanCheckoutSheet } from "./SessionPlanCheckoutSheet";
export function PendingPlans() {
  const query = trpc.sessionPlans.getByClient.useQuery();
  const [selected, setSelected] = useState<{
    id: number;
    conversationId: number;
  } | null>(null);
  const plans = query.data?.filter(p => p.status === "pending") || [];
  if (query.error)
    return (
      <div role="alert" className="border rounded-xl p-4 mb-4">
        <p>We couldn't load plans awaiting your response.</p>
        <Button variant="ghost" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  if (!plans.length) return null;
  return (
    <section
      aria-label="Plans awaiting your response"
      className="space-y-3 mb-6"
    >
      <h2 className="text-sm font-semibold">Confirm your appointment</h2>
      {plans.map(plan => (
        <article key={plan.id} className="workspace-card !bg-accent space-y-3">
          <div className="flex justify-between gap-3">
            <h3 className="font-semibold">
              {plan.artist?.name || "Your artist"}
            </h3>
            <span className="text-sm">
              {plan.items.length} session{plan.items.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Deposit and fee: AUD $
            {(
              (plan.depositTotalCents + (plan.platformFeeCents || 0)) /
              100
            ).toFixed(2)}
          </p>
          <Button
            className="w-full min-h-12"
            onClick={() =>
              setSelected({
                id: plan.id,
                conversationId: plan.conversationId || 0,
              })
            }
          >
            Review dates & pay deposit
          </Button>
        </article>
      ))}
      {selected && (
        <SessionPlanCheckoutSheet
          sessionPlanId={selected.id}
          conversationId={selected.conversationId}
          onClose={() => {
            setSelected(null);
            void query.refetch();
          }}
        />
      )}
    </section>
  );
}
