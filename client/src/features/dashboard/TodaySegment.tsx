/**
 * TodaySegment — §6.3 Today segment
 *
 * Three sections:
 *   IN THE CHAIR TODAY — today's sessions
 *   NEEDS YOU — tasks capped at 5, same-type 3+ collapsed
 *   GONE COLD — collapsed by default, 14+ day follow-ups
 *
 * Scale rules from §6.3:
 *   - Cap main list at 5 rows + Show N more
 *   - When 3+ tasks share a type, collapse into one summary row
 *   - Sort collapsed group by amount descending
 *   - Account holder never appears as client
 */

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useClientGroups } from "./useClientGroups";
import {
  useBusinessTasks,
  type BusinessTask as TransformedTask,
} from "./useBusinessTasks";
import { formatCents } from "@/lib/formatMoney";
import { DT, DType, DRadius, DSpace } from "./dashboardTokens";
import { format, isPast } from "date-fns";
import { utcToLocal } from "@shared/utils/timezone";
import { ChevronDown, ChevronUp, Check, Mail, Smartphone, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";

// ── Helpers ──────────────────────────────────────────────

function ensureUTC(raw: string): string {
  if (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw)) return raw;
  return raw.replace(" ", "T") + "Z";
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

/** Plural helper — never "1 sessions" */
function plural(n: number, singular: string, plural?: string): string {
  return n === 1 ? `1 ${singular}` : `${n} ${plural || singular + "s"}`;
}

/** Format session time in studio timezone. §8.3: Time TBC when absent. */
function formatSessionTime(startTime: string, tz: string | null): { time: string; duration: string } {
  const utcStr = ensureUTC(startTime);
  const timezone = tz || "Australia/Brisbane";
  const utcDate = new Date(utcStr);

  // Detect placeholder (midnight UTC with no tz = no real time set)
  const isPlaceholder = utcDate.getUTCHours() === 0 && utcDate.getUTCMinutes() === 0 && !tz;
  if (isPlaceholder) {
    return { time: "Time TBC", duration: "" };
  }

  const localDate = utcToLocal(utcStr, timezone);
  return { time: format(localDate, "h:mm a"), duration: "" };
}

/** Session duration in hours from startTime/endTime */
function getSessionDuration(startTime: string, endTime: string): string {
  const s = new Date(ensureUTC(startTime));
  const e = new Date(ensureUTC(endTime));
  const hours = Math.max(0, (e.getTime() - s.getTime()) / 3600000);
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (Number.isInteger(hours)) return `${hours} hr${hours > 1 ? "s" : ""}`;
  return `${hours.toFixed(1)} hrs`;
}

/** Exception pill — §5: first match wins. Healthy row shows nothing. */
function getExceptionFlag(session: any): string | null {
  if (session.paidCents === 0 && session.priceCents > 0) return "no deposit";
  if (session.status === "pending") return "unconfirmed";
  if (isPast(new Date(ensureUTC(session.startTime))) && session.remainingCents > 0) return "overdue";
  return null;
}

/** Payment state label for session row */
function getPaymentLabel(session: any): string {
  if (session.priceCents === 0) return "";
  if (session.paidCents >= session.priceCents) return "paid in full";
  if (session.paidCents > 0) return `${formatCents(session.paidCents)} of ${formatCents(session.priceCents)}`;
  return "no deposit";
}

// ── Section Header ──────────────────────────────────────

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: DSpace[2] }}>
      <span style={{
        fontSize: DType.sectionLabel.fontSize,
        fontWeight: DType.sectionLabel.fontWeight,
        letterSpacing: DType.sectionLabel.letterSpacing,
        color: DT.textTertiary,
        textTransform: "uppercase",
      }}>
        {label}
      </span>
      {right && (
        <span style={{
          fontSize: DType.sectionCount.fontSize,
          fontWeight: DType.sectionCount.fontWeight,
          color: DT.textTertiary,
        }}>
          {right}
        </span>
      )}
    </div>
  );
}

// ── Exception Pill ──────────────────────────────────────

function ExceptionPill({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: DType.exceptionPill.fontSize,
      fontWeight: DType.exceptionPill.fontWeight,
      color: DT.amber,
      border: `1px solid ${DT.amberBorder40}`,
      borderRadius: DRadius.pill,
      padding: "3px 8px",
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

// ── Progress Bar ────────────────────────────────────────

function ProgressBar({ pct, height = 4 }: { pct: number; height?: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% paid`}
      style={{
        height,
        borderRadius: DRadius.pill,
        background: DT.progressTrack,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div style={{
        height: "100%",
        width: `${Math.min(100, Math.max(0, pct))}%`,
        background: DT.green,
        borderRadius: DRadius.pill,
        transition: "width .45s cubic-bezier(.2,.7,.3,1)",
      }} />
    </div>
  );
}

// ── Today Session Row ───────────────────────────────────

function TodaySessionRow({ session }: { session: any }) {
  const { time } = formatSessionTime(session.startTime, session.timeZone);
  const duration = getSessionDuration(session.startTime, session.endTime);
  const exception = getExceptionFlag(session);
  const paymentLabel = getPaymentLabel(session);
  const clientName = titleCase(session.client?.name || "Client");

  // Find session number: count of sessions for this client
  // (simplified — full derivation in useClientGroups)
  const serviceName = session.serviceName || session.title || "Session";

  return (
    <div style={{
      background: DT.cardSurface,
      borderRadius: DRadius.row,
      border: `1px solid ${DT.hairline}`,
      padding: DSpace[6],
      display: "flex",
      gap: DSpace[4],
      alignItems: "flex-start",
      minHeight: 44,
    }}>
      {/* Left: time + duration */}
      <div style={{ width: 60, flexShrink: 0 }}>
        <div style={{ fontSize: DType.rowTitle.fontSize, fontWeight: DType.rowTitle.fontWeight, color: DT.textPrimary }}>
          {time}
        </div>
        <div style={{ fontSize: DType.exceptionPill.fontSize, fontWeight: DType.exceptionPill.fontWeight, color: DT.textTertiary, marginTop: 2 }}>
          {duration}
        </div>
      </div>
      {/* Right: client + service + payment */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: DType.rowTitle.fontSize, fontWeight: DType.rowTitle.fontWeight, color: DT.textPrimary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {clientName}
          </span>
          {exception && <ExceptionPill label={exception} />}
        </div>
        <div style={{ fontSize: DType.rowBodyLg.fontSize, fontWeight: DType.rowBodyLg.fontWeight, color: DT.textSecondary, marginTop: 2 }}>
          {serviceName}{paymentLabel ? ` · ${paymentLabel}` : ""}
        </div>
        {session.priceCents > 0 && (
          <div style={{ marginTop: 6 }}>
            <ProgressBar pct={session.priceCents > 0 ? Math.round((session.paidCents / session.priceCents) * 100) : 0} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Task Row ────────────────────────────────────────────

interface TaskRowProps {
  title: string;
  context: string;
  dueLabel: string;
  isUrgent?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  // Expanded state
  brief?: string | null;
  facts?: { key: string; value: string }[];
  actions?: { id: string; label: string; primary?: boolean; onClick: () => void }[];
  // Grouped summary
  isGroupSummary?: boolean;
  groupCount?: number;
  children?: React.ReactNode;
}

function TaskRow({
  title, context, dueLabel, isUrgent, expanded, onToggle,
  brief, facts, actions, isGroupSummary, groupCount, children,
}: TaskRowProps) {
  return (
    <div
      style={{
        background: expanded ? DT.rowHover : DT.cardSurface,
        borderRadius: DRadius.row,
        border: `1px solid ${isUrgent ? DT.emphasisBorder : DT.hairline}`,
        padding: DSpace[6],
        cursor: onToggle ? "pointer" : undefined,
        transition: "background .15s",
      }}
      onClick={onToggle}
    >
      {/* Collapsed header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: DType.rowTitle.fontSize,
            fontWeight: DType.rowTitle.fontWeight,
            color: DT.textPrimary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {title}
          </div>
          <div style={{
            fontSize: DType.rowBodyLg.fontSize,
            fontWeight: DType.rowBody.fontWeight,
            color: DT.textSecondary,
            marginTop: 2,
          }}>
            {context}
          </div>
        </div>
        <span style={{
          fontSize: DType.exceptionPill.fontSize,
          fontWeight: DType.exceptionPill.fontWeight,
          color: isUrgent ? DT.amber : DT.textTertiary,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}>
          {dueLabel}
        </span>
      </div>

      {/* Expanded: fact panel + actions */}
      {expanded && (
        <div style={{ marginTop: DSpace[5] }}>
          {/* Brief — the pre-composed message shown for context */}
          {brief && (
            <div style={{
              fontSize: DType.rowBody.fontSize,
              fontWeight: DType.rowBody.fontWeight,
              color: DT.textSecondary,
              lineHeight: 1.5,
              marginBottom: DSpace[4],
              whiteSpace: "pre-line" as const,
              maxHeight: 120,
              overflow: "auto",
            }}>
              {brief}
            </div>
          )}
          {facts && facts.length > 0 && (
            <div style={{
              background: DT.factPanelBg,
              borderRadius: DRadius.factPanel,
              padding: `${DSpace[3]}px ${DSpace[4]}px`,
              marginBottom: DSpace[4],
            }}>
              {facts.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 8, padding: "4px 0" }}>
                  <span style={{ width: 74, flexShrink: 0, fontSize: DType.rowMeta.fontSize, fontWeight: DType.rowMeta.fontWeight, color: DT.textTertiary }}>
                    {f.key}
                  </span>
                  <span style={{ fontSize: DType.rowMeta.fontSize, fontWeight: DType.rowMeta.fontWeight, color: DT.textPrimary }}>
                    {f.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          {actions && actions.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} onClick={e => e.stopPropagation()}>
              {actions.slice(0, 3).map(a => (
                <button
                  key={a.id}
                  onClick={a.onClick}
                  style={{
                    padding: "8px 16px",
                    borderRadius: DRadius.button,
                    fontSize: DType.button.fontSize,
                    fontWeight: DType.button.fontWeight,
                    cursor: "pointer",
                    border: a.primary ? "none" : `1px solid ${DT.hairline}`,
                    background: a.primary ? DT.amber : "transparent",
                    color: a.primary ? DT.amberOnColor : DT.textPrimary,
                    minHeight: 44,
                    transition: "background .15s",
                  }}
                  onMouseEnter={e => { if (a.primary) (e.target as HTMLElement).style.background = DT.amberHover; }}
                  onMouseLeave={e => { if (a.primary) (e.target as HTMLElement).style.background = DT.amber; }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
          {children}
        </div>
      )}

      {/* Group expand indicator */}
      {isGroupSummary && !expanded && groupCount && groupCount > 0 && (
        <div style={{ marginTop: 8, fontSize: DType.rowMeta.fontSize, color: DT.textTertiary, display: "flex", alignItems: "center", gap: 4 }}>
          <ChevronDown size={12} /> Show {groupCount} {groupCount === 1 ? "client" : "clients"}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

interface TodaySegmentProps {
  demoMode?: boolean;
}

export function TodaySegment({ demoMode = false }: TodaySegmentProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Data
  const { data: overview, isLoading: overviewLoading, isError: overviewError, refetch: refetchOverview } = trpc.dashboard.getArtistOverview.useQuery(
    undefined,
    { enabled: !demoMode && (user?.role === "artist" || user?.role === "admin") }
  );
  const { tasks: rawTasks, isLoading: tasksLoading, actions: businessActions } = useBusinessTasks();
  const { outstandingGroups } = useClientGroups();

  // State
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showGoneCold, setShowGoneCold] = useState(false);
  const [expandedGroupType, setExpandedGroupType] = useState<string | null>(null);

  // Today's sessions from overview
  const todaySessions = useMemo(() => {
    if (!overview?.todayTimeline) return [];
    return overview.todayTimeline.filter((s: any) => s.status !== "cancelled");
  }, [overview]);

  // Task processing: separate needs-you from gone-cold, apply grouping
  const { needsYouTasks, goneColdTasks, groupedTasks } = useMemo(() => {
    if (!rawTasks || rawTasks.length === 0) {
      return { needsYouTasks: [], goneColdTasks: [], groupedTasks: [] };
    }

    const allTasks = rawTasks.map(t => ({
      ...t,
      _serverTask: t._serverTask,
      _dueAt: t._serverTask?.dueAt ? new Date(t._serverTask.dueAt) : null,
    }));

    // §6.3: Gone Cold = follow-ups with no response for >14 days
    const coldCutoff = new Date(Date.now() - 14 * 86400000);
    const cold: typeof allTasks = [];
    const active: typeof allTasks = [];

    for (const task of allTasks) {
      const st = task._serverTask;
      if (
        st &&
        (st.taskType === "lead_follow_up" || st.taskType === "stale_conversation") &&
        st.dueAt &&
        new Date(st.dueAt) < coldCutoff
      ) {
        cold.push(task);
      } else {
        active.push(task);
      }
    }

    // Sort active by deadline ascending (§6.3)
    active.sort((a, b) => {
      const da = a._dueAt?.getTime() ?? Infinity;
      const db = b._dueAt?.getTime() ?? Infinity;
      return da - db;
    });

    // §6.3 Scale rules: group 3+ tasks of same type into summary rows
    const typeCounts = new Map<string, typeof active>();
    for (const task of active) {
      const type = task._serverTask?.taskType || "unknown";
      if (!typeCounts.has(type)) typeCounts.set(type, []);
      typeCounts.get(type)!.push(task);
    }

    const grouped: Array<{
      type: "single" | "group";
      task?: typeof active[0];
      groupType?: string;
      groupTitle?: string;
      groupContext?: string;
      groupTasks?: typeof active;
    }> = [];

    const processedTypes = new Set<string>();

    for (const task of active) {
      const type = task._serverTask?.taskType || "unknown";
      if (processedTypes.has(type)) continue;

      const tasksOfType = typeCounts.get(type) || [];

      if (tasksOfType.length >= 3) {
        // Collapse into summary row
        processedTypes.add(type);

        // Sort by amount descending within group
        const sortedGroup = [...tasksOfType].sort((a, b) => {
          // Find corresponding outstanding amounts from outstandingGroups
          const aClient = outstandingGroups.find(g => g.clientId === a._serverTask?.clientId);
          const bClient = outstandingGroups.find(g => g.clientId === b._serverTask?.clientId);
          return (bClient?.outstandingCents || 0) - (aClient?.outstandingCents || 0);
        });

        // Build summary context
        const totalOutstanding = sortedGroup.reduce((sum, t) => {
          const client = outstandingGroups.find(g => g.clientId === t._serverTask?.clientId);
          return sum + (client?.outstandingCents || 0);
        }, 0);

        // Extract a human title from the task type
        const baseTitle = tasksOfType[0]?.title?.replace(/ — .*$/, "") || type.replace(/_/g, " ");

        grouped.push({
          type: "group",
          groupType: type,
          groupTitle: `${baseTitle} — ${tasksOfType.length} clients`,
          groupContext: totalOutstanding > 0
            ? `${formatCents(totalOutstanding)} not collected`
            : `${tasksOfType.length} items`,
          groupTasks: sortedGroup,
        });
      } else {
        processedTypes.add(type);
        for (const t of tasksOfType) {
          grouped.push({ type: "single", task: t });
        }
      }
    }

    return { needsYouTasks: active, goneColdTasks: cold, groupedTasks: grouped };
  }, [rawTasks, outstandingGroups]);

  // Cap at 5 visible + show more
  const MAX_VISIBLE = 5;
  const visibleGrouped = showAllTasks ? groupedTasks : groupedTasks.slice(0, MAX_VISIBLE);
  const hiddenCount = groupedTasks.length - MAX_VISIBLE;

  // Due label helper
  const getDueLabel = (task: any): { label: string; isUrgent: boolean } => {
    const st = task._serverTask;
    if (!st?.dueAt) return { label: "", isUrgent: false };
    const due = new Date(st.dueAt);
    const now = new Date();
    const days = Math.round((due.getTime() - now.getTime()) / 86400000);

    if (days <= 0) return { label: "today", isUrgent: true };
    if (days === 1) return { label: "tomorrow", isUrgent: true };
    if (days < 7) return { label: format(due, "EEE d MMM"), isUrgent: true };
    return { label: format(due, "EEE d MMM"), isUrgent: false };
  };

  // Action builder for expanded task
  const getTaskActions = (task: any) => {
    const st = task._serverTask;
    if (!st) return [];
    const actions: { id: string; label: string; primary?: boolean; onClick: () => void }[] = [];

    // Primary action first (amber)
    if (st.taskType?.includes("invoice") || st.taskType?.includes("deposit")) {
      actions.push({ id: "invoice", label: "Send invoice", primary: true, onClick: () => businessActions.openEmail(st) });
    } else if (st.smsNumber) {
      actions.push({ id: "sms", label: "Send SMS", primary: true, onClick: () => businessActions.openSms(st) });
    } else if (st.emailRecipient) {
      actions.push({ id: "email", label: "Send email", primary: true, onClick: () => businessActions.openEmail(st) });
    } else {
      actions.push({ id: "complete", label: "Complete", primary: true, onClick: () => businessActions.completeTask(st, "manual") });
    }

    // Call button — when phone number exists
    if (st.smsNumber) {
      actions.push({
        id: "call",
        label: "Call",
        onClick: () => {
          const a = document.createElement("a");
          a.href = `tel:${st.smsNumber.replace(/\D/g, "")}`;
          a.target = "_top";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        },
      });
    }

    // Secondary actions (remaining slots, bordered)
    if (st.emailRecipient && actions[0]?.id !== "email" && !actions.find((a: any) => a.id === "email")) {
      actions.push({ id: "email", label: "Email", onClick: () => businessActions.openEmail(st) });
    }
    if (st.deepLink && actions.length < 3) {
      actions.push({ id: "open", label: "Open", onClick: () => setLocation(st.deepLink!) });
    }

    return actions.slice(0, 3); // Never more than 3 buttons (§5)
  };

  // Fact panel for expanded task
  const getTaskFacts = (task: any): { key: string; value: string }[] => {
    const st = task._serverTask;
    if (!st) return [];

    // For invoice tasks, pull from outstandingGroups derivation
    const client = outstandingGroups.find(g => g.clientId === st.clientId);
    if (client) {
      const facts: { key: string; value: string }[] = [];
      if (client.completedSessions.length > 0) {
        const earliest = client.completedSessions[0]?.startTime;
        const latest = client.completedSessions[client.completedSessions.length - 1]?.startTime;
        const eDate = earliest ? format(new Date(ensureUTC(earliest)), "MMM d") : "";
        const lDate = latest ? format(new Date(ensureUTC(latest)), "MMM d") : "";
        facts.push({
          key: "Delivered",
          value: `${plural(client.completedSessions.length, "session")}, ${eDate === lDate ? eDate : `${eDate}–${lDate}`}`,
        });
      }
      facts.push({ key: "Collected", value: `${formatCents(client.collectedCents)} of ${formatCents(client.totalValueCents)}` });
      facts.push({ key: "Not collected", value: `${formatCents(client.outstandingCents)} on work already done` });
      return facts;
    }

    // Generic facts
    const facts: { key: string; value: string }[] = [];
    if (st.context) facts.push({ key: "Details", value: st.context });
    return facts;
  };

  // Brief: the pre-composed email/SMS body gives the artist context
  const getTaskBrief = (task: any): string | null => {
    const st = task._serverTask;
    if (!st) return null;
    // Prefer email body (more detailed), fall back to SMS body
    return st.emailBody || st.smsBody || null;
  };

  const isLoading = overviewLoading || tasksLoading;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: DSpace[7] }}>
      {/* ── IN THE CHAIR TODAY ── */}
      <div>
        <SectionHeader label="IN THE CHAIR TODAY" />
        {isLoading ? (
          <div style={{
            background: DT.cardSurface,
            borderRadius: DRadius.row,
            height: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <div className="animate-spin" style={{
              width: 20, height: 20, border: "2px solid rgba(255,255,255,.15)",
              borderTopColor: DT.textPrimary, borderRadius: "50%",
            }} />
          </div>
        ) : overviewError ? (
          <div style={{
            background: DT.cardSurface,
            borderRadius: DRadius.row,
            border: `1px solid ${DT.hairline}`,
            padding: DSpace[7],
            textAlign: "center",
          }}>
            <div style={{ color: DT.destructiveText, fontSize: DType.rowBody.fontSize, marginBottom: DSpace[3] }}>
              Couldn't load today's sessions
            </div>
            <button
              onClick={() => refetchOverview()}
              style={{
                background: DT.amber,
                color: DT.amberOnColor,
                border: "none",
                borderRadius: DRadius.button,
                padding: "8px 20px",
                fontSize: DType.button.fontSize,
                fontWeight: DType.button.fontWeight,
                cursor: "pointer",
                minHeight: 44,
              }}
            >
              Retry
            </button>
          </div>
        ) : todaySessions.length === 0 ? (
          <div style={{
            border: `1px dashed ${DT.hairline}`,
            borderRadius: DRadius.row,
            padding: DSpace[7],
            textAlign: "center",
            color: DT.textSecondary,
            fontSize: DType.rowBody.fontSize,
          }}>
            Nothing booked today
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: DSpace[1] }}>
            {todaySessions.map((session: any) => (
              <TodaySessionRow key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>

      {/* ── NEEDS YOU ── */}
      <div>
        <SectionHeader
          label="NEEDS YOU"
          right={needsYouTasks.length > 0 ? `${needsYouTasks.length} ${needsYouTasks.length === 1 ? "thing" : "things"}` : undefined}
        />
        {isLoading ? (
          <div style={{
            background: DT.cardSurface, borderRadius: DRadius.row, height: 60,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div className="animate-spin" style={{
              width: 20, height: 20, border: "2px solid rgba(255,255,255,.15)",
              borderTopColor: DT.textPrimary, borderRadius: "50%",
            }} />
          </div>
        ) : needsYouTasks.length === 0 ? (
          <div style={{
            background: DT.cardSurface,
            borderRadius: DRadius.row,
            border: `1px solid ${DT.hairline}`,
            padding: DSpace[7],
            textAlign: "center",
          }}>
            <div style={{ color: DT.textPrimary, fontSize: DType.rowTitle.fontSize, fontWeight: DType.rowTitle.fontWeight }}>
              All clear
            </div>
            <div style={{ color: DT.textSecondary, fontSize: DType.rowBody.fontSize, marginTop: 4 }}>
              Nothing needs your attention right now
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: DSpace[1] }}>
            {visibleGrouped.map((item, idx) => {
              if (item.type === "group") {
                const isExpanded = expandedGroupType === item.groupType;
                return (
                  <div key={`group-${item.groupType}`}>
                    <TaskRow
                      title={item.groupTitle || ""}
                      context={item.groupContext || ""}
                      dueLabel=""
                      isGroupSummary
                      groupCount={item.groupTasks?.length}
                      expanded={isExpanded}
                      onToggle={() => setExpandedGroupType(isExpanded ? null : item.groupType!)}
                    >
                      {isExpanded && item.groupTasks && (
                        <div style={{ display: "flex", flexDirection: "column", gap: DSpace[1], marginTop: DSpace[3] }}>
                          {item.groupTasks.map(t => {
                            const due = getDueLabel(t);
                            const isTaskExpanded = expandedTaskId === t.id;
                            return (
                              <TaskRow
                                key={t.id}
                                title={t.title}
                                context={t.context || ""}
                                dueLabel={due.label}
                                isUrgent={due.isUrgent}
                                expanded={isTaskExpanded}
                                onToggle={() => setExpandedTaskId(isTaskExpanded ? null : t.id)}
                                brief={isTaskExpanded ? getTaskBrief(t) : undefined}
                                facts={isTaskExpanded ? getTaskFacts(t) : undefined}
                                actions={isTaskExpanded ? getTaskActions(t) : undefined}
                              />
                            );
                          })}
                        </div>
                      )}
                    </TaskRow>
                  </div>
                );
              }

              // Single task
              const task = item.task!;
              const due = getDueLabel(task);
              const isExpanded = expandedTaskId === task.id;
              return (
                <TaskRow
                  key={task.id}
                  title={task.title}
                  context={task.context || ""}
                  dueLabel={due.label}
                  isUrgent={due.isUrgent}
                  expanded={isExpanded}
                  onToggle={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  brief={isExpanded ? getTaskBrief(task) : undefined}
                  facts={isExpanded ? getTaskFacts(task) : undefined}
                  actions={isExpanded ? getTaskActions(task) : undefined}
                />
              );
            })}

            {/* Show N more */}
            {!showAllTasks && hiddenCount > 0 && (
              <button
                onClick={() => setShowAllTasks(true)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: DT.textTertiary,
                  fontSize: DType.rowBody.fontSize,
                  fontWeight: 500,
                  cursor: "pointer",
                  padding: "8px 0",
                  textAlign: "center",
                  minHeight: 44,
                }}
              >
                Show {hiddenCount} more
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── GONE COLD ── */}
      {goneColdTasks.length > 0 && (
        <div>
          <button
            onClick={() => setShowGoneCold(!showGoneCold)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
              marginBottom: showGoneCold ? DSpace[2] : 0,
              minHeight: 44,
            }}
          >
            <span style={{
              fontSize: DType.sectionLabel.fontSize,
              fontWeight: DType.sectionLabel.fontWeight,
              letterSpacing: DType.sectionLabel.letterSpacing,
              color: DT.textTertiary,
              textTransform: "uppercase",
            }}>
              GONE COLD
            </span>
            <span style={{ fontSize: DType.sectionCount.fontSize, color: DT.textTertiary, display: "flex", alignItems: "center", gap: 4 }}>
              {showGoneCold ? "Hide" : `Show ${goneColdTasks.length}`}
              {showGoneCold ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          {showGoneCold && (
            <div style={{ display: "flex", flexDirection: "column", gap: DSpace[1] }}>
              {goneColdTasks.map(task => {
                const isExpanded = expandedTaskId === task.id;
                return (
                  <TaskRow
                    key={task.id}
                    title={task.title}
                    context={task.context || ""}
                    dueLabel=""
                    expanded={isExpanded}
                    onToggle={() => setExpandedTaskId(isExpanded ? null : task.id)}
                    brief={isExpanded ? getTaskBrief(task) : undefined}
                    actions={isExpanded ? [
                      { id: "archive", label: "Archive", primary: false, onClick: () => businessActions.completeTask(task._serverTask!, "manual") },
                    ] : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
