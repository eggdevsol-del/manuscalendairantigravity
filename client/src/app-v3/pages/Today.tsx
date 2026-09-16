import { SittingCard } from "../components/SittingCard";
import { SittingSummary } from "../components/SittingSummary";
import { WeekAgenda } from "../design/WeekAgenda";
import { HomeTabs } from "../design/HomeTabs";
import { DesignBrief } from "../design/DesignBrief";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Circle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useBusinessTasks } from "@/features/dashboard/useBusinessTasks";
import {
  money,
  bookingTime,
  instant,
} from "@/features/workspace/bookingPresentation";
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
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const day = trpc.dashboard.getArtistOverview.useQuery({ timeZone: zone });
  const tasks = useBusinessTasks();
  const [expanded, setExpanded] = useState(false);
  const [, go] = useLocation();
  const [actionError, setActionError] = useState("");
  const sessions = (day.data?.todayTimeline || []).filter(
    s => !["cancelled", "no-show"].includes(s.status)
  );
  const next =
    sessions.find(
      s => s.status !== "completed" && instant(s.endTime).getTime() > Date.now()
    ) || day.data?.nextAppointment;
  const date = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: zone,
  }).format(new Date());
  const href = (s: NonNullable<typeof next>) =>
    s.conversationId
      ? `/projects/${s.conversationId}?session=${s.id}`
      : `/calendar?appointment=${s.id}&date=${encodeURIComponent(s.startTime)}`;
  return (
    <Screen title="Today" subtitle={date} wide subheader={<HomeTabs />}>
      <div className="v3-home-workspace">
        <div className="v3-home-main">
          <Panel>
            <button
              className="v3-attention"
              aria-expanded={expanded}
              onClick={() =>
                tasks.error ? tasks.actions.refetch() : setExpanded(!expanded)
              }
            >
              <Bell size={21} />
              <span>
                {tasks.error
                  ? "Couldn’t check your tasks. Try again."
                  : tasks.isLoading
                    ? "Checking what needs you…"
                    : tasks.tasks.length
                      ? `${tasks.tasks.length} ${tasks.tasks.length === 1 ? "thing needs" : "things need"} you`
                      : "Nothing needs your attention"}
              </span>
              <ChevronRight size={19} />
            </button>
            {expanded && tasks.tasks.length > 0 && (
              <Section title="Needs your attention">
                {tasks.tasks.map(task => (
                  <div
                    key={task.id}
                    className="v3-task-card"
                    data-priority={task._serverTask.priorityLevel}
                  >
                    <Row
                      title={task.title}
                      detail={task.context}
                      onClick={() => {
                        const t = task._serverTask;
                        tasks.actions.startTask(t);
                        if (t.deepLink) go(t.deepLink);
                        else if (t.conversationId)
                          go(`/chat/${t.conversationId}`);
                        else if (t.emailRecipient) tasks.actions.openEmail(t);
                        else if (t.smsNumber) tasks.actions.openSms(t);
                        else go("/clients");
                      }}
                    />
                    {task._serverTask.conversationId && (
                      <DesignBrief
                        conversationId={task._serverTask.conversationId}
                      />
                    )}
                    <Action
                      tone="quiet"
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
                      Mark done
                    </Action>
                  </div>
                ))}
                {actionError && <p role="alert">{actionError}</p>}
              </Section>
            )}
          </Panel>
          <Feedback
            loading={day.isLoading}
            error={day.error}
            onRetry={() => day.refetch()}
          />
          {day.data && (
            <div className="v3-stack">
              <Section title="Up next">
                {next ? (
                  <SittingCard
                    key={next.id}
                    title={next.client?.name || next.title}
                    detail={`${bookingTime(next.startTime, zone)}–${bookingTime(next.endTime, zone)} · ${next.title}`}
                  >
                    {next.conversationId ? (
                      <SittingSummary
                        conversationId={next.conversationId}
                        appointmentId={next.id}
                      />
                    ) : (
                      <ActionLink href={href(next)} tone="primary">
                        Open sitting & actions
                      </ActionLink>
                    )}
                    {next.conversationId && (
                      <DesignBrief conversationId={next.conversationId} />
                    )}
                  </SittingCard>
                ) : (
                  <Panel>
                    <h3>Room for your next piece</h3>
                    <p>
                      No upcoming appointments. Your booking link is ready for
                      your next client.
                    </p>
                    <ActionLink href="/artist-profile" tone="quiet">
                      Your booking profile <ArrowRight />
                    </ActionLink>
                  </Panel>
                )}
              </Section>
              <WeekAgenda />
            </div>
          )}
        </div>
        <aside className="v3-home-aside">
          <HomeMoney />
          <Panel>
            <h2>Supplies</h2>
            <p className="v3-muted">
              Buy from your suppliers without leaving your working day.
            </p>
            <ActionLink href="/supplies" tone="primary">
              Browse suppliers
            </ActionLink>
            <Row
              title="Your orders"
              detail="Review orders and payment status"
              href="/supply-orders"
            />
          </Panel>
          <ArtistSetup />
        </aside>
      </div>
    </Screen>
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
    <details className="v3-divider">
      <summary className="v3-row">
        Set up your business{" "}
        <span className="v3-muted">
          {steps.filter(s => s.done).length} of {steps.length}
        </span>
      </summary>
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
    </details>
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
      <ActionLink href="/money" tone="primary">
        Payments & payouts
      </ActionLink>
    </Panel>
  );
}
