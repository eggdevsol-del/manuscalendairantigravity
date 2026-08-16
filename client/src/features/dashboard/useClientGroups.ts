/**
 * useClientGroups — Shared Derivation Hook (§7 Derivation Contract)
 *
 * Extracts the client grouping derivation from ClientsTab so both
 * the Today segment (invoice tasks) and Clients tab read from the
 * same single source of truth.
 *
 * Every value is derived at render time from getClientSessions data.
 * Nothing is stored. If this hook and the Clients card disagree about
 * a client's balance, the wiring is wrong.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { isPast, isFuture } from "date-fns";

// ── Helpers ─────────────────────────────────────────────────

/** Ensure a datetime string from the DB is treated as UTC. */
function ensureUTC(raw: string): string {
  if (raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw)) return raw;
  return raw.replace(" ", "T") + "Z";
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

// ── Types ───────────────────────────────────────────────────

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

// ── Hook ────────────────────────────────────────────────────

export function useClientGroups() {
  const {
    data: allSessions,
    isLoading,
    isError,
    refetch,
  } = trpc.dashboard.getClientSessions.useQuery();

  const groupedProjects: GroupedProject[] = useMemo(() => {
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
          totalValueCents: 0,
          collectedCents: 0,
          outstandingCents: 0,
          paidPct: 0,
          upcomingSessions: [],
          completedSessions: [],
          serviceName: "",
          priceEach: null,
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
  }, [allSessions]);

  // Convenience partitions
  const outstandingGroups = useMemo(
    () => groupedProjects.filter(g => g.outstandingCents > 0 && g.completedSessions.length > 0),
    [groupedProjects]
  );

  const activeGroups = useMemo(
    () => groupedProjects.filter(g => g.upcomingSessions.length > 0),
    [groupedProjects]
  );

  return {
    allGroups: groupedProjects,
    activeGroups,
    outstandingGroups,
    isLoading,
    isError,
    refetch,
  };
}
