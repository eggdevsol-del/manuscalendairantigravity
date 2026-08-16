/**
 * HomeTab — "Today" view for the redesigned dashboard.
 *
 * Sections:
 *  1. "In the Chair Today" — today's sessions, sorted by time
 *  2. "Needs You" — deadline-sorted tasks from the Revenue Protection Algorithm
 *  3. "Gone Cold" — collapsed section for stale/low-priority tasks
 *
 * Data sources:
 *  - Today's appointments: trpc.dashboard.getArtistOverview → todayTimeline
 *  - Tasks: trpc.dashboardTasks.getBusinessTasks → sorted by priority
 *  - Invoice tasks: from the shared useClientGroups derivation
 */

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Check,
  MessageSquare,
  Mail,
  Smartphone,
  DollarSign,
  Calendar,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { formatCents } from "@/lib/formatMoney";
import { format, isToday, isFuture, isPast } from "date-fns";
import { useLocation } from "wouter";
import {
  useBusinessTasks,
  type BusinessTask as ServerBusinessTask,
} from "@/features/dashboard/useBusinessTasks";
import { TaskCard } from "@/components/ui/ssot";
import type { TaskCardAction } from "@/components/ui/ssot/TaskCard";

// ── Helpers ───────────────────────────────────────────────

function ensureUTC(raw: string): string {
  if (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw)) return raw;
  return raw.replace(" ", "T") + "Z";
}

function formatSessionTime(startTime: string, endTime: string): string {
  const start = new Date(ensureUTC(startTime));
  const end = new Date(ensureUTC(endTime));
  const startStr = format(start, "h:mm a");
  const endStr = format(end, "h:mm a");
  const hours = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60) * 10) / 10;
  return `${startStr} – ${endStr} · ${hours}h`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "confirmed": return "var(--color-success)";
    case "pending": return "var(--color-status-warning-text)";
    case "completed": return "var(--color-success)";
    case "no-show": return "var(--color-status-danger-text)";
    default: return "var(--color-muted-foreground)";
  }
}

// ── Types ─────────────────────────────────────────────────

interface HomeTabProps {
  demoMode?: boolean;
}

// ── Component ─────────────────────────────────────────────

export function HomeTab({ demoMode = false }: HomeTabProps) {
  const [, setLocation] = useLocation();
  const [showColdTasks, setShowColdTasks] = useState(false);

  // Today's appointments
  const { data: overview, isLoading: overviewLoading } =
    trpc.dashboard.getArtistOverview.useQuery(undefined, { enabled: !demoMode });

  // Business tasks
  const {
    tasks: businessTasks,
    isLoading: tasksLoading,
    settings: businessSettings,
    actions: businessActions,
    completingTask,
  } = useBusinessTasks();

  // Partition tasks into urgent ("Needs You") and cold ("Gone Cold")
  const { needsYouTasks, coldTasks } = useMemo(() => {
    const mapped = (businessTasks || []).map(t => ({
      id: t.id,
      title: t.title,
      context: t.context,
      priority: t.priority,
      status: t.status,
      actionType: t.actionType,
      _serverTask: t._serverTask,
      _conversationId: t._conversationId,
    }));

    // "Gone Cold" = low priority + stale conversations
    const cold = mapped.filter(t => {
      const st = t._serverTask;
      if (!st) return false;
      // Low-priority or stale conversations with no due date
      return (
        st.priorityLevel === "low" ||
        (st.taskType === "stale_conversation" && st.priorityScore < 300)
      );
    });

    const needs = mapped.filter(t => !cold.includes(t));

    return { needsYouTasks: needs, coldTasks: cold };
  }, [businessTasks]);

  // Today's timeline
  const todayTimeline = overview?.todayTimeline || [];
  const stats = overview?.stats;

  // Task click handler
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const handleTaskClick = useCallback((taskId: string) => {
    setExpandedTaskId(prev => prev === taskId ? null : taskId);
  }, []);

  const handleTaskAction = useCallback((task: any) => {
    const serverTask = task._serverTask;
    if (!serverTask) return;
    if (serverTask.deepLink) {
      setLocation(serverTask.deepLink);
    }
  }, [setLocation]);

  const handleMarkDone = useCallback(async (task: any) => {
    if (task._serverTask) {
      await businessActions.completeTask(task._serverTask, "manual");
    }
    setExpandedTaskId(null);
  }, [businessActions]);

  const isLoading = overviewLoading || tasksLoading;

  if (isLoading && !demoMode) {
    return (
      <div className="space-y-4 animate-pulse">
        {/* Skeleton: Today section */}
        <div className="rounded-2xl bg-secondary/30 h-24" />
        <div className="rounded-2xl bg-secondary/30 h-16" />
        <div className="rounded-2xl bg-secondary/30 h-16" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ── In the Chair Today ────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/70">
            In the Chair Today
          </h2>
          {stats && (
            <span className="text-xs font-semibold text-muted-foreground/50">
              {stats.appointmentsToday} session{stats.appointmentsToday !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {todayTimeline.length === 0 ? (
          <div className="rounded-2xl border border-border/30 bg-card/50 p-6 text-center">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground/50">
              No sessions today
            </p>
            <p className="text-xs text-muted-foreground/30 mt-1">
              Enjoy your day off
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayTimeline.map((appt: any) => {
              const priceCents = appt.totalExpectedAmountCents || (appt.price ? appt.price * 100 : 0);
              const paidCents = appt.totalPaidAmountCents || 0;
              const isPaid = appt.paymentStatus === "fully_paid";
              const isConfirmed = appt.status === "confirmed";
              const isNow = new Date(ensureUTC(appt.startTime)) <= new Date() &&
                           new Date(ensureUTC(appt.endTime)) >= new Date();

              return (
                <motion.div
                  key={appt.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-2xl border bg-card p-4",
                    isNow
                      ? "border-primary/40 ring-1 ring-primary/20 bg-primary/5"
                      : "border-border/30"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
                        {appt.client?.avatar ? (
                          <img
                            src={appt.client.avatar}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-5 h-5 text-muted-foreground/50" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {appt.client?.name || "Client"}
                        </p>
                        <p className="text-xs text-muted-foreground/70 truncate">
                          {appt.serviceName || appt.title} · {formatSessionTime(appt.startTime, appt.endTime)}
                        </p>
                      </div>
                    </div>

                    {/* Status / Price */}
                    <div className="flex flex-col items-end shrink-0 ml-2">
                      {isPaid ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-success)] bg-[var(--color-success)]/10 px-2 py-0.5 rounded-full">
                          Paid
                        </span>
                      ) : priceCents > 0 ? (
                        <span className="text-xs font-semibold text-foreground/80">
                          {formatCents(priceCents)}
                        </span>
                      ) : null}

                      {isNow && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary mt-1">
                          NOW
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Payment bar */}
                  {priceCents > 0 && !isPaid && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--color-success)] transition-all"
                          style={{ width: `${Math.min(100, (paidCents / priceCents) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-semibold text-muted-foreground/50">
                        {paidCents > 0 ? `${formatCents(paidCents)} paid` : "No deposit"}
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Needs You ─────────────────────────────────── */}
      {needsYouTasks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground/70">
              Needs You
            </h2>
            <span className="text-xs font-semibold text-muted-foreground/50">
              {needsYouTasks.length} task{needsYouTasks.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-1">
            {needsYouTasks.map(task => {
              const isExpanded = expandedTaskId === task.id;

              // Build actions for expanded task
              const actions: TaskCardAction[] = [];
              if (isExpanded && task._serverTask) {
                if (task._serverTask.emailRecipient) {
                  actions.push({
                    id: "email",
                    label: "Email",
                    icon: Mail,
                    onClick: () => {
                      if (task._serverTask) businessActions.openEmail(task._serverTask);
                    },
                  });
                }
                if (task._serverTask.smsNumber) {
                  actions.push({
                    id: "sms",
                    label: "SMS",
                    icon: Smartphone,
                    onClick: () => {
                      if (task._serverTask) businessActions.openSms(task._serverTask);
                    },
                  });
                }
                actions.push({
                  id: "done",
                  label: "Complete",
                  icon: Check,
                  onClick: () => handleMarkDone(task),
                  className: "bg-[var(--color-success)] text-white hover:bg-[var(--color-success)]/90",
                });
                if (task._serverTask.clientId) {
                  actions.push({
                    id: "chat",
                    label: "Messages",
                    icon: MessageSquare,
                    onClick: () => {
                      if (task._serverTask?.deepLink) {
                        setLocation(task._serverTask.deepLink);
                      }
                    },
                  });
                }
              }

              return (
                <TaskCard
                  key={task.id}
                  title={task.title}
                  context={task.context}
                  priority={task.priority}
                  status={task.status}
                  actionType={task.actionType as any}
                  onClick={() => handleTaskClick(task.id)}
                  isExpanded={isExpanded}
                  clientName={task._serverTask?.clientName ?? undefined}
                  actions={actions}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* ── Gone Cold ─────────────────────────────────── */}
      {coldTasks.length > 0 && (
        <section>
          <button
            onClick={() => setShowColdTasks(!showColdTasks)}
            className="flex items-center gap-2 w-full text-left py-2 group"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground/50 transition-transform",
                showColdTasks && "rotate-180"
              )}
            />
            <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground/40">
              Gone Cold
            </span>
            <span className="text-xs font-semibold text-muted-foreground/30 ml-auto">
              {coldTasks.length}
            </span>
          </button>

          <AnimatePresence>
            {showColdTasks && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-1 pt-2">
                  {coldTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      title={task.title}
                      context={task.context}
                      priority={task.priority}
                      status={task.status}
                      actionType={task.actionType as any}
                      onClick={() => handleTaskAction(task)}
                      clientName={task._serverTask?.clientName ?? undefined}
                    />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Empty state when no tasks and no sessions */}
      {needsYouTasks.length === 0 && coldTasks.length === 0 && todayTimeline.length === 0 && (
        <div className="rounded-2xl border border-border/30 bg-card/50 p-8 text-center">
          <Sparkles className="w-10 h-10 mx-auto mb-3 text-primary/30" />
          <p className="text-base font-semibold text-muted-foreground/60">
            You're all caught up
          </p>
          <p className="text-xs text-muted-foreground/30 mt-1">
            Nothing needs your attention right now
          </p>
        </div>
      )}
    </div>
  );
}
