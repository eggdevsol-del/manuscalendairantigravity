import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import {
  Search,
  ChevronLeft,
  ChevronDown,
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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTooltipTarget } from "@/components/tooltip-tour";
import { DEMO_CLIENTS, DEMO_REMINDERS } from "./dashboardDemoData";
import { format, formatDistanceToNowStrict, isPast, isFuture } from "date-fns";
import { tokens, statusColor, typography } from "@/ui/tokens";
import { formatMoney, formatCents } from "@/lib/formatMoney";

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
  // Derived — computed per render
  totalValueCents: number;
  collectedCents: number;
  outstandingCents: number;
  paidPct: number;
  upcomingSessions: SessionData[];
  completedSessions: SessionData[];
  serviceName: string;
  priceEach: number | null; // null if mixed prices
}

type ClientStatus = "active" | "past_client" | "lead" | "imported";

// ── Title case helper ─────────────────────────────────────

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

// ── Relative time label ───────────────────────────────────

function relativeLabel(dateStr: string): string {
  const d = new Date(dateStr);
  if (isPast(d)) return "today";
  try {
    return "in " + formatDistanceToNowStrict(d, { addSuffix: false });
  } catch {
    return "";
  }
}

// ── Exception flag for a session ──────────────────────────
// "no deposit" → "unconfirmed" → "overdue" → null (healthy)

function getExceptionFlag(session: SessionData): string | null {
  if (session.paidCents === 0) return "no deposit";
  if (session.status === "pending") return "unconfirmed";
  if (isPast(new Date(session.startTime)) && session.remainingCents > 0) return "overdue";
  return null;
}

// ── Demo data ─────────────────────────────────────────────

const DEMO_GROUPED: GroupedProject[] = [
  {
    clientId: "demo-client-1",
    clientName: "Sarah Chen",
    clientAvatar: null,
    clientEmail: "sarah@example.com",
    clientPhone: "0412 345 678",
    clientCity: "Sydney",
    serviceName: "Full Sleeve",
    priceEach: 450,
    project: {
      projectDescription: "Koi fish and waves flowing into existing shoulder piece.",
      stylePreferences: JSON.stringify(["Japanese Traditional", "Neo-Traditional"]),
      placement: "Full left arm",
      estimatedSize: "extra-large",
    },
    sessions: [
      { id: 9001, title: "Sleeve Session 1", serviceName: "Full Sleeve", startTime: new Date(Date.now() - 14 * 86400000).toISOString(), endTime: new Date(Date.now() - 14 * 86400000 + 4 * 3600000).toISOString(), timeZone: null, status: "completed", price: 450, priceCents: 45000, paidCents: 45000, remainingCents: 0, depositAmount: 112, depositPaid: 1, paymentStatus: "fully_paid" },
      { id: 9002, title: "Sleeve Session 2", serviceName: "Full Sleeve", startTime: new Date(Date.now() + 3 * 86400000).toISOString(), endTime: new Date(Date.now() + 3 * 86400000 + 4 * 3600000).toISOString(), timeZone: null, status: "confirmed", price: 450, priceCents: 45000, paidCents: 11200, remainingCents: 33800, depositAmount: 112, depositPaid: 1, paymentStatus: "deposit_paid" },
      { id: 9003, title: "Sleeve Session 3", serviceName: "Full Sleeve", startTime: new Date(Date.now() + 17 * 86400000).toISOString(), endTime: new Date(Date.now() + 17 * 86400000 + 4 * 3600000).toISOString(), timeZone: null, status: "pending", price: 450, priceCents: 45000, paidCents: 0, remainingCents: 45000, depositAmount: null, depositPaid: null, paymentStatus: null },
    ],
    totalValueCents: 135000,
    collectedCents: 56200,
    outstandingCents: 78800,
    paidPct: 42,
    upcomingSessions: [],
    completedSessions: [],
  },
];

// Fix demo data partitions
DEMO_GROUPED[0].upcomingSessions = DEMO_GROUPED[0].sessions.filter(s => isFuture(new Date(s.startTime)));
DEMO_GROUPED[0].completedSessions = DEMO_GROUPED[0].sessions.filter(s => s.status === "completed" || isPast(new Date(s.startTime)));

// ── Main Component ────────────────────────────────────────

export function ClientsTab({ demoMode = false }: ClientsTabProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const demoClientsAreaRef = useTooltipTarget("demo-clients-area");
  const demoClientCardRef = useTooltipTarget("demo-client-card");
  const demoRemindersAreaRef = useTooltipTarget("demo-reminders-area");

  const { data: allSessions, isLoading: sessionsLoading } = trpc.dashboard.getClientSessions.useQuery(
    undefined, { enabled: !demoMode }
  );
  const { data: clients, isLoading: clientsLoading } = trpc.conversations.getClients.useQuery(
    undefined, { enabled: !demoMode }
  );

  // ── Group sessions by client, derive money ──────────────
  const groupedProjects: GroupedProject[] = useMemo(() => {
    if (demoMode) return DEMO_GROUPED;
    if (!allSessions || allSessions.length === 0) return [];

    const groups = new Map<string, GroupedProject>();
    const now = new Date();

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

    // Compute derived values
    return Array.from(groups.values()).map(group => {
      const totalValue = group.sessions.reduce((sum, s) => sum + s.priceCents, 0);
      const collected = group.sessions.reduce((sum, s) => sum + s.paidCents, 0);
      const outstanding = Math.max(0, totalValue - collected);

      // Check if all sessions have the same price
      const prices = [...new Set(group.sessions.map(s => s.price).filter(Boolean))];
      const priceEach = prices.length === 1 ? prices[0]! : null;

      // Service name from first session
      const serviceName = group.sessions[0]?.serviceName || group.sessions[0]?.title || "Project";

      // Partition by time
      const upcoming = group.sessions.filter(s =>
        isFuture(new Date(s.startTime)) && !["completed", "no-show"].includes(s.status)
      );
      const completed = group.sessions.filter(s =>
        s.status === "completed" || (isPast(new Date(s.startTime)) && s.status !== "cancelled")
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
    }).filter(g => g.upcomingSessions.length > 0 || g.completedSessions.length > 0);
  }, [demoMode, allSessions]);

  // ── Client list with proper statuses ────────────────────
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

  if (isLoading) {
    return (
      <div className={tokens.loading.base + " py-20"}>
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="space-y-6 animate-in fade-in duration-500 pb-40"
      ref={demoMode ? (demoClientsAreaRef as any) : undefined}
    >
      {/* Search — SSOT input.search */}
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

      {/* ── Project Cards (grouped by client) ──────── */}
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
                isExpanded={expandedClientId === group.clientId}
                onToggle={() => !demoMode && setExpandedClientId(expandedClientId === group.clientId ? null : group.clientId)}
                onViewProfile={(id) => setSelectedClientId(id)}
                demoMode={demoMode}
                demoRef={demoMode && i === 0 ? (demoClientCardRef as any) : undefined}
              />
            ))}
          </div>
        </section>
      )}

      {/* No Projects */}
      {groupedProjects.length === 0 && !demoMode && (
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
            <div className={tokens.display.emptyStateIcon}>
              <Users className="w-8 h-8" />
            </div>
            <p className={tokens.display.emptyStateText}>Clients appear here once they book or message you.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClients.map((client, i) => {
              const sc = STATUS_CONFIG[client.status];
              return (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.03 }}
                >
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
                        {client.tlv > 0 && <span className={cn(typography.label, "text-[#4ade80] font-semibold")}>{formatMoney(client.tlv)}</span>}
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

      {/* Automated Reminders — demo tour only */}
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

// ── Status config ─────────────────────────────────────────

const STATUS_CONFIG: Record<ClientStatus, { label: string; tokenClass: string }> = {
  active:      { label: "Active",      tokenClass: statusColor.success.full },
  past_client: { label: "Past Client", tokenClass: statusColor.neutral.full },
  lead:        { label: "Lead",        tokenClass: statusColor.info.full },
  imported:    { label: "Imported",    tokenClass: "bg-purple-500/10 text-purple-400 border border-purple-500/20" },
};

// ═══════════════════════════════════════════════════════════
//  PROJECT CARD — the redesigned session breakdown
// ═══════════════════════════════════════════════════════════

interface ProjectCardProps {
  group: GroupedProject;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onViewProfile: (clientId: string) => void;
  demoMode: boolean;
  demoRef?: any;
}

function ProjectCard({ group, index, isExpanded, onToggle, onViewProfile, demoMode, demoRef }: ProjectCardProps) {
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
    onSuccess: (result) => {
      utils.dashboard.getClientSessions.invalidate();
      showToast(`${formatCents(result.newPaidCents - (result.newPaidCents - result.remainingCents))} recorded · balance updated`);
    },
  });

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  // Clean up toast timer
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const handleRecordPayment = useCallback((sessionId: number, amountCents: number) => {
    recordPayment.mutate({
      appointmentId: sessionId,
      amountCents,
      paymentMethod: "cash",
    });
    setSheetOpen(false);
    setSheetSessionId(null);
    setExpandedSessionId(null);
    showToast(`${formatCents(amountCents)} recorded · balance updated`);
  }, [recordPayment, showToast]);

  const isFullyPaid = group.outstandingCents <= 0;

  // Meta line: "Arm sleeve · 7 sessions · $1,998 each"
  const metaLine = group.priceEach
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
      <div className={cn(
        "rounded-[18px] border overflow-hidden transition-all",
        "bg-card border-border/30",
      )}>
        {/* ── 1. HEADER BLOCK ─────────────────────── */}
        <button
          onClick={onToggle}
          className="w-full text-left p-5 pb-4 border-b border-border/30"
        >
          {/* Identity row */}
          <div className="flex items-center gap-3.5">
            {/* Avatar — rounded-square for work imagery per design */}
            <div className="shrink-0">
              {group.clientAvatar ? (
                <img
                  src={group.clientAvatar}
                  alt={group.clientName}
                  className="w-[46px] h-[46px] rounded-[12px] object-cover bg-secondary"
                />
              ) : (
                <div className="w-[46px] h-[46px] rounded-[12px] bg-secondary flex items-center justify-center text-[15px] font-semibold text-muted-foreground">
                  {group.clientName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[18px] font-semibold leading-[1.25] tracking-[-0.01em] text-foreground truncate">
                {group.clientName}
              </p>
              <p className="text-[13.5px] font-normal leading-[1.4] text-muted-foreground mt-0.5 truncate">
                {metaLine}
              </p>
            </div>

            {/* Overflow button — min 44px touch */}
            <div
              className="w-[34px] h-[34px] flex items-center justify-center rounded-[9px] shrink-0 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              aria-label="More options"
            >
              <MoreHorizontal className="w-[18px] h-[18px]" />
            </div>
          </div>

          {/* Money block */}
          {isExpanded && (
            <div className="mt-5 flex items-end justify-between gap-3">
              <div>
                <p className="text-[10.5px] font-medium tracking-[0.14em] uppercase text-muted-foreground/60">
                  {isFullyPaid ? "PAID IN FULL" : "OUTSTANDING"}
                </p>
                <p className={cn(
                  "text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] mt-1.5",
                  isFullyPaid ? "text-[#4ade80]" : "text-foreground"
                )}>
                  {isFullyPaid
                    ? formatCents(group.totalValueCents)
                    : formatCents(group.outstandingCents)
                  }
                </p>
              </div>
              <div className="text-right text-[12.5px] leading-[1.6] text-muted-foreground">
                <p><span className="text-[#4ade80]">{formatCents(group.collectedCents)}</span> collected</p>
                <p>of {formatCents(group.totalValueCents)}</p>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {isExpanded && (
            <div className={cn(tokens.display.progressTrack, tokens.display.progressTrackLg, "mt-3")}>
              <div
                className={tokens.display.progressFill}
                style={{ width: `${group.paidPct}%` }}
                role="progressbar"
                aria-valuenow={group.paidPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${group.paidPct}% paid`}
              />
            </div>
          )}

          {/* Collapsed summary */}
          {!isExpanded && (
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span className={cn(typography.label, "text-muted-foreground")}>
                  {group.upcomingSessions.length > 0
                    ? `${format(new Date(group.upcomingSessions[0].startTime), "MMM d")}${group.upcomingSessions.length > 1 ? ` + ${group.upcomingSessions.length - 1} more` : ""}`
                    : `${group.completedSessions.length} completed`
                  }
                </span>
              </div>
              <div className="flex items-center gap-2">
                {group.outstandingCents > 0 && (
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {formatCents(group.outstandingCents)} due
                  </span>
                )}
                {/* Mini progress */}
                <div className="w-16 h-[3px] rounded-full bg-[rgba(255,255,255,0.09)] overflow-hidden">
                  <div className="h-full rounded-full bg-[#4ade80]" style={{ width: `${group.paidPct}%` }} />
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          )}
        </button>

        {/* ── 2. SESSION LISTS (expanded) ──────────── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 pt-4 pb-0">
                {/* UPCOMING */}
                {group.upcomingSessions.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10.5px] font-medium tracking-[0.14em] uppercase text-muted-foreground/60">
                        UPCOMING
                      </span>
                      <span className="text-[12px] text-muted-foreground/60">
                        {group.upcomingSessions.length} left
                      </span>
                    </div>

                    <div className="flex flex-col gap-[7px]">
                      {group.upcomingSessions.map(session => {
                        const isOpen = expandedSessionId === session.id;
                        const flag = getExceptionFlag(session);
                        const sessionPct = session.priceCents > 0 ? Math.round((session.paidCents / session.priceCents) * 100) : 0;
                        const balance = session.priceCents - session.paidCents;

                        return (
                          <div key={session.id}>
                            <div
                              onClick={() => !demoMode && setExpandedSessionId(isOpen ? null : session.id)}
                              className={cn(
                                "rounded-[13px] cursor-pointer transition-colors duration-[160ms]",
                                isOpen
                                  ? "bg-secondary border border-border/40"
                                  : "bg-secondary/50 border border-border/20 hover:bg-secondary"
                              )}
                            >
                              {/* Session row */}
                              <div className="flex items-center gap-3.5 p-3.5">
                                {/* Date column — fixed 94px */}
                                <div className="w-[94px] shrink-0">
                                  <p className="text-[14.5px] font-semibold leading-[1.2] text-foreground">
                                    {format(new Date(session.startTime), "MMM d")}
                                  </p>
                                  <p className="text-[12px] font-normal leading-[1.4] text-muted-foreground/60 mt-0.5 whitespace-nowrap">
                                    {format(new Date(session.startTime), "EEE · h:mm a")}
                                  </p>
                                </div>

                                {/* Middle — money + progress bar */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-baseline justify-between gap-2">
                                    <span className="text-[13px] font-normal leading-[1.3] text-foreground/70">
                                      {session.paidCents >= session.priceCents
                                        ? "Paid in full"
                                        : `${formatCents(session.paidCents)} of ${formatCents(session.priceCents)}`
                                      }
                                    </span>
                                    <span className="text-[11.5px] font-normal leading-[1.3] text-muted-foreground/50 whitespace-nowrap">
                                      {relativeLabel(session.startTime)}
                                    </span>
                                  </div>
                                  <div className={cn(tokens.display.progressTrack, tokens.display.progressTrackSm, "mt-2")}>
                                    <div
                                      className={tokens.display.progressFill}
                                      style={{ width: `${sessionPct}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Exception pill — only if NOT healthy */}
                                {flag && (
                                  <span className="shrink-0 text-[11px] font-medium text-primary border border-primary/40 rounded-full px-2 py-1 whitespace-nowrap">
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
                                    className="overflow-hidden"
                                  >
                                    <div className="px-3.5 pb-3.5 pt-0.5 flex gap-2">
                                      {balance > 0 && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSheetSessionId(session.id);
                                            setSheetOpen(true);
                                            setMenuOpen(false);
                                          }}
                                          className="flex-1 text-center bg-primary text-primary-foreground rounded-[10px] py-2.5 text-[13.5px] font-semibold hover:bg-primary/90 transition-colors"
                                        >
                                          Take {formatCents(balance)}
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => e.stopPropagation()}
                                        className="border border-border/40 rounded-[10px] px-3.5 py-2.5 text-[13.5px] font-normal text-foreground/80 hover:bg-secondary transition-colors"
                                      >
                                        Reschedule
                                      </button>
                                      <button
                                        onClick={(e) => e.stopPropagation()}
                                        className="border border-border/40 rounded-[10px] px-3.5 py-2.5 text-[13.5px] font-normal text-foreground/80 hover:bg-secondary transition-colors"
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
                  <div className="mt-5">
                    <button
                      onClick={() => setCompletedOpen(!completedOpen)}
                      className="w-full flex items-center justify-between mb-3"
                    >
                      <span className="text-[10.5px] font-medium tracking-[0.14em] uppercase text-muted-foreground/60">
                        COMPLETED
                      </span>
                      <span className="text-[12px] text-muted-foreground/60">
                        {completedOpen ? "Hide" : "Show"} {group.completedSessions.length}
                      </span>
                    </button>

                    <AnimatePresence>
                      {completedOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-col gap-[7px]">
                            {group.completedSessions.map(session => (
                              <div
                                key={session.id}
                                className="flex items-center gap-3.5 px-3.5 py-3 rounded-[13px] bg-[rgba(255,255,255,0.02)]"
                              >
                                <div className="w-[94px] shrink-0 text-[13.5px] font-medium leading-[1.2] text-foreground/55">
                                  {format(new Date(session.startTime), "MMM d")}
                                </div>
                                <div className="flex-1 text-[12.5px] font-normal leading-[1.3] text-muted-foreground/50">
                                  {format(new Date(session.startTime), "EEE · h:mm a")}
                                </div>
                                <span className="text-[12.5px] font-normal text-muted-foreground/60">
                                  {formatCents(session.paidCents)} paid
                                </span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* ── 3. ACTION BAR (sticky) ─────────────── */}
              <div className="p-5 flex gap-2.5 sticky bottom-0 bg-gradient-to-t from-card via-card to-transparent">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isFullyPaid) {
                      setSheetSessionId(null);
                      setSheetOpen(true);
                    }
                  }}
                  disabled={isFullyPaid}
                  className={cn(
                    "flex-[1.6] text-center rounded-[12px] py-[15px] text-[15.5px] font-semibold transition-colors",
                    isFullyPaid
                      ? "bg-primary/40 text-primary-foreground/60 cursor-not-allowed"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  Take payment
                </button>
                <a
                  href={`sms:${group.clientPhone}`}
                  className="flex-1 text-center border border-border/40 rounded-[12px] py-[15px] text-[15.5px] font-medium text-foreground hover:bg-secondary/50 transition-colors"
                >
                  Message
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 4. OVERFLOW MENU ─────────────────────── */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className={cn(tokens.display.overflowMenu, "top-[60px] right-[18px]")}
            >
              <button
                onClick={() => { setMenuOpen(false); }}
                className={tokens.display.overflowItem}
              >
                <a href={`tel:${group.clientPhone}`} className="flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Call {firstName}
                </a>
              </button>
              <button
                onClick={() => { setMenuOpen(false); onViewProfile(group.clientId); }}
                className={tokens.display.overflowItem}
              >
                View profile
              </button>
              <button
                onClick={() => setMenuOpen(false)}
                className={tokens.display.overflowItem}
              >
                Add session
              </button>
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
              className={tokens.display.toast}
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

// ═══════════════════════════════════════════════════════════
//  PAYMENT SHEET
// ═══════════════════════════════════════════════════════════

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

  const firstName = group.clientName.split(" ")[0];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/60 z-[9] flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-[#1c1c1e] border-t border-border/30 rounded-t-[20px] p-5 pt-[22px]"
      >
        <p className="text-[17px] font-semibold leading-[1.2]">Take payment</p>
        <p className="text-[13px] font-normal leading-[1.4] text-muted-foreground mt-1">
          {firstName} · {formatCents(group.outstandingCents)} outstanding across {unsettledSessions.length} session{unsettledSessions.length !== 1 ? "s" : ""}
        </p>

        {/* Session picker */}
        <div className="flex flex-col gap-[7px] mt-4">
          {unsettledSessions.map(session => {
            const isSelected = selectedId === session.id;
            const balance = session.priceCents - session.paidCents;
            const pct = session.priceCents > 0 ? Math.round((session.paidCents / session.priceCents) * 100) : 0;

            return (
              <button
                key={session.id}
                onClick={() => setSelectedId(session.id)}
                className={cn(
                  "flex items-center justify-between p-3.5 rounded-[12px] text-left transition-colors",
                  isSelected
                    ? "bg-primary/10 border border-primary/50"
                    : "bg-[rgba(255,255,255,0.03)] border border-border/20 hover:bg-[rgba(255,255,255,0.06)]"
                )}
              >
                <span className="text-[14px] font-medium">
                  {format(new Date(session.startTime), "MMM d")} · {formatCents(balance)} due
                </span>
                <span className="text-[13px] font-normal text-muted-foreground">
                  {pct > 0 ? `${pct}% paid` : "no deposit"}
                </span>
              </button>
            );
          })}
        </div>

        {/* Confirm */}
        <button
          onClick={() => {
            if (selected && !demoMode) {
              onConfirm(selected.id, selectedBalance);
            }
          }}
          disabled={!selected}
          className={cn(
            "w-full text-center rounded-[12px] py-[15px] text-[15.5px] font-semibold mt-4 transition-colors",
            selected
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-primary/40 text-primary-foreground/60 cursor-not-allowed"
          )}
        >
          {selected ? `Charge ${formatCents(selectedBalance)}` : "Select a session"}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CLIENT PROFILE DRILL-DOWN
// ═══════════════════════════════════════════════════════════

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

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        {client.avatar ? (
          <img src={client.avatar} alt={client.name} className="w-16 h-16 rounded-[12px] object-cover bg-secondary" />
        ) : (
          <div className="w-16 h-16 rounded-[12px] bg-secondary flex items-center justify-center text-[20px] font-semibold text-muted-foreground">
            {client.name.split(" ").map(n => n[0]).join("").slice(0, 2)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className={cn(typography.h2, "truncate")}>{client.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            {client.sittings > 0 && <span className={cn(typography.label, "text-muted-foreground")}>{client.sittings} session{client.sittings !== 1 ? "s" : ""}</span>}
            {client.tlv > 0 && <span className={cn(typography.label, "text-[#4ade80] font-semibold")}>{formatMoney(client.tlv)} TLV</span>}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 mb-6">
        {[
          { icon: MessageCircle, label: "Message", href: "#" },
          { icon: Phone, label: "Call", href: `tel:${client.phone}` },
          { icon: Mail, label: "Email", href: `mailto:${client.email}` },
        ].map(({ icon: Icon, label, href }) => (
          <a
            key={label}
            href={href}
            className={cn(tokens.button.outline, "flex-1 flex flex-col items-center justify-center gap-1.5")}
          >
            <Icon className="w-5 h-5 text-primary" />
            <span className={cn(typography.label, "text-muted-foreground")}>{label}</span>
          </a>
        ))}
      </div>

      {/* Section Tabs */}
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
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeSection === "appointments" && (
            <div className="space-y-3">
              {!appointments || appointments.length === 0 ? (
                <EmptySection icon={Calendar} text="No appointments yet" />
              ) : (
                appointments.map((apt: any) => (
                  <div key={apt.id} className={cn(tokens.card.base, "border-border/30 p-4")}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn(typography.bodySm, "font-bold")}>{apt.title || apt.description || "Session"}</span>
                      <span className={cn(
                        tokens.display.badge,
                        apt.status === "completed" ? statusColor.success.full
                          : apt.status === "confirmed" ? statusColor.info.full
                          : statusColor.warning.full
                      )}>
                        {apt.status}
                      </span>
                    </div>
                    <p className={cn(typography.label, "text-muted-foreground")}>
                      {apt.date ? format(new Date(apt.date), "MMM d, yyyy · h:mm a") : "No date"}
                    </p>
                    {apt.price && (
                      <p className={cn(typography.label, "text-[#4ade80] font-semibold mt-1")}>{formatMoney(apt.price)}</p>
                    )}
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
                clientOrders.map((order: any) => {
                  const isFulfilled = order.status === "fulfilled";
                  return (
                    <div key={order.id} className={cn(tokens.card.base, "border-border/30 p-4")}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(typography.bodySm, "font-bold")}>Order #{order.id}</span>
                        <span className={cn(tokens.display.badge, isFulfilled ? statusColor.success.full : statusColor.warning.full)}>
                          {isFulfilled ? "Dispatched" : "Pending"}
                        </span>
                      </div>
                      <p className={cn(typography.label, "text-muted-foreground")}>{format(new Date(order.createdAt), "MMM d, yyyy")}</p>
                      <p className={cn(typography.label, "text-[#4ade80] font-semibold mt-1")}>{formatCents(order.totalAmountCents)}</p>
                    </div>
                  );
                })
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
                    {note.createdAt && (
                      <p className={cn(typography.label, "text-muted-foreground mt-2")}>{format(new Date(note.createdAt), "MMM d, yyyy")}</p>
                    )}
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
      <div className={tokens.display.emptyStateIcon}>
        <Icon className="w-8 h-8" />
      </div>
      <p className={tokens.display.emptyStateText}>{text}</p>
    </div>
  );
}
