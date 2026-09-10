import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { PageShell, PageHeader } from "@/components/ui/ssot";
import { Button } from "@/components/ui";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCircle2, ArrowRight, ChevronRight } from "lucide-react";
import { SetupChecklistWidget } from "@/features/onboarding/SetupChecklistWidget";
import { TodaySegment } from "@/features/dashboard/TodaySegment";
import { useBusinessTasks } from "@/features/dashboard/useBusinessTasks";
import {
  bookingTime,
  instant,
  statusLabel,
} from "@/features/workspace/bookingPresentation";
export default function Dashboard() {
  const { user } = useAuth();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const query = trpc.dashboard.getArtistOverview.useQuery({
    timeZone: timezone,
  });
  const {
    tasks,
    isLoading: tasksLoading,
    error: tasksError,
    actions: { refetch: retryTasks },
  } = useBusinessTasks();
  const [showTasks, setShowTasks] = useState(false);
  const sessions = (query.data?.todayTimeline || []).filter(
    s => s.status !== "cancelled" && s.status !== "no-show"
  );
  const next =
    sessions.find(
      s => s.status !== "completed" && instant(s.endTime).getTime() > Date.now()
    ) || query.data?.nextAppointment;
  const date = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: timezone,
  }).format(new Date());
  const nextForms = (query.data?.readinessForms || []).filter(
    f => f.appointmentId === next?.id
  );
  const allSigned =
    nextForms.length > 0 && nextForms.every(f => f.status === "signed");
  const bookingHref = (s: any) =>
    s.conversationId
      ? `/projects/${s.conversationId}?session=${s.id}`
      : `/calendar?appointment=${s.id}`;
  return (
    <PageShell>
      <PageHeader title="Today" subtitle={date} />
      <main className="workspace-scroll">
        <div className="workspace-content space-y-7">
          <button
            className="workspace-card w-full flex items-center gap-3 text-left !py-3 min-h-12"
            onClick={() =>
              tasksError ? retryTasks() : setShowTasks(!showTasks)
            }
            aria-expanded={showTasks}
          >
            <Bell size={19} className="text-gold" />
            <span className="flex-1">
              {tasksError
                ? "Couldn’t check your tasks. Tap to retry."
                : tasksLoading
                  ? "Checking what needs you…"
                  : tasks.length
                    ? `${tasks.length} ${tasks.length === 1 ? "thing needs" : "things need"} you`
                    : "Nothing needs your attention"}
            </span>
            <ChevronRight size={18} />
          </button>
          {showTasks && <TodaySegment tasksOnly />}
          {query.isLoading && (
            <p role="status" className="workspace-card">
              Loading your day…
            </p>
          )}
          {query.error && (
            <div className="workspace-card" role="alert">
              <p>We couldn’t load your appointments.</p>
              <Button onClick={() => query.refetch()}>Try again</Button>
            </div>
          )}
          {!query.isLoading && !query.error && (
            <div className="grid gap-8 lg:grid-cols-2">
              <section>
                <h2 className="workspace-section-title">Up next</h2>
                {next ? (
                  <article className="workspace-card space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat("en-AU", {
                        day: "numeric",
                        month: "short",
                        timeZone: timezone,
                      }).format(instant(next.startTime))}{" "}
                      · {bookingTime(next.startTime, timezone)}–
                      {bookingTime(next.endTime, timezone)}
                    </p>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">
                        {next.client?.name || next.title || "Appointment"}
                      </h3>
                      <p className="workspace-subtitle">
                        {next.title}
                        {next.sessionIndex && next.sessionTotal
                          ? ` · Session ${next.sessionIndex} of ${next.sessionTotal}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span
                        className="workspace-status"
                        data-tone={
                          next.paymentStatus === "deposit_paid" ||
                          (next.totalPaidAmountCents || 0) > 0
                            ? "success"
                            : "warning"
                        }
                      >
                        {(next.totalPaidAmountCents || 0) > 0 ||
                        next.paymentStatus === "deposit_paid" ? (
                          <>
                            <CheckCircle2 size={14} />
                            Payment received
                          </>
                        ) : (
                          "Check payment"
                        )}
                      </span>
                      <span
                        className="workspace-status"
                        data-tone={
                          allSigned
                            ? "success"
                            : nextForms.length
                              ? "warning"
                              : undefined
                        }
                      >
                        {allSigned ? (
                          <>
                            <CheckCircle2 size={14} />
                            Forms signed
                          </>
                        ) : nextForms.length ? (
                          "Forms outstanding"
                        ) : (
                          statusLabel(next.status)
                        )}
                      </span>
                    </div>
                    <Link href={bookingHref(next)} className="workspace-link">
                      View booking <ArrowRight size={17} />
                    </Link>
                  </article>
                ) : (
                  <div className="workspace-card">
                    <h3 className="font-semibold">Room for your next piece</h3>
                    <p className="workspace-subtitle">
                      No upcoming appointments. Share your booking link or add a
                      booking to your calendar.
                    </p>
                    <Link className="workspace-link" href="/artist-profile">
                      Your booking profile <ArrowRight size={17} />
                    </Link>
                  </div>
                )}
              </section>
              <section>
                <h2 className="workspace-section-title">Your day</h2>
                {sessions.length ? (
                  sessions.map(s => (
                    <Link
                      href={bookingHref(s)}
                      className="workspace-menu-row !py-4"
                      key={s.id}
                    >
                      <time className="text-sm text-muted-foreground w-12 shrink-0">
                        {bookingTime(s.startTime, timezone)}
                      </time>
                      <span className="flex-1 min-w-0">
                        <strong className="block truncate">
                          {s.client?.name || s.title}
                        </strong>
                        <span className="block text-sm text-muted-foreground truncate">
                          {s.title}
                        </span>
                      </span>
                      <ChevronRight size={17} />
                    </Link>
                  ))
                ) : (
                  <p className="workspace-subtitle">
                    Nothing booked today. Your calendar is ready when you are.
                  </p>
                )}
                <Link className="workspace-link" href="/calendar">
                  View calendar <ArrowRight size={17} />
                </Link>
              </section>
            </div>
          )}
          <details className="border-t border-border pt-4">
            <summary className="min-h-12 cursor-pointer text-sm font-medium">
              Your setup checklist
            </summary>
            <SetupChecklistWidget />
          </details>
        </div>
      </main>
    </PageShell>
  );
}
