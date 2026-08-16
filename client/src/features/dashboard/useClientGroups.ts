/**
 * useClientGroups — Shared derivation hook
 *
 * Groups sessions by client and derives per-client:
 * - totalValueCents, collectedCents, outstandingCents, paidPct
 * - upcomingSessions, completedSessions
 * - serviceName, priceEach
 *
 * This is the SSOT for client balance / session data.
 * ClientsTab and HomeTab both consume this derivation.
 *
 * ⚠️ This file was extracted from ClientsTab.tsx — the derivation
 *    logic must stay identical. If you change it here, verify ClientsTab.
 */

import { useMemo } from "react";
import { isFuture, isPast } from "date-fns";
import { trpc } from "@/lib/trpc";

// ── Types ─────────────────────────────────────────────────

export interface SessionData {
  id: number;
  title: string | null;
  serviceName: string | null;
  startTime: string;
  endTime: string;
  timeZone: string | null;
  status: string;
  price: number | null;
  priceCents: number;
  paidCents: number;
  remainingCents: number;
  depositAmount: number | null;
  depositPaid: number | null;
  paymentStatus: string | null;
}

export interface GroupedProject {
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  clientEmail: string;
  clientPhone: string;
  clientCity: string;
  project: any | null;
  sessions: SessionData[];
  // Derived every render — never stored
  totalValueCents: number;
  collectedCents: number;
  outstandingCents: number;
  paidPct: number;
  upcomingSessions: SessionData[];
  completedSessions: SessionData[];
  serviceName: string;
  priceEach: number | null;
}

// ── Helpers ───────────────────────────────────────────────

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

/** Ensure a datetime string from the DB is treated as UTC. */
export function ensureUTC(raw: string): string {
  if (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw)) return raw;
  return raw.replace(" ", "T") + "Z";
}

/** Exception flag for a session. */
export function getExceptionFlag(session: SessionData): string | null {
  if (session.paidCents === 0) return "no deposit";
  if (session.status === "pending") return "unconfirmed";
  if (isPast(new Date(ensureUTC(session.startTime))) && session.remainingCents > 0) return "overdue";
  return null;
}

// ── Hook ──────────────────────────────────────────────────

interface UseClientGroupsOptions {
  /** If true, return demo data instead of fetching */
  demoMode?: boolean;
  /** Demo data to use when demoMode is true */
  demoData?: GroupedProject[];
}

export function useClientGroups({ demoMode = false, demoData }: UseClientGroupsOptions = {}) {
  const {
    data: allSessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
    refetch: refetchSessions,
  } = trpc.dashboard.getClientSessions.useQuery(undefined, { enabled: !demoMode });

  const groupedProjects: GroupedProject[] = useMemo(() => {
    if (demoMode && demoData) return demoData;
    if (!allSessions || allSessions.length === 0) return [];

    const groups = new Map<string, GroupedProject>();

    for (const appt of allSessions) {
      const clientId = appt.client?.id || "unknown";
      if (!groups.has(clientId)) {
        groups.set(clientId, {
          clientId,
          clientName: titleCase(appt.client?.name || "Client"),
          clientAvatar: appt.client?.avatar || null,
          clientEmail: appt.client?.email || "",
          clientPhone: appt.client?.phone || "",
          clientCity: appt.client?.city || "",
          project: appt.project,
          sessions: [],
          totalValueCents: 0, collectedCents: 0, outstandingCents: 0, paidPct: 0,
          upcomingSessions: [], completedSessions: [],
          serviceName: "", priceEach: null,
        });
      }
      groups.get(clientId)!.sessions.push({
        id: appt.id,
        title: appt.title,
        serviceName: appt.serviceName,
        startTime: appt.startTime,
        endTime: appt.endTime,
        timeZone: appt.timeZone || null,
        status: appt.status,
        price: appt.price,
        priceCents: appt.priceCents,
        paidCents: appt.paidCents,
        remainingCents: appt.remainingCents,
        depositAmount: appt.depositAmount,
        depositPaid: appt.depositPaid,
        paymentStatus: appt.paymentStatus,
      });
    }

    // Derive everything at render time — never stored
    return Array.from(groups.values()).map(group => {
      const totalValue = group.sessions.reduce((sum, s) => sum + s.priceCents, 0);
      const collected = group.sessions.reduce((sum, s) => sum + s.paidCents, 0);
      const outstanding = Math.max(0, totalValue - collected);

      const prices = [...new Set(group.sessions.map(s => s.price).filter(Boolean))];
      const priceEach = prices.length === 1 ? prices[0]! : null;
      const serviceName = group.sessions[0]?.serviceName || group.sessions[0]?.title || "Project";

      // Partition on timestamp, not status field
      const upcoming = group.sessions.filter(s =>
        isFuture(new Date(ensureUTC(s.startTime))) && s.status !== "cancelled"
      );
      const completed = group.sessions.filter(s =>
        (isPast(new Date(ensureUTC(s.startTime))) || s.status === "completed") && s.status !== "cancelled"
      );

      return {
        ...group,
        totalValueCents: totalValue,
        collectedCents: collected,
        outstandingCents: outstanding,
        paidPct: totalValue > 0 ? Math.round((collected / totalValue) * 100) : 0,
        upcomingSessions: upcoming,
        completedSessions: completed,
        serviceName,
        priceEach,
      };
    });
  }, [demoMode, demoData, allSessions]);

  // All groups (not filtered to only those with upcoming sessions)
  const allGroups = groupedProjects;

  // Only groups with upcoming sessions (for Clients tab backward compat)
  const activeGroups = useMemo(
    () => groupedProjects.filter(g => g.upcomingSessions.length > 0),
    [groupedProjects]
  );

  // Groups with outstanding balance on completed sessions (for invoice tasks)
  const outstandingGroups = useMemo(
    () => groupedProjects.filter(g => g.outstandingCents > 0 && g.completedSessions.length > 0),
    [groupedProjects]
  );

  return {
    allGroups,
    activeGroups,
    outstandingGroups,
    sessionsLoading,
    sessionsError,
    refetchSessions,
    rawSessions: allSessions,
  };
}
