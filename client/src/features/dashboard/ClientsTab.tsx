import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Search,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
  Users,
  Package,
  Image as ImageIcon,
  Clock,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTooltipTarget } from "@/components/tooltip-tour";
import { DEMO_CLIENTS, DEMO_REMINDERS } from "./dashboardDemoData";
import { format } from "date-fns";

interface ClientsTabProps {
  demoMode?: boolean;
}

// ── Types ─────────────────────────────────────────────────

interface GroupedProject {
  clientId: string;
  clientName: string;
  clientAvatar: string | null;
  clientEmail: string;
  clientPhone: string;
  clientCity: string;
  /** The project name — from lead projectType or serviceName */
  projectName: string;
  /** Project details from linked lead */
  project: any | null;
  /** All sessions for this client-project */
  sessions: {
    id: number;
    title: string;
    startTime: string;
    endTime: string;
    status: string;
    price: number | null;
    depositAmount: number | null;
    depositPaid: number | null;
    paymentStatus: string | null;
  }[];
}

type ClientStatus = "active" | "past_client" | "lead" | "imported";

// ── Demo data ─────────────────────────────────────────────

const DEMO_GROUPED: GroupedProject[] = [
  {
    clientId: "demo-client-1",
    clientName: "Sarah Chen",
    clientAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=60",
    clientEmail: "sarah@example.com",
    clientPhone: "0412 345 678",
    clientCity: "Sydney",
    projectName: "Full Sleeve — Japanese Traditional",
    project: {
      projectDescription: "Koi fish and waves flowing into existing shoulder piece. Want traditional Japanese style with modern color palette.",
      stylePreferences: JSON.stringify(["Japanese Traditional", "Neo-Traditional"]),
      placement: "Full left arm",
      estimatedSize: "extra-large",
      budgetLabel: "$3,000 – $5,000",
    },
    sessions: [
      { id: 9001, title: "Sleeve Session 3", startTime: new Date(Date.now() + 6 * 86400000).toISOString(), endTime: new Date(Date.now() + 6 * 86400000 + 4 * 3600000).toISOString(), status: "confirmed", price: 450, depositAmount: 150, depositPaid: 1, paymentStatus: "deposit_paid" },
      { id: 9003, title: "Sleeve Session 4", startTime: new Date(Date.now() + 20 * 86400000).toISOString(), endTime: new Date(Date.now() + 20 * 86400000 + 4 * 3600000).toISOString(), status: "pending", price: 450, depositAmount: null, depositPaid: null, paymentStatus: null },
    ],
  },
  {
    clientId: "demo-client-2",
    clientName: "Marcus Thorne",
    clientAvatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=60",
    clientEmail: "marcus@example.com",
    clientPhone: "0423 456 789",
    clientCity: "Melbourne",
    projectName: "Back Piece — Realism",
    project: {
      projectDescription: "Full back piece — realistic lion portrait with geometric frame elements.",
      stylePreferences: JSON.stringify(["Realism", "Geometric"]),
      placement: "Full back",
      estimatedSize: "extra-large",
      budgetLabel: "$5,000 – $8,000",
    },
    sessions: [
      { id: 9002, title: "Back Piece Session 1", startTime: new Date(Date.now() + 8 * 86400000).toISOString(), endTime: new Date(Date.now() + 8 * 86400000 + 6 * 3600000).toISOString(), status: "pending", price: 600, depositAmount: 200, depositPaid: 0, paymentStatus: "pending_deposit" },
    ],
  },
];

// ── Main Component ────────────────────────────────────────

export function ClientsTab({ demoMode = false }: ClientsTabProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Tooltip tour targets
  const demoClientsAreaRef = useTooltipTarget("demo-clients-area");
  const demoClientCardRef = useTooltipTarget("demo-client-card");
  const demoRemindersAreaRef = useTooltipTarget("demo-reminders-area");

  // Real data
  const { data: upcomingProjects, isLoading: projectsLoading } = trpc.dashboard.getUpcomingProjects.useQuery(
    undefined,
    { enabled: !demoMode }
  );

  const { data: clients, isLoading: clientsLoading } = trpc.conversations.getClients.useQuery(undefined, {
    enabled: !demoMode,
  });

  // ── Group projects by client ────────────────────────────
  const groupedProjects: GroupedProject[] = useMemo(() => {
    if (demoMode) return DEMO_GROUPED;
    if (!upcomingProjects || upcomingProjects.length === 0) return [];

    const groups = new Map<string, GroupedProject>();

    for (const appt of upcomingProjects) {
      const clientId = appt.client?.id || "unknown";

      if (!groups.has(clientId)) {
        // Derive project name from lead or service
        const projectName = appt.project?.projectType
          ? formatProjectType(appt.project.projectType)
          : appt.serviceName || appt.title || "Project";

        groups.set(clientId, {
          clientId,
          clientName: appt.client?.name || "Client",
          clientAvatar: appt.client?.avatar || null,
          clientEmail: appt.client?.email || "",
          clientPhone: appt.client?.phone || "",
          clientCity: appt.client?.city || "",
          projectName,
          project: appt.project,
          sessions: [],
        });
      }

      groups.get(clientId)!.sessions.push({
        id: appt.id,
        title: appt.title || appt.serviceName || "Session",
        startTime: appt.startTime,
        endTime: appt.endTime,
        status: appt.status,
        price: appt.price,
        depositAmount: appt.depositAmount,
        depositPaid: appt.depositPaid,
        paymentStatus: appt.paymentStatus,
      });
    }

    return Array.from(groups.values());
  }, [demoMode, upcomingProjects]);

  // ── Client list with proper statuses ────────────────────
  const displayClients = useMemo(() => {
    if (demoMode) return DEMO_CLIENTS;
    return (clients || []).map((c: any) => {
      let status: ClientStatus;
      if (c.hasUpcoming) {
        status = "active";
      } else if (c.sittings > 0) {
        status = "past_client";
      } else if (c.hasLead) {
        status = "lead";
      } else {
        status = "imported";
      }

      return {
        id: c.id,
        name: c.name || "Unknown",
        email: c.email || "",
        phone: c.phone || "",
        avatar: c.avatar || null,
        city: c.city ? `${c.city}${c.country ? `, ${c.country}` : ""}` : "",
        tlv: c.tlv || 0,
        sittings: c.sittings || 0,
        status,
      };
    });
  }, [demoMode, clients]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return displayClients;
    const q = searchQuery.toLowerCase();
    return displayClients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }, [displayClients, searchQuery]);

  const selectedClient = selectedClientId
    ? displayClients.find((c) => c.id === selectedClientId)
    : null;

  // ── Client Profile Drill-down ──────────────────────────
  if (selectedClient && !demoMode) {
    return <ClientProfile client={selectedClient} onBack={() => setSelectedClientId(null)} />;
  }

  const isLoading = !demoMode && (projectsLoading || clientsLoading);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  // ── Main View ──────────────────────────────────────────
  return (
    <div
      className="space-y-6 animate-in fade-in duration-500 pb-40"
      ref={demoMode ? (demoClientsAreaRef as any) : undefined}
    >
      {/* Search Bar */}
      <div className="relative px-1">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-muted-foreground" />
        </div>
        <input
          type="text"
          placeholder="Search clients..."
          value={demoMode ? "" : searchQuery}
          onChange={(e) => !demoMode && setSearchQuery(e.target.value)}
          className="w-full bg-secondary/50 border border-border rounded-full py-3.5 pl-12 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/70 text-foreground"
          readOnly={demoMode}
        />
      </div>

      {/* ── Upcoming Projects (grouped by client) ─────── */}
      {groupedProjects.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-xl font-bold tracking-tight">Upcoming Projects</h2>
            <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
              {groupedProjects.reduce((n, g) => n + g.sessions.length, 0)} session{groupedProjects.reduce((n, g) => n + g.sessions.length, 0) !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3">
            {groupedProjects.map((group, i) => {
              const isExpanded = expandedClientId === group.clientId;

              // Determine overall status for the card
              const hasConfirmed = group.sessions.some(s => s.status === "confirmed");
              const allConfirmed = group.sessions.every(s => s.status === "confirmed");
              const nextSession = group.sessions[0]; // already sorted by startTime from server

              // Smart deposit badge — only show if deposit was actually requested
              const depositInfo = getDepositInfo(group.sessions);

              let styles: string[] = [];
              try {
                if (group.project?.stylePreferences) {
                  styles = JSON.parse(group.project.stylePreferences);
                }
              } catch {}

              return (
                <motion.div
                  key={group.clientId}
                  ref={demoMode && i === 0 ? (demoClientCardRef as any) : undefined}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-secondary/50 border border-border rounded-[20px] overflow-hidden"
                >
                  {/* Collapsed Header */}
                  <button
                    onClick={() => !demoMode && setExpandedClientId(isExpanded ? null : group.clientId)}
                    className="w-full text-left p-4 flex items-center gap-3"
                  >
                    {/* Client Avatar */}
                    <div className="shrink-0">
                      {group.clientAvatar ? (
                        <img src={group.clientAvatar} alt={group.clientName} className="w-11 h-11 rounded-full object-cover border-2 border-border" />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border-2 border-border">
                          {group.clientName.charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Project Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-[15px] truncate">{group.clientName}</span>
                        {depositInfo.badge && (
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            depositInfo.badgeClass
                          )}>
                            {depositInfo.badge}
                          </span>
                        )}
                        {!depositInfo.badge && (
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                            allConfirmed
                              ? "bg-[var(--color-status-success-bg)] text-[var(--color-success)]"
                              : hasConfirmed
                                ? "bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]"
                                : "bg-secondary text-muted-foreground"
                          )}>
                            {allConfirmed ? "Confirmed" : hasConfirmed ? "Partially Confirmed" : "Pending"}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-muted-foreground truncate">{group.projectName}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {format(new Date(nextSession.startTime), "EEE, MMM d")}
                          {group.sessions.length > 1 && ` + ${group.sessions.length - 1} more`}
                        </span>
                      </div>
                    </div>

                    <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-180")} />
                  </button>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border p-4 bg-background/80 space-y-4">
                          {/* Session List */}
                          <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Sessions</p>
                            <div className="space-y-2">
                              {group.sessions.map((session) => {
                                const sessionDeposit = getSessionDepositBadge(session);
                                return (
                                  <div key={session.id} className="flex items-center gap-3 bg-secondary/50 rounded-xl p-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold truncate">{session.title}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {format(new Date(session.startTime), "EEE, MMM d · h:mm a")}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {session.price && (
                                        <span className="text-xs font-semibold text-[var(--color-status-info-text)]">${session.price}</span>
                                      )}
                                      {sessionDeposit && (
                                        <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase", sessionDeposit.cls)}>
                                          {sessionDeposit.label}
                                        </span>
                                      )}
                                      <span className={cn(
                                        "px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase",
                                        session.status === "confirmed"
                                          ? "bg-[var(--color-status-success-bg)] text-[var(--color-success)]"
                                          : "bg-secondary text-muted-foreground"
                                      )}>
                                        {session.status}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Project Details */}
                          {group.project && (
                            <div className="space-y-3">
                              {group.project.projectDescription && (
                                <div>
                                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Client's Request</p>
                                  <p className="text-sm leading-relaxed">{group.project.projectDescription}</p>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-3">
                                {group.project.placement && (
                                  <div className="bg-secondary/50 rounded-xl p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Placement</p>
                                    <p className="text-sm font-semibold">{group.project.placement}</p>
                                  </div>
                                )}
                                {group.project.estimatedSize && (
                                  <div className="bg-secondary/50 rounded-xl p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Size</p>
                                    <p className="text-sm font-semibold capitalize">{group.project.estimatedSize}</p>
                                  </div>
                                )}
                                {group.project.budgetLabel && (
                                  <div className="bg-secondary/50 rounded-xl p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Budget</p>
                                    <p className="text-sm font-semibold">{group.project.budgetLabel}</p>
                                  </div>
                                )}
                              </div>

                              {/* Style Tags */}
                              {styles.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {styles.map((style: string) => (
                                    <span key={style} className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                                      {style}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Quick Actions */}
                          <div className="flex gap-2 pt-1">
                            <a
                              href={`sms:${group.clientPhone}`}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-secondary/50 border border-border rounded-xl text-xs font-semibold hover:bg-secondary/80 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-primary" />
                              Message
                            </a>
                            <a
                              href={`tel:${group.clientPhone}`}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-secondary/50 border border-border rounded-xl text-xs font-semibold hover:bg-secondary/80 transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5 text-primary" />
                              Call
                            </a>
                            <button
                              onClick={() => setSelectedClientId(group.clientId)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-foreground text-background rounded-xl text-xs font-bold hover:opacity-90 transition-colors"
                            >
                              Profile
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* No Upcoming Projects */}
      {groupedProjects.length === 0 && !demoMode && (
        <div className="flex flex-col items-center justify-center p-6 text-center bg-secondary/50 rounded-3xl border border-border">
          <Calendar className="w-10 h-10 text-muted-foreground/50 mb-3" />
          <h2 className="text-lg font-bold mb-1">No Upcoming Projects</h2>
          <p className="text-muted-foreground text-sm">Appointments will appear here once clients book sessions.</p>
        </div>
      )}

      {/* ── All Clients ────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xl font-bold tracking-tight">
            {demoMode ? "All Clients" : `${filteredClients.length} Client${filteredClients.length !== 1 ? "s" : ""}`}
          </h2>
        </div>

        {filteredClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center bg-secondary/50 rounded-3xl border border-border">
            <Users className="w-10 h-10 text-muted-foreground/50 mb-3" />
            <h2 className="text-lg font-bold mb-1">No Clients Yet</h2>
            <p className="text-muted-foreground text-sm">Clients appear here once they book or message you.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClients.map((client, i) => {
              const statusConfig = STATUS_CONFIG[client.status];

              return (
                <motion.div
                  key={client.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.03 }}
                >
                  <button
                    onClick={() => !demoMode && setSelectedClientId(client.id)}
                    className="w-full text-left bg-secondary/50 border border-border rounded-[16px] p-3.5 flex items-center gap-3 hover:bg-secondary/70 transition-colors"
                  >
                    {client.avatar ? (
                      <img src={client.avatar} alt={client.name} className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-border shrink-0">
                        {client.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm truncate">{client.name}</span>
                        <span className={cn("px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase", statusConfig.bg, statusConfig.text)}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                        {client.sittings > 0 && <span>{client.sittings} session{client.sittings !== 1 ? "s" : ""}</span>}
                        {client.tlv > 0 && <span className="font-semibold text-[var(--color-status-info-text)]">${client.tlv.toLocaleString()}</span>}
                        {client.city && <span>{client.city.split(",")[0]}</span>}
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

      {/* Automated Reminders — shown only during demo mode tour */}
      {demoMode && (
        <section ref={demoRemindersAreaRef as any}>
          <div className="flex items-center gap-2 mb-4 px-1">
            <h2 className="text-xl font-bold tracking-tight">Automated Reminders</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary">
              Auto
            </span>
          </div>
          <div className="bg-secondary/50 border border-border rounded-[20px] overflow-hidden divide-y divide-border/30">
            {DEMO_REMINDERS.map((reminder) => (
              <div key={reminder.id} className="p-4 flex items-start gap-3">
                <span className="text-xl mt-0.5">{reminder.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{reminder.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{reminder.description}</p>
                  <p className="text-xs text-primary/70 mt-1 font-medium">{reminder.timing}</p>
                </div>
                <div className="shrink-0 px-2 py-1 rounded-lg bg-[var(--color-status-success-bg)] text-[var(--color-success)]">
                  <span className="text-[10px] font-bold uppercase">Active</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Status badge config ───────────────────────────────────

const STATUS_CONFIG: Record<ClientStatus, { label: string; bg: string; text: string }> = {
  active: { label: "Active", bg: "bg-[var(--color-status-success-bg)]", text: "text-[var(--color-success)]" },
  past_client: { label: "Past Client", bg: "bg-secondary", text: "text-muted-foreground" },
  lead: { label: "Lead", bg: "bg-[var(--color-status-info-bg)]", text: "text-[var(--color-status-info-text)]" },
  imported: { label: "Imported", bg: "bg-purple-500/10", text: "text-purple-400" },
};

// ── Deposit helpers ───────────────────────────────────────

/** Get deposit info for the grouped project card header badge */
function getDepositInfo(sessions: GroupedProject["sessions"]) {
  let hasDepositDue = false;
  let hasDepositPaid = false;

  for (const s of sessions) {
    // Only consider sessions where a deposit was actually requested
    if (s.depositAmount && s.depositAmount > 0) {
      if (s.paymentStatus === "pending_deposit" || s.depositPaid === 0) {
        hasDepositDue = true;
      } else if (s.paymentStatus === "deposit_paid" || s.paymentStatus === "fully_paid" || s.depositPaid === 1) {
        hasDepositPaid = true;
      }
    }
  }

  if (hasDepositDue) {
    return {
      badge: "Deposit Due",
      badgeClass: "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]",
    };
  }
  if (hasDepositPaid) {
    return {
      badge: "Deposit Paid",
      badgeClass: "bg-[var(--color-status-success-bg)] text-[var(--color-success)]",
    };
  }
  return { badge: null, badgeClass: "" };
}

/** Get per-session deposit badge (only if deposit was requested) */
function getSessionDepositBadge(session: GroupedProject["sessions"][0]) {
  if (!session.depositAmount || session.depositAmount <= 0) return null;

  if (session.paymentStatus === "fully_paid") {
    return { label: "Paid", cls: "bg-[var(--color-status-success-bg)] text-[var(--color-success)]" };
  }
  if (session.paymentStatus === "deposit_paid" || session.depositPaid === 1) {
    return { label: `$${session.depositAmount} dep`, cls: "bg-[var(--color-status-success-bg)] text-[var(--color-success)]" };
  }
  return { label: `$${session.depositAmount} due`, cls: "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]" };
}

/** Format projectType slug to readable name */
function formatProjectType(slug: string): string {
  return slug
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Client Profile Drill-Down ─────────────────────────────

interface ClientProfileProps {
  client: {
    id: string;
    name: string;
    email: string;
    phone: string;
    avatar: string | null;
    city: string;
    tlv: number;
    sittings: number;
  };
  onBack: () => void;
}

function ClientProfile({ client, onBack }: ClientProfileProps) {
  const [activeSection, setActiveSection] = useState<"appointments" | "orders" | "notes">("appointments");

  // Fetch appointment history for this client
  const { data: appointments } = trpc.clientProfile.getHistory.useQuery(
    { clientId: client.id },
    { enabled: !!client.id }
  );

  // Fetch orders (filter by email)
  const { data: orders } = trpc.storefront.getOrders.useQuery(undefined, {
    enabled: !!client.id,
  });

  // Fetch notes
  const { data: notes } = trpc.clientProfile.getClientNotes.useQuery(
    { clientId: client.id },
    { enabled: !!client.id }
  );

  const clientOrders = useMemo(() => {
    if (!orders || !client.email) return [];
    return orders.filter((o: any) => o.buyerEmail?.toLowerCase() === client.email.toLowerCase());
  }, [orders, client.email]);

  return (
    <div className="animate-in slide-in-from-right duration-300 pb-40">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to clients
      </button>

      {/* Client Header */}
      <div className="flex items-center gap-4 mb-6">
        {client.avatar ? (
          <img src={client.avatar} alt={client.name} className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl border-2 border-primary/20">
            {client.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">{client.name}</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            {client.sittings > 0 && <span>{client.sittings} session{client.sittings !== 1 ? "s" : ""}</span>}
            {client.tlv > 0 && <span className="font-semibold text-[var(--color-status-info-text)]">${client.tlv.toLocaleString()} TLV</span>}
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
            className="flex-1 flex flex-col items-center gap-1.5 py-3 bg-secondary/50 border border-border rounded-[16px] hover:bg-secondary/80 transition-colors"
          >
            <Icon className="w-5 h-5 text-primary" />
            <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
          </a>
        ))}
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 p-1 bg-secondary/50 rounded-full mb-6">
        {(["appointments", "orders", "notes"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={cn(
              "flex-1 px-4 py-2 text-sm font-bold capitalize rounded-full transition-all",
              activeSection === s
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-white"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Section Content */}
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
                  <div key={apt.id} className="bg-secondary/50 border border-border rounded-[16px] p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{apt.title || apt.description || "Session"}</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        apt.status === "completed" ? "bg-[var(--color-status-success-bg)] text-[var(--color-success)]" :
                        apt.status === "confirmed" ? "bg-[var(--color-status-info-bg)] text-[var(--color-status-info-text)]" :
                        "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]"
                      )}>
                        {apt.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {apt.date ? format(new Date(apt.date), "MMM d, yyyy · h:mm a") : "No date"}
                    </p>
                    {apt.price && (
                      <p className="text-xs font-semibold text-[var(--color-status-info-text)] mt-1">${apt.price}</p>
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
                    <div key={order.id} className="bg-secondary/50 border border-border rounded-[16px] p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">Order #{order.id}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                          isFulfilled ? "bg-[var(--color-status-success-bg)] text-[var(--color-success)]" : "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]"
                        )}>
                          {isFulfilled ? "Dispatched" : "Pending"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{format(new Date(order.createdAt), "MMM d, yyyy")}</p>
                      <p className="text-xs font-semibold text-[var(--color-status-info-text)] mt-1">${(order.totalAmountCents / 100).toFixed(2)}</p>
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
                  <div key={note.id} className="bg-secondary/50 border border-border rounded-[16px] p-4">
                    <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                    {note.createdAt && (
                      <p className="text-xs text-muted-foreground mt-2">{format(new Date(note.createdAt), "MMM d, yyyy")}</p>
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
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="w-10 h-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
