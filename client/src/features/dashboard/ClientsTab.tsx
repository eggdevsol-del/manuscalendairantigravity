import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Phone,
  Mail,
  Calendar,
  FileText,
  Loader2,
  Users,
  Package,
  MoreHorizontal,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTooltipTarget } from "@/components/tooltip-tour";
import { DEMO_CLIENTS, DEMO_REMINDERS } from "./dashboardDemoData";
import { format, isPast, isFuture } from "date-fns";
import { tokens, statusColor, typography } from "@/ui/tokens";
import { formatMoney, formatCents } from "@/lib/formatMoney";
import { utcToLocal } from "@shared/utils/timezone";

// ── Design tokens (from README spec lines 236-265) ────────
// Using the prototype's exact values. Where an existing SSOT token
// matches, we reference it; where the prototype specifies a precise
// hex that the token system doesn't cover, we inline it.

const DT = {
  // Surfaces
  card: "#131314",
  row: "#1a1a1b",
  rowHover: "#212123",
  completedRow: "rgba(255,255,255,.02)",
  sheet: "#1c1c1e",
  menu: "#232325",
  avatarFallback: "#2a2a2c",
  // Borders
  hairline: "rgba(255,255,255,.07)",
  rowBorder: "rgba(255,255,255,.05)",
  rowBorderExpanded: "rgba(255,255,255,.12)",
  // Text
  textPrimary: "#f5f5f4",
  textSecondary: "rgba(255,255,255,.44)",
  textTertiary: "rgba(255,255,255,.34)",
  textQuaternary: "rgba(255,255,255,.32)",
  textMoney: "rgba(255,255,255,.7)",
  // Semantic
  green: "#4ade80",
  amber: "#f2ca5c",
  amberHover: "#f6d472",
  amberOnColor: "#1a1a12",
  amberBorder: "rgba(242,202,92,.4)",
  // Sheet selection
  sheetSelected: "rgba(242,202,92,.13)",
  sheetSelectedBorder: "rgba(242,202,92,.5)",
  sheetUnselected: "rgba(255,255,255,.03)",
  sheetUnselectedBorder: "rgba(255,255,255,.07)",
  // Toast
  toastBg: "#1f3a2a",
  toastBorder: "rgba(74,222,128,.3)",
  toastText: "#c8f5da",
  // Track
  track: "rgba(255,255,255,.09)",
  // Scrim
  scrim: "rgba(0,0,0,.6)",
} as const;

interface ClientsTabProps {
  demoMode?: boolean;
}

// ── Types ─────────────────────────────────────────────────

interface SessionData {
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

interface GroupedProject {
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

type ClientStatus = "active" | "past_client" | "lead" | "imported";

// ── Helpers ───────────────────────────────────────────────

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

/** Format date in the session's stored timezone (studio tz), not the device's.
 *  Falls back to UTC if no timezone. Returns "Time TBC" for midnight UTC
 *  (which means no real time was set — BUG-2 fix). */
function formatSessionDate(startTime: string, tz: string | null): { date: string; time: string } {
  const timezone = tz || "UTC";
  const localDate = utcToLocal(startTime, timezone);

  // Check if this is a midnight-UTC placeholder (no real time set)
  const utcDate = new Date(startTime);
  const isTimePlaceholder =
    utcDate.getUTCHours() === 0 && utcDate.getUTCMinutes() === 0 && !tz;

  const datePart = format(localDate, "MMM d");
  const dayOfWeek = format(localDate, "EEE");
  const timePart = isTimePlaceholder ? "Time TBC" : format(localDate, "h:mm a");

  return { date: datePart, time: `${dayOfWeek} · ${timePart}` };
}

/** Relative time label — "today", "in 5 days", "in 4 weeks", "in 3 months" */
function relativeLabel(startTime: string): string {
  const now = new Date();
  const d = new Date(startTime);
  const days = Math.round((d.getTime() - now.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 14) return `in ${days} days`;
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  return `in ${Math.round(days / 30)} months`;
}

/** Exception flag for a session. Precedence: no deposit → unconfirmed → overdue → null.
 *  A confirmed-and-deposited session shows NOTHING — silence means healthy. */
function getExceptionFlag(session: SessionData): string | null {
  if (session.paidCents === 0) return "no deposit";
  if (session.status === "pending") return "unconfirmed";
  if (isPast(new Date(session.startTime)) && session.remainingCents > 0) return "overdue";
  return null;
}

// ── Demo data ─────────────────────────────────────────────

const DEMO_GROUPED: GroupedProject[] = [
  {
    clientId: "demo-1",
    clientName: "Sarah Chen",
    clientAvatar: null,
    clientEmail: "sarah@example.com",
    clientPhone: "0412 345 678",
    clientCity: "Sydney",
    serviceName: "Full Sleeve",
    priceEach: 450,
    project: null,
    sessions: [
      { id: 9001, title: "Sleeve 1", serviceName: "Full Sleeve", startTime: new Date(Date.now() - 14 * 86400000).toISOString(), endTime: "", timeZone: "Australia/Brisbane", status: "completed", price: 450, priceCents: 45000, paidCents: 45000, remainingCents: 0, depositAmount: null, depositPaid: null, paymentStatus: "fully_paid" },
      { id: 9002, title: "Sleeve 2", serviceName: "Full Sleeve", startTime: new Date(Date.now() + 3 * 86400000).toISOString(), endTime: "", timeZone: "Australia/Brisbane", status: "confirmed", price: 450, priceCents: 45000, paidCents: 11200, remainingCents: 33800, depositAmount: null, depositPaid: null, paymentStatus: "deposit_paid" },
      { id: 9003, title: "Sleeve 3", serviceName: "Full Sleeve", startTime: new Date(Date.now() + 17 * 86400000).toISOString(), endTime: "", timeZone: "Australia/Brisbane", status: "pending", price: 450, priceCents: 45000, paidCents: 0, remainingCents: 45000, depositAmount: null, depositPaid: null, paymentStatus: null },
    ],
    totalValueCents: 135000, collectedCents: 56200, outstandingCents: 78800, paidPct: 42,
    upcomingSessions: [], completedSessions: [],
  },
];
DEMO_GROUPED[0].upcomingSessions = DEMO_GROUPED[0].sessions.filter(s => isFuture(new Date(s.startTime)));
DEMO_GROUPED[0].completedSessions = DEMO_GROUPED[0].sessions.filter(s => s.status === "completed" || isPast(new Date(s.startTime)));

// ══════════════════════════════════════════════════════════
//  MAIN: ClientsTab
// ══════════════════════════════════════════════════════════

export function ClientsTab({ demoMode = false }: ClientsTabProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const demoClientsAreaRef = useTooltipTarget("demo-clients-area");
  const demoClientCardRef = useTooltipTarget("demo-client-card");
  const demoRemindersAreaRef = useTooltipTarget("demo-reminders-area");

  const {
    data: allSessions,
    isLoading: sessionsLoading,
    isError: sessionsError,
    refetch: refetchSessions,
  } = trpc.dashboard.getClientSessions.useQuery(undefined, { enabled: !demoMode });

  const { data: clients, isLoading: clientsLoading } = trpc.conversations.getClients.useQuery(
    undefined, { enabled: !demoMode }
  );

  // ── Group sessions by client, derive money ──────────────
  const groupedProjects: GroupedProject[] = useMemo(() => {
    if (demoMode) return DEMO_GROUPED;
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

      // Partition on timestamp, not status field (README line 229)
      const upcoming = group.sessions.filter(s =>
        isFuture(new Date(s.startTime)) && s.status !== "cancelled"
      );
      const completed = group.sessions.filter(s =>
        (isPast(new Date(s.startTime)) || s.status === "completed") && s.status !== "cancelled"
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
    }).filter(g => g.sessions.length > 0);
  }, [demoMode, allSessions]);

  // ── Client list ─────────────────────────────────────────
  const displayClients = useMemo(() => {
    if (demoMode) return DEMO_CLIENTS;
    return (clients || []).map((c: any) => {
      let status: ClientStatus;
      if (c.hasUpcoming) status = "active";
      else if (c.sittings > 0) status = "past_client";
      else if (c.hasLead) status = "lead";
      else status = "imported";
      return {
        id: c.id, name: titleCase(c.name || "Unknown"), email: c.email || "",
        phone: c.phone || "", avatar: c.avatar || null,
        city: c.city ? `${c.city}${c.country ? `, ${c.country}` : ""}` : "",
        tlv: c.tlv || 0, sittings: c.sittings || 0, status,
      };
    });
  }, [demoMode, clients]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return displayClients;
    const q = searchQuery.toLowerCase();
    return displayClients.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)
    );
  }, [displayClients, searchQuery]);

  const selectedClient = selectedClientId ? displayClients.find((c) => c.id === selectedClientId) : null;
  if (selectedClient && !demoMode) {
    return <ClientProfile client={selectedClient} onBack={() => setSelectedClientId(null)} />;
  }

  const isLoading = !demoMode && (sessionsLoading || clientsLoading);

  // ── Loading skeleton ────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6 pb-40 animate-pulse">
        <div className="relative px-1"><div className="h-[44px] rounded-[12px] bg-[rgba(255,255,255,.05)]" /></div>
        <div className="px-1"><div className="h-5 w-20 rounded bg-[rgba(255,255,255,.06)] mb-4" /></div>
        <div style={{ borderRadius: 18, background: DT.card, border: `1px solid ${DT.hairline}`, overflow: "hidden" }}>
          <div className="p-5 pb-[18px]" style={{ borderBottom: `1px solid ${DT.hairline}` }}>
            <div className="flex items-center gap-3.5">
              <div className="w-[46px] h-[46px] rounded-[12px] bg-[rgba(255,255,255,.06)]" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-[rgba(255,255,255,.07)]" />
                <div className="h-3 w-48 rounded bg-[rgba(255,255,255,.04)]" />
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <div className="h-3 w-20 rounded bg-[rgba(255,255,255,.04)]" />
              <div className="h-8 w-28 rounded bg-[rgba(255,255,255,.06)]" />
            </div>
            <div className="mt-3 h-[5px] rounded-full bg-[rgba(255,255,255,.05)]" />
          </div>
          <div className="px-5 pt-4 pb-0 space-y-[7px]">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-[62px] rounded-[13px] bg-[rgba(255,255,255,.03)]" />
            ))}
          </div>
          <div className="p-5 flex gap-2.5">
            <div className="flex-[1.6] h-[46px] rounded-[12px] bg-[rgba(255,255,255,.06)]" />
            <div className="flex-1 h-[46px] rounded-[12px] bg-[rgba(255,255,255,.04)]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-6 animate-in fade-in duration-500 pb-40"
      ref={demoMode ? (demoClientsAreaRef as any) : undefined}
    >
      {/* Search */}
      <div className="relative px-1">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <input
          type="text"
          placeholder="Search clients..."
          value={demoMode ? "" : searchQuery}
          onChange={(e) => !demoMode && setSearchQuery(e.target.value)}
          className={cn(tokens.input.base, tokens.input.search, "w-full border-border")}
          readOnly={demoMode}
        />
      </div>

      {/* ── Project Cards ──────────────────────────── */}
      {groupedProjects.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className={typography.h3}>Projects</h2>
            <span className={cn(tokens.display.badge, tokens.display.badgeSecondary)}>
              {groupedProjects.length} client{groupedProjects.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-3">
            {groupedProjects.map((group, i) => (
              <ProjectCard
                key={group.clientId}
                group={group}
                index={i}
                onViewProfile={(id) => setSelectedClientId(id)}
                demoMode={demoMode}
                demoRef={demoMode && i === 0 ? (demoClientCardRef as any) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Error state ────────────────────────────── */}
      {sessionsError && !demoMode && (
        <div
          style={{ borderRadius: 18, background: DT.card, border: `1px solid ${DT.hairline}` }}
          className="p-6 text-center"
        >
          <AlertCircle className="w-8 h-8 mx-auto mb-3" style={{ color: DT.textTertiary }} />
          <p style={{ color: DT.textSecondary }} className="text-[14px] mb-4">
            Couldn't load sessions. Check your connection and try again.
          </p>
          <button
            onClick={() => refetchSessions()}
            className="text-[14px] font-semibold px-5 py-2.5 rounded-[10px]"
            style={{ background: DT.amber, color: DT.amberOnColor }}
          >
            Retry
          </button>
        </div>
      )}

      {/* No projects + no error */}
      {groupedProjects.length === 0 && !sessionsError && !demoMode && (
        <div className={tokens.display.emptyState}>
          <div className={tokens.display.emptyStateIcon}>
            <Calendar className="w-8 h-8" />
          </div>
          <p className={tokens.display.emptyStateText}>No projects yet. Sessions appear here once clients book.</p>
        </div>
      )}

      {/* ── All Clients ────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className={typography.h3}>
            {demoMode ? "All Clients" : `${filteredClients.length} Client${filteredClients.length !== 1 ? "s" : ""}`}
          </h2>
        </div>
        {filteredClients.length === 0 ? (
          <div className={tokens.display.emptyState}>
            <div className={tokens.display.emptyStateIcon}><Users className="w-8 h-8" /></div>
            <p className={tokens.display.emptyStateText}>Clients appear here once they book or message you.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClients.map((client, i) => {
              const sc = STATUS_CONFIG[client.status];
              return (
                <motion.div key={client.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.03 }}>
                  <button
                    onClick={() => !demoMode && setSelectedClientId(client.id)}
                    className={cn(tokens.card.base, tokens.card.bg, tokens.card.interactive, "w-full text-left p-3.5 flex items-center gap-3")}
                  >
                    {client.avatar ? (
                      <img src={client.avatar} alt={client.name} className={cn(tokens.photography.avatar, "w-10 h-10")} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border-2 border-background shrink-0">
                        {client.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(typography.bodySm, "font-bold truncate")}>{client.name}</span>
                        <span className={cn(tokens.display.badge, sc.tokenClass)}>{sc.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {client.sittings > 0 && <span className={typography.label + " text-muted-foreground"}>{client.sittings} session{client.sittings !== 1 ? "s" : ""}</span>}
                        {client.tlv > 0 && <span className={cn(typography.label, "font-semibold")} style={{ color: DT.green }}>{formatMoney(client.tlv)}</span>}
                        {client.city && <span className={typography.label + " text-muted-foreground"}>{client.city.split(",")[0]}</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Automated Reminders — demo only */}
      {demoMode && (
        <section ref={demoRemindersAreaRef as any}>
          <div className="flex items-center gap-2 mb-4 px-1">
            <h2 className={typography.h3}>Automated Reminders</h2>
            <span className={cn(tokens.display.badge, tokens.display.badgePrimary)}>Auto</span>
          </div>
          <div className={cn(tokens.card.base, "border-border/30 overflow-hidden divide-y divide-border/30")}>
            {DEMO_REMINDERS.map((reminder) => (
              <div key={reminder.id} className="p-4 flex items-start gap-3">
                <span className="text-xl mt-0.5">{reminder.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn(typography.bodySm, "font-semibold")}>{reminder.title}</p>
                  <p className={cn(typography.label, "text-muted-foreground mt-0.5")}>{reminder.description}</p>
                  <p className={cn(typography.label, "text-primary/70 mt-1 font-medium")}>{reminder.timing}</p>
                </div>
                <span className={cn(tokens.display.badge, statusColor.success.full)}>Active</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const STATUS_CONFIG: Record<ClientStatus, { label: string; tokenClass: string }> = {
  active:      { label: "Active",      tokenClass: statusColor.success.full },
  past_client: { label: "Past Client", tokenClass: statusColor.neutral.full },
  lead:        { label: "Lead",        tokenClass: statusColor.info.full },
  imported:    { label: "Imported",    tokenClass: "bg-purple-500/10 text-purple-400 border border-purple-500/20" },
};

// ══════════════════════════════════════════════════════════
//  PROJECT CARD — matches prototype exactly
// ══════════════════════════════════════════════════════════

interface ProjectCardProps {
  group: GroupedProject;
  index: number;
  onViewProfile: (clientId: string) => void;
  demoMode: boolean;
  demoRef?: any;
}

function ProjectCard({ group, index, onViewProfile, demoMode, demoRef }: ProjectCardProps) {
  const [expandedSessionId, setExpandedSessionId] = useState<number | null>(null);
  const [completedOpen, setCompletedOpen] = useState(group.completedSessions.length <= 3);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSessionId, setSheetSessionId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const menuRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();
  const recordPayment = trpc.dashboard.recordManualPayment.useMutation({
    onSuccess: () => {
      utils.dashboard.getClientSessions.invalidate();
    },
  });

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Close menu on Escape
  useEffect(() => {
    if (!menuOpen && !sheetOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMenuOpen(false); setSheetOpen(false); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [menuOpen, sheetOpen]);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const handleRecordPayment = useCallback((sessionId: number, amountCents: number) => {
    recordPayment.mutate({ appointmentId: sessionId, amountCents, paymentMethod: "cash" });
    setSheetOpen(false);
    setSheetSessionId(null);
    setExpandedSessionId(null);
    showToast(`${formatCents(amountCents)} recorded · balance updated`);
  }, [recordPayment, showToast]);

  const isFullyPaid = group.outstandingCents <= 0;
  const isEmptyProject = group.sessions.length === 0;

  // Meta line: "Arm sleeve · 7 sessions · $1,998 each" or fallback
  const metaLine = isEmptyProject
    ? "No sessions booked"
    : group.priceEach
      ? `${group.serviceName} · ${group.sessions.length} sessions · ${formatMoney(group.priceEach)} each`
      : `${group.sessions.length} sessions · ${formatCents(group.totalValueCents)} total`;

  const firstName = group.clientName.split(" ")[0];

  return (
    <motion.div
      ref={demoRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative"
    >
      <div
        style={{
          borderRadius: 18,
          background: DT.card,
          border: `1px solid ${DT.hairline}`,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* ── 1. HEADER ─────────────────────────────── */}
        <div style={{ padding: "20px 20px 18px", borderBottom: `1px solid ${DT.hairline}` }}>
          {/* Identity row */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Avatar — 46×46, rounded-square 12px */}
            {group.clientAvatar ? (
              <img
                src={group.clientAvatar}
                alt={group.clientName}
                style={{ width: 46, height: 46, borderRadius: 12, objectFit: "cover", background: DT.avatarFallback, flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 46, height: 46, borderRadius: 12, background: DT.avatarFallback,
                display: "flex", alignItems: "center", justifyContent: "center",
                font: "600 15px/1 -apple-system, sans-serif", color: "rgba(255,255,255,.6)", flexShrink: 0,
              }}>
                {group.clientName.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                font: "600 18px/1.25 -apple-system, sans-serif",
                letterSpacing: "-.01em", color: DT.textPrimary,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {group.clientName}
              </div>
              <div style={{
                font: "400 13.5px/1.4 -apple-system, sans-serif",
                color: DT.textSecondary, marginTop: 2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {metaLine}
              </div>
            </div>

            {/* Overflow ••• — 34×34 visual, 44×44 touch target */}
            <div
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="More options"
              style={{
                width: 44, height: 44, flexShrink: 0, display: "flex",
                alignItems: "center", justifyContent: "center", cursor: "pointer",
                marginRight: -5, // offset to compensate touch padding vs visual
              }}
            >
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,.5)", fontSize: 15,
                transition: "background .16s",
              }}
                className="hover:bg-[rgba(255,255,255,.07)]"
              >
                •••
              </div>
            </div>
          </div>

          {/* Money block — always visible unless empty project */}
          {!isEmptyProject && (
            <>
              <div style={{ marginTop: 20, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ font: "500 10.5px/1 -apple-system, sans-serif", letterSpacing: ".14em", color: DT.textTertiary }}>
                    {isFullyPaid ? "PAID IN FULL" : "OUTSTANDING"}
                  </div>
                  <div style={{
                    font: "600 30px/1.1 -apple-system, sans-serif",
                    letterSpacing: "-.02em", marginTop: 7,
                    color: isFullyPaid ? DT.green : DT.textPrimary,
                  }}>
                    {isFullyPaid ? formatCents(group.totalValueCents) : formatCents(group.outstandingCents)}
                  </div>
                </div>
                <div style={{ textAlign: "right", font: "400 12.5px/1.6 -apple-system, sans-serif", color: DT.textSecondary }}>
                  <div><span style={{ color: DT.green }}>{formatCents(group.collectedCents)}</span> collected</div>
                  <div>of {formatCents(group.totalValueCents)}</div>
                </div>
              </div>

              {/* Progress bar — 5px, transition .45s */}
              <div style={{ marginTop: 11, height: 5, borderRadius: 99, background: DT.track, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%", borderRadius: 99, background: DT.green,
                    transition: "width .45s cubic-bezier(.2,.7,.3,1)",
                    width: `${group.paidPct}%`,
                  }}
                  role="progressbar"
                  aria-valuenow={group.paidPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${group.paidPct}% paid`}
                />
              </div>
            </>
          )}
        </div>

        {/* ── 2. SESSION LISTS ──────────────────────── */}
        {isEmptyProject ? (
          /* Empty state — no sessions */
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ font: "400 14px/1.5 -apple-system, sans-serif", color: DT.textSecondary, marginBottom: 16 }}>
              No sessions booked yet
            </p>
            <button
              style={{
                background: DT.amber, color: DT.amberOnColor, borderRadius: 12,
                padding: "13px 24px", font: "600 15px/1 -apple-system, sans-serif",
                cursor: "pointer", border: "none",
              }}
            >
              Book first session
            </button>
          </div>
        ) : (
          <div style={{ padding: "16px 20px 0" }}>
            {/* UPCOMING */}
            {group.upcomingSessions.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                  <span style={{ font: "500 10.5px/1 -apple-system, sans-serif", letterSpacing: ".14em", color: DT.textTertiary }}>
                    UPCOMING
                  </span>
                  <span style={{ font: "400 12px/1 -apple-system, sans-serif", color: DT.textTertiary }}>
                    {group.upcomingSessions.length} left
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {group.upcomingSessions.map(session => {
                    const isOpen = expandedSessionId === session.id;
                    const flag = getExceptionFlag(session);
                    const sessionPct = session.priceCents > 0 ? Math.round((session.paidCents / session.priceCents) * 100) : 0;
                    const balance = session.priceCents - session.paidCents;
                    const { date, time } = formatSessionDate(session.startTime, session.timeZone);

                    return (
                      <div key={session.id}>
                        <div
                          onClick={() => !demoMode && setExpandedSessionId(isOpen ? null : session.id)}
                          role="button"
                          aria-expanded={isOpen}
                          style={{
                            borderRadius: 13, cursor: "pointer",
                            background: isOpen ? DT.rowHover : DT.row,
                            border: `1px solid ${isOpen ? DT.rowBorderExpanded : DT.rowBorder}`,
                            transition: "background .16s",
                          }}
                        >
                          {/* Session row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 14px" }}>
                            {/* Date column — 94px fixed */}
                            <div style={{ width: 94, flexShrink: 0 }}>
                              <div style={{ font: "600 14.5px/1.2 -apple-system, sans-serif", color: DT.textPrimary }}>
                                {date}
                              </div>
                              <div style={{
                                font: "400 12px/1.4 -apple-system, sans-serif",
                                color: "rgba(255,255,255,.36)", marginTop: 2, whiteSpace: "nowrap",
                              }}>
                                {time}
                              </div>
                            </div>

                            {/* Middle — money + progress */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                                <span style={{ font: "400 13px/1.3 -apple-system, sans-serif", color: DT.textMoney }}>
                                  {session.paidCents >= session.priceCents
                                    ? "Paid in full"
                                    : `${formatCents(session.paidCents)} of ${formatCents(session.priceCents)}`
                                  }
                                </span>
                                <span style={{ font: "400 11.5px/1.3 -apple-system, sans-serif", color: DT.textQuaternary, whiteSpace: "nowrap" }}>
                                  {relativeLabel(session.startTime)}
                                </span>
                              </div>
                              <div style={{ marginTop: 7, height: 3, borderRadius: 99, background: DT.track, overflow: "hidden" }}>
                                <div style={{
                                  height: "100%", borderRadius: 99, background: DT.green,
                                  transition: "width .4s", width: `${sessionPct}%`,
                                }} />
                              </div>
                            </div>

                            {/* Exception pill — only if not healthy */}
                            {flag && (
                              <span style={{
                                font: "500 11px/1 -apple-system, sans-serif",
                                color: DT.amber, border: `1px solid ${DT.amberBorder}`,
                                borderRadius: 99, padding: "5px 8px", whiteSpace: "nowrap", flexShrink: 0,
                              }}>
                                {flag}
                              </span>
                            )}
                          </div>

                          {/* Expanded action panel */}
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                style={{ overflow: "hidden" }}
                              >
                                <div style={{ padding: "2px 14px 13px", display: "flex", gap: 8 }}>
                                  {balance > 0 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSheetSessionId(session.id);
                                        setSheetOpen(true);
                                        setMenuOpen(false);
                                      }}
                                      style={{
                                        flex: 1, textAlign: "center",
                                        background: DT.amber, color: DT.amberOnColor,
                                        borderRadius: 10, padding: 11, border: "none",
                                        font: "600 13.5px/1 -apple-system, sans-serif", cursor: "pointer",
                                      }}
                                    >
                                      Take {formatCents(balance)}
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      flexShrink: 0, border: "1px solid rgba(255,255,255,.16)",
                                      borderRadius: 10, padding: "11px 14px", background: "none",
                                      font: "400 13.5px/1 -apple-system, sans-serif", color: "rgba(255,255,255,.8)", cursor: "pointer",
                                    }}
                                  >
                                    Reschedule
                                  </button>
                                  <button
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      flexShrink: 0, border: "1px solid rgba(255,255,255,.16)",
                                      borderRadius: 10, padding: "11px 14px", background: "none",
                                      font: "400 13.5px/1 -apple-system, sans-serif", color: "rgba(255,255,255,.8)", cursor: "pointer",
                                    }}
                                  >
                                    Note
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COMPLETED */}
            {group.completedSessions.length > 0 && (
              <div>
                <div
                  onClick={() => setCompletedOpen(!completedOpen)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    margin: "20px 0 11px", cursor: "pointer",
                  }}
                >
                  <span style={{ font: "500 10.5px/1 -apple-system, sans-serif", letterSpacing: ".14em", color: DT.textTertiary }}>
                    COMPLETED
                  </span>
                  <span style={{ font: "400 12px/1 -apple-system, sans-serif", color: DT.textTertiary }}>
                    {completedOpen ? "Hide" : "Show"} {group.completedSessions.length}
                  </span>
                </div>

                <AnimatePresence>
                  {completedOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: "hidden" }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                        {group.completedSessions.map(session => {
                          const { date, time } = formatSessionDate(session.startTime, session.timeZone);
                          return (
                            <div
                              key={session.id}
                              style={{
                                display: "flex", alignItems: "center", gap: 14,
                                padding: "11px 14px", borderRadius: 13, background: DT.completedRow,
                              }}
                            >
                              <div style={{ width: 94, flexShrink: 0, font: "500 13.5px/1.2 -apple-system, sans-serif", color: "rgba(255,255,255,.55)" }}>
                                {date}
                              </div>
                              <div style={{ flex: 1, font: "400 12.5px/1.3 -apple-system, sans-serif", color: DT.textTertiary }}>
                                {time}
                              </div>
                              <span style={{ font: "400 12.5px/1 -apple-system, sans-serif", color: "rgba(255,255,255,.4)" }}>
                                {formatCents(session.paidCents)} paid
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ── 3. ACTION BAR ─────────────────────────── */}
        {!isEmptyProject && (
          <div style={{
            padding: 20, display: "flex", gap: 10,
            position: "sticky", bottom: 0,
            background: `linear-gradient(180deg, rgba(19,19,20,0), ${DT.card} 22%)`,
          }}>
            <button
              onClick={() => {
                if (!isFullyPaid) {
                  setSheetSessionId(null);
                  setSheetOpen(true);
                  setMenuOpen(false);
                }
              }}
              disabled={isFullyPaid}
              style={{
                flex: 1.6, textAlign: "center",
                background: isFullyPaid ? `${DT.amber}66` : DT.amber,
                color: DT.amberOnColor, borderRadius: 12, padding: 15, border: "none",
                font: "600 15.5px/1 -apple-system, sans-serif",
                cursor: isFullyPaid ? "not-allowed" : "pointer",
                opacity: isFullyPaid ? 0.4 : 1,
              }}
            >
              Take payment
            </button>
            <a
              href={`sms:${group.clientPhone}`}
              style={{
                flex: 1, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center",
                border: "1px solid rgba(255,255,255,.18)", borderRadius: 12, padding: 15,
                font: "500 15.5px/1 -apple-system, sans-serif", color: DT.textPrimary,
                textDecoration: "none", cursor: "pointer",
              }}
            >
              Message
            </a>
          </div>
        )}

        {/* ── 4. OVERFLOW MENU ─────────────────────── */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              style={{
                position: "absolute", top: 60, right: 18,
                background: DT.menu, border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 12, padding: 6, minWidth: 170,
                boxShadow: "0 18px 40px rgba(0,0,0,.55)", zIndex: 5,
              }}
            >
              {[
                { label: `Call ${firstName}`, href: `tel:${group.clientPhone}` },
                { label: "View profile", action: () => { setMenuOpen(false); onViewProfile(group.clientId); } },
                { label: "Add session", action: () => setMenuOpen(false) },
              ].map(item => (
                item.href ? (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    style={{
                      display: "block", padding: "10px 12px", borderRadius: 8,
                      font: "400 14px/1 -apple-system, sans-serif", color: DT.textPrimary,
                      textDecoration: "none", cursor: "pointer",
                    }}
                    className="hover:bg-[rgba(255,255,255,.08)]"
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.label}
                    onClick={item.action}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "10px 12px", borderRadius: 8, border: "none", background: "none",
                      font: "400 14px/1 -apple-system, sans-serif", color: DT.textPrimary,
                      cursor: "pointer",
                    }}
                    className="hover:bg-[rgba(255,255,255,.08)]"
                  >
                    {item.label}
                  </button>
                )
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 5. PAYMENT SHEET ─────────────────────── */}
        <AnimatePresence>
          {sheetOpen && (
            <PaymentSheet
              group={group}
              preSelectedSessionId={sheetSessionId}
              onClose={() => { setSheetOpen(false); setSheetSessionId(null); }}
              onConfirm={handleRecordPayment}
              demoMode={demoMode}
            />
          )}
        </AnimatePresence>

        {/* ── 6. TOAST ─────────────────────────────── */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              style={{
                position: "absolute", left: 20, right: 20, bottom: 88,
                background: DT.toastBg, border: `1px solid ${DT.toastBorder}`,
                borderRadius: 12, padding: "13px 15px",
                font: "500 13.5px/1.3 -apple-system, sans-serif", color: DT.toastText,
                zIndex: 10,
              }}
              role="status"
              aria-live="polite"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════
//  PAYMENT SHEET — prototype lines 183-198
// ══════════════════════════════════════════════════════════

interface PaymentSheetProps {
  group: GroupedProject;
  preSelectedSessionId: number | null;
  onClose: () => void;
  onConfirm: (sessionId: number, amountCents: number) => void;
  demoMode: boolean;
}

function PaymentSheet({ group, preSelectedSessionId, onClose, onConfirm, demoMode }: PaymentSheetProps) {
  const [selectedId, setSelectedId] = useState<number | null>(preSelectedSessionId);

  const unsettledSessions = group.upcomingSessions.filter(s => s.paidCents < s.priceCents);
  const selected = unsettledSessions.find(s => s.id === selectedId);
  const selectedBalance = selected ? selected.priceCents - selected.paidCents : 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: "absolute", inset: 0, background: DT.scrim,
        zIndex: 9, display: "flex", alignItems: "flex-end",
      }}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", background: DT.sheet,
          borderTop: "1px solid rgba(255,255,255,.1)",
          borderRadius: "20px 20px 0 0", padding: "22px 20px 20px",
        }}
      >
        <div style={{ font: "600 17px/1.2 -apple-system, sans-serif", color: DT.textPrimary }}>Take payment</div>
        <div style={{ font: "400 13px/1.4 -apple-system, sans-serif", color: DT.textSecondary, marginTop: 4 }}>
          {group.clientName} · {formatCents(group.outstandingCents)} outstanding across {unsettledSessions.length} session{unsettledSessions.length !== 1 ? "s" : ""}
        </div>

        {/* Session picker */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 16 }}>
          {unsettledSessions.map(session => {
            const isSelected = selectedId === session.id;
            const balance = session.priceCents - session.paidCents;
            const pct = session.priceCents > 0 ? Math.round((session.paidCents / session.priceCents) * 100) : 0;
            const { date } = formatSessionDate(session.startTime, session.timeZone);

            return (
              <div
                key={session.id}
                onClick={() => setSelectedId(session.id)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "13px 14px", borderRadius: 12, cursor: "pointer",
                  background: isSelected ? DT.sheetSelected : DT.sheetUnselected,
                  border: `1px solid ${isSelected ? DT.sheetSelectedBorder : DT.sheetUnselectedBorder}`,
                }}
              >
                <span style={{ font: "500 14px/1.2 -apple-system, sans-serif", color: DT.textPrimary }}>
                  {date} · {formatCents(balance)} due
                </span>
                <span style={{ font: "400 13px/1.2 -apple-system, sans-serif", color: DT.textSecondary }}>
                  {pct > 0 ? `${pct}% paid` : "no deposit"}
                </span>
              </div>
            );
          })}
        </div>

        {/* Confirm */}
        <button
          onClick={() => {
            if (selected && !demoMode) onConfirm(selected.id, selectedBalance);
          }}
          disabled={!selected}
          style={{
            marginTop: 16, width: "100%", textAlign: "center",
            background: selected ? DT.amber : `${DT.amber}66`,
            color: DT.amberOnColor, borderRadius: 12, padding: 15, border: "none",
            font: "600 15.5px/1 -apple-system, sans-serif",
            cursor: selected ? "pointer" : "not-allowed",
            opacity: selected ? 1 : 0.4,
          }}
        >
          {selected ? `Charge ${formatCents(selectedBalance)}` : "Select a session"}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════
//  CLIENT PROFILE DRILL-DOWN
// ══════════════════════════════════════════════════════════

interface ClientProfileProps {
  client: {
    id: string; name: string; email: string; phone: string;
    avatar: string | null; city: string; tlv: number; sittings: number;
  };
  onBack: () => void;
}

function ClientProfile({ client, onBack }: ClientProfileProps) {
  const [activeSection, setActiveSection] = useState<"appointments" | "orders" | "notes">("appointments");

  const { data: appointments } = trpc.clientProfile.getHistory.useQuery(
    { clientId: client.id }, { enabled: !!client.id }
  );
  const { data: orders } = trpc.storefront.getOrders.useQuery(undefined, { enabled: !!client.id });
  const { data: notes } = trpc.clientProfile.getClientNotes.useQuery(
    { clientId: client.id }, { enabled: !!client.id }
  );

  const clientOrders = useMemo(() => {
    if (!orders || !client.email) return [];
    return orders.filter((o: any) => o.buyerEmail?.toLowerCase() === client.email.toLowerCase());
  }, [orders, client.email]);

  return (
    <div className="animate-in slide-in-from-right duration-300 pb-40">
      <button
        onClick={onBack}
        className={cn(tokens.button.ghost, "flex items-center gap-2 px-2 py-2 mb-6")}
      >
        <ChevronLeft className="w-4 h-4" />
        <span className={cn(typography.bodySm, "font-semibold")}>Back to clients</span>
      </button>

      <div className="flex items-center gap-4 mb-6">
        {client.avatar ? (
          <img src={client.avatar} alt={client.name} style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", background: DT.avatarFallback }} />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: 12, background: DT.avatarFallback,
            display: "flex", alignItems: "center", justifyContent: "center",
            font: "600 20px/1 -apple-system, sans-serif", color: "rgba(255,255,255,.6)",
          }}>
            {client.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className={cn(typography.h2, "truncate")}>{client.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            {client.sittings > 0 && <span className={cn(typography.label, "text-muted-foreground")}>{client.sittings} session{client.sittings !== 1 ? "s" : ""}</span>}
            {client.tlv > 0 && <span className={cn(typography.label, "font-semibold")} style={{ color: DT.green }}>{formatMoney(client.tlv)} TLV</span>}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        {[
          { icon: MessageCircle, label: "Message", href: "#" },
          { icon: Phone, label: "Call", href: `tel:${client.phone}` },
          { icon: Mail, label: "Email", href: `mailto:${client.email}` },
        ].map(({ icon: Icon, label, href }) => (
          <a key={label} href={href} className={cn(tokens.button.outline, "flex-1 flex flex-col items-center justify-center gap-1.5")}>
            <Icon className="w-5 h-5 text-primary" />
            <span className={cn(typography.label, "text-muted-foreground")}>{label}</span>
          </a>
        ))}
      </div>

      <div className={cn(tokens.calendar.viewToggle.container, "h-[44px] mb-6")}>
        {(["appointments", "orders", "notes"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={cn(
              tokens.calendar.viewToggle.button,
              "flex-1 capitalize",
              activeSection === s ? tokens.calendar.viewToggle.active : tokens.calendar.viewToggle.inactive
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeSection} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          {activeSection === "appointments" && (
            <div className="space-y-3">
              {!appointments || appointments.length === 0 ? (
                <EmptySection icon={Calendar} text="No appointments yet" />
              ) : (
                appointments.map((apt: any) => (
                  <div key={apt.id} className={cn(tokens.card.base, "border-border/30 p-4")}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(typography.bodySm, "font-bold")}>{apt.title || apt.description || "Session"}</span>
                      <span className={cn(tokens.display.badge, apt.status === "completed" ? statusColor.success.full : apt.status === "confirmed" ? statusColor.info.full : statusColor.warning.full)}>
                        {apt.status}
                      </span>
                    </div>
                    <p className={cn(typography.label, "text-muted-foreground")}>{apt.date ? format(new Date(apt.date), "MMM d, yyyy · h:mm a") : "No date"}</p>
                    {apt.price && <p className={cn(typography.label, "font-semibold mt-1")} style={{ color: DT.green }}>{formatMoney(apt.price)}</p>}
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === "orders" && (
            <div className="space-y-3">
              {clientOrders.length === 0 ? (
                <EmptySection icon={Package} text="No orders from this client" />
              ) : (
                clientOrders.map((order: any) => (
                  <div key={order.id} className={cn(tokens.card.base, "border-border/30 p-4")}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(typography.bodySm, "font-bold")}>Order #{order.id}</span>
                      <span className={cn(tokens.display.badge, order.status === "fulfilled" ? statusColor.success.full : statusColor.warning.full)}>
                        {order.status === "fulfilled" ? "Dispatched" : "Pending"}
                      </span>
                    </div>
                    <p className={cn(typography.label, "text-muted-foreground")}>{format(new Date(order.createdAt), "MMM d, yyyy")}</p>
                    <p className={cn(typography.label, "font-semibold mt-1")} style={{ color: DT.green }}>{formatCents(order.totalAmountCents)}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeSection === "notes" && (
            <div className="space-y-3">
              {!notes || notes.length === 0 ? (
                <EmptySection icon={FileText} text="No notes for this client" />
              ) : (
                notes.map((note: any) => (
                  <div key={note.id} className={cn(tokens.card.base, "border-border/30 p-4")}>
                    <p className={cn(typography.body, "whitespace-pre-wrap")}>{note.note}</p>
                    {note.createdAt && <p className={cn(typography.label, "text-muted-foreground mt-2")}>{format(new Date(note.createdAt), "MMM d, yyyy")}</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function EmptySection({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className={tokens.display.emptyState}>
      <div className={tokens.display.emptyStateIcon}><Icon className="w-8 h-8" /></div>
      <p className={tokens.display.emptyStateText}>{text}</p>
    </div>
  );
}
