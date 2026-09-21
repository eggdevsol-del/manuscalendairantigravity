import { SheetShell } from "@/components/ui/overlays/sheet-shell";
import { DetailsSheet } from "../components/DetailsSheet";
import { WeekAgenda } from "../design/WeekAgenda";
import { HomeTabs } from "../design/HomeTabs";
import { PromotionWizardContent } from "@/features/promotions/PromotionWizardContent";
import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Circle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBusinessTasks } from "@/features/dashboard/useBusinessTasks";
import { money } from "@/features/workspace/bookingPresentation";
import {
  Action,
  ActionLink,
  Feedback,
  Panel,
  Row,
  Screen,
  Section,
} from "../design/primitives";

export default function Today() {
  const tasks = useBusinessTasks();
  const [, go] = useLocation();
  const [promo, setPromo] = useState(false);
  const [actionError, setActionError] = useState("");
  return (
    <Screen
      title="Today"
      subtitle={new Date().toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
      wide
      subheader={<HomeTabs />}
    >
      <div className="v3-home-workspace">
        <div className="v3-home-main">
          <Section
            title="Needs attention"
            action={
              <Action
                tone="quiet"
                data-tour-title="Create a promotion"
                data-tour-description="Build a voucher or offer to attract bookings. Review its value and rules before saving; creating it does not send it to clients."
                onClick={() => setPromo(true)}
              >
                Create promo
              </Action>
            }
          >
            <Feedback
              loading={tasks.isLoading}
              error={tasks.error}
              onRetry={() => tasks.actions.refetch()}
            />
            {!tasks.isLoading && !tasks.error && !tasks.tasks.length && (
              <p className="v3-muted">
                You’re up to date. Create a promotion to bring in your next
                booking.
              </p>
            )}
            {tasks.tasks.map(task => (
              <div
                className="today-task"
                key={task.id}
                data-priority={task._serverTask.priorityLevel}
              >
                <Row
                  title={task.title}
                  detail={task.context}
                  onClick={() => {
                    const t = task._serverTask;
                    tasks.actions.startTask(t);
                    if (t.deepLink) go(t.deepLink);
                    else if (t.conversationId) go(`/chat/${t.conversationId}`);
                    else if (t.emailRecipient) tasks.actions.openEmail(t);
                    else if (t.smsNumber) tasks.actions.openSms(t);
                    else go("/clients");
                  }}
                />
                <button
                  className="v3-icon-button"
                  aria-label={`Mark done: ${task.title}`}
                  disabled={!!tasks.completingTask}
                  onClick={async () => {
                    try {
                      setActionError("");
                      await tasks.actions.completeTask(
                        task._serverTask,
                        "manual"
                      );
                    } catch {
                      setActionError(
                        "Couldn’t mark this task done. Please try again."
                      );
                    }
                  }}
                >
                  <CheckCircle2 size={20} />
                </button>
              </div>
            ))}
            {actionError && <p role="alert">{actionError}</p>}
          </Section>
          <WeekAgenda />
        </div>
        <aside className="v3-home-aside">
          <HomeMoney />
          <TodaySupplies />
          <ArtistSetup />
        </aside>
      </div>
      <SheetShell
        isOpen={promo}
        onClose={() => setPromo(false)}
        title="Create promo"
      >
        {promo && <PromotionWizardContent onClose={() => setPromo(false)} />}
      </SheetShell>
    </Screen>
  );
}

function TodaySupplies() {
  const query = trpc.supplierOrders.getSupplierOrders.useQuery();
  // Payment/handoff is the source of truth; the supplier integration has no delivery tracking.
  const paid = query.data?.filter(o => o.status === "paid") || [];
  const recent = paid.filter(
    o => new Date(o.createdAt).getTime() >= Date.now() - 30 * 86400000
  );
  const recommendation = paid.find(
    o => !recent.some(r => r.supplierId === o.supplierId) && !query.data?.some(r => r.supplierId === o.supplierId && r.status === "pending") && o.items.length > 0
  );
  return (
    <Section title="Supplies">
      <Feedback
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
      />
      {recent.map(order => (
        <Row
          key={order.id}
          title={`${order.supplier?.name || "Supplier"} · #${order.id}`}
          detail={`${order.items.reduce((n, item) => n + item.quantity, 0)} items · ${money(order.totalCents, order.currency)} · ${order.shopifyDraftOrderId ? "Sent to supplier" : "Supplier handoff pending"}`}
          href={`/supply-orders?order=${order.id}`}
        />
      ))}
      {!!recent.length && (
        <p className="v3-muted">
          Shipping and delivery dates are not supplied yet. Check your
          supplier’s shipping confirmation.
        </p>
      )}
      {!query.isLoading && !query.error && !recent.length && (
        <p className="v3-muted">No paid supply orders in the last 30 days.</p>
      )}
      {recommendation && (
        <Panel>
          <h3>Buy again</h3>
          <p>
            {recommendation.items
              .map(i => `${i.quantity} × ${i.productTitle}`)
              .join(" · ")}
          </p>
          <p className="v3-muted">
            Based on your previous order from{" "}
            {recommendation.supplier?.name || "this supplier"}. Check your stock
            before ordering.
          </p>
          <ActionLink
            tone="quiet"
            href={`/supplies?supplier=${recommendation.supplierId}&reorder=${recommendation.id}`}
          >
            Review reorder
          </ActionLink>
        </Panel>
      )}
    </Section>
  );
}

function ArtistSetup() {
  const { user, refresh } = useAuth();
  const settings = trpc.artistSettings.get.useQuery();
  const complete = trpc.auth.completeOnboarding.useMutation({
    onSuccess: () => refresh(),
  });
  if (!user || user.hasCompletedOnboarding !== 0) return null;
  let services = false,
    hours = false;
  try {
    services = JSON.parse(settings.data?.services || "[]").length > 0;
    hours =
      Object.keys(JSON.parse(settings.data?.workSchedule || "{}")).length > 0;
  } catch {}
  const steps = [
    {
      title: "Your profile",
      detail: "A photo and contact number",
      href: "/settings?section=profile",
      done: !!user.avatar && !!user.phone,
    },
    {
      title: "Tattooing location",
      detail: "Where your clients will find you",
      href: "/settings?section=business",
      done: !!settings.data?.businessAddress,
    },
    {
      title: "Working hours",
      detail: "Your regular availability",
      href: "/work-hours",
      done: hours,
    },
    {
      title: "Services",
      detail: "What you offer and how you price it",
      href: "/settings?section=work-hours",
      done: services,
    },
    {
      title: "Bank payouts",
      detail: "Receive booking payments",
      href: "/bank-payouts",
      done: settings.data?.stripeConnectPayoutsEnabled === 1,
    },
  ];
  return (
    <DetailsSheet
      className="v3-divider"
      title={
        <>
          Set up your business{" "}
          <span className="v3-muted">
            {steps.filter(s => s.done).length} of {steps.length}
          </span>
        </>
      }
    >
      <Feedback
        loading={settings.isLoading}
        error={settings.error}
        onRetry={() => settings.refetch()}
      />
      {steps.map(s => (
        <Row
          key={s.title}
          title={s.title}
          detail={s.detail}
          href={s.href}
          icon={s.done ? <CheckCircle2 /> : <Circle />}
        />
      ))}
      {steps.every(s => s.done) && (
        <Action disabled={complete.isPending} onClick={() => complete.mutate()}>
          Finish setup
        </Action>
      )}
      {complete.error && <p role="alert">{complete.error.message}</p>}
    </DetailsSheet>
  );
}

function HomeMoney() {
  const query = trpc.payouts.nextPayout.useQuery();
  const balance = query.data;
  return (
    <Panel>
      <h2>Your money</h2>
      <Feedback
        loading={query.isLoading}
        error={
          query.error || (balance && "error" in balance ? balance.error : null)
        }
        onRetry={() => query.refetch()}
      />
      {balance && !("error" in balance) && (
        <dl className="v3-facts">
          <div>
            <dt>Available for payout</dt>
            <dd>
              {typeof balance.availableAmountCents === "number"
                ? money(balance.availableAmountCents, balance.currency)
                : "Connect payouts"}
            </dd>
          </div>
          <div>
            <dt>Pending</dt>
            <dd>{money(balance.pendingAmountCents, balance.currency)}</dd>
          </div>
        </dl>
      )}
    </Panel>
  );
}
