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
  Calendar,
  FileText,
  Loader2,
  Users,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTooltipTarget } from "@/components/tooltip-tour";
import { DEMO_CLIENTS, DEMO_REMINDERS } from "./dashboardDemoData";
import { format } from "date-fns";
import { tokens, statusColor, typography } from "@/ui/tokens";

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
  projectName: string;
  project: any | null;
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

  const demoClientsAreaRef = useTooltipTarget("demo-clients-area");
  const demoClientCardRef = useTooltipTarget("demo-client-card");
  const demoRemindersAreaRef = useTooltipTarget("demo-reminders-area");

  const { data: upcomingProjects, isLoading: projectsLoading } = trpc.dashboard.getUpcomingProjects.useQuery(
    undefined, { enabled: !demoMode }
  );
  const { data: clients, isLoading: clientsLoading } = trpc.conversations.getClients.useQuery(
    undefined, { enabled: !demoMode }
  );

  // ── Group projects by client ────────────────────────────
  const groupedProjects: GroupedProject[] = useMemo(() => {
    if (demoMode) return DEMO_GROUPED;
    if (!upcomingProjects || upcomingProjects.length === 0) return [];

    const groups = new Map<string, GroupedProject>();
    for (const appt of upcomingProjects) {
      const clientId = appt.client?.id || "unknown";
      if (!groups.has(clientId)) {
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
        id: appt.id, title: appt.title || appt.serviceName || "Session",
        startTime: appt.startTime, endTime: appt.endTime, status: appt.status,
        price: appt.price, depositAmount: appt.depositAmount,
        depositPaid: appt.depositPaid, paymentStatus: appt.paymentStatus,
      });
    }
    return Array.from(groups.values());
  }, [demoMode, upcomingProjects]);

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
        id: c.id, name: c.name || "Unknown", email: c.email || "",
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

  const isLoading = !demoMode && (projectsLoading || clientsLoading);

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

      {/* ── Upcoming Projects (grouped by client) ─────── */}
      {groupedProjects.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className={typography.h3}>Upcoming Projects</h2>
            <span className={cn(tokens.display.badge, tokens.display.badgeSecondary)}>
              {groupedProjects.reduce((n, g) => n + g.sessions.length, 0)} session{groupedProjects.reduce((n, g) => n + g.sessions.length, 0) !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3">
            {groupedProjects.map((group, i) => {
              const isExpanded = expandedClientId === group.clientId;
              const hasConfirmed = group.sessions.some(s => s.status === "confirmed");
              const allConfirmed = group.sessions.every(s => s.status === "confirmed");
              const nextSession = group.sessions[0];

              // Deposit — computed once for the whole project, not per-session
              const depositInfo = getProjectDepositInfo(group.sessions);

              let styles: string[] = [];
              try { if (group.project?.stylePreferences) styles = JSON.parse(group.project.stylePreferences); } catch {}

              return (
                <motion.div
                  key={group.clientId}
                  ref={demoMode && i === 0 ? (demoClientCardRef as any) : undefined}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(tokens.card.base, "border-border/30")}
                >
                  {/* Header */}
                  <button
                    onClick={() => !demoMode && setExpandedClientId(isExpanded ? null : group.clientId)}
                    className="w-full text-left p-4 flex items-center gap-3"
                  >
                    <div className="shrink-0">
                      {group.clientAvatar ? (
                        <img src={group.clientAvatar} alt={group.clientName} className={cn(tokens.photography.avatar, tokens.photography.avatarSizes.md)} />
                      ) : (
                        <div className={cn(tokens.photography.avatarSizes.md, "rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border-2 border-background")}>
                          {group.clientName.charAt(0)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn(typography.body, "font-bold")}>{group.clientName}</span>
                        {/* Deposit badge — shown ONCE at card level */}
                        {depositInfo.badge && (
                          <span className={cn(tokens.display.badge, depositInfo.badgeClass)}>
                            {depositInfo.badge}
                          </span>
                        )}
                        {/* Status badge if no deposit badge */}
                        {!depositInfo.badge && (
                          <span className={cn(
                            tokens.display.badge,
                            allConfirmed ? statusColor.success.full
                              : hasConfirmed ? statusColor.info.full
                              : statusColor.neutral.full
                          )}>
                            {allConfirmed ? "Confirmed" : hasConfirmed ? "Partial" : "Pending"}
                          </span>
                        )}
                      </div>
                      <p className={cn(typography.bodySm, "text-muted-foreground truncate")}>{group.projectName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className={cn(typography.label, "text-muted-foreground")}>
                          {format(new Date(nextSession.startTime), "EEE, MMM d")}
                          {group.sessions.length > 1 && ` + ${group.sessions.length - 1} more`}
                        </span>
                      </div>
                    </div>

                    <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform shrink-0", isExpanded && "rotate-180")} />
                  </button>

                  {/* Expanded */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-border p-4 bg-background/80 space-y-4">
                          {/* Deposit summary — total across all sessions */}
                          {depositInfo.totalDeposit > 0 && (
                            <div className={cn("rounded-[16px] p-3", depositInfo.summaryBg)}>
                              <div className="flex items-center justify-between">
                                <span className={cn(typography.bodySm, "font-semibold")}>{depositInfo.summary}</span>
                                <span className={cn(tokens.display.badge, depositInfo.badgeClass)}>
                                  {depositInfo.badge}
                                </span>
                              </div>
                              {depositInfo.breakdown && (
                                <p className={cn(typography.label, "text-muted-foreground mt-1")}>{depositInfo.breakdown}</p>
                              )}
                            </div>
                          )}

                          {/* Sessions — with per-session deposit allocation */}
                          <div>
                            <p className={tokens.header.sectionTitle + " mb-2"}>Sessions</p>
                            <div className="space-y-2">
                              {group.sessions.map((session) => {
                                const hasDeposit = session.depositAmount && session.depositAmount > 0;
                                const depPaid = session.paymentStatus === "deposit_paid" || session.paymentStatus === "fully_paid" || session.depositPaid === 1;
                                return (
                                  <div key={session.id} className="flex items-center gap-3 bg-secondary/50 rounded-[16px] p-3">
                                    <div className="flex-1 min-w-0">
                                      <p className={cn(typography.bodySm, "font-semibold truncate")}>{session.title}</p>
                                      <p className={cn(typography.label, "text-muted-foreground")}>
                                        {format(new Date(session.startTime), "EEE, MMM d · h:mm a")}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {session.price && (
                                        <span className={cn(typography.price, statusColor.info.text)}>${session.price}</span>
                                      )}
                                      {hasDeposit && (
                                        <span className={cn(
                                          tokens.display.badge,
                                          depPaid ? statusColor.success.full : statusColor.warning.full
                                        )}>
                                          ${session.depositAmount} dep
                                        </span>
                                      )}
                                      <span className={cn(
                                        tokens.display.badge,
                                        session.status === "confirmed" ? statusColor.success.full : statusColor.neutral.full
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
                                  <p className={tokens.header.sectionTitle + " mb-1"}>Client's Request</p>
                                  <p className={cn(typography.body, "leading-relaxed")}>{group.project.projectDescription}</p>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-3">
                                {group.project.placement && (
                                  <div className="bg-secondary/50 rounded-[16px] p-3">
                                    <p className={typography.nano + " text-muted-foreground mb-0.5"}>Placement</p>
                                    <p className={typography.labelValue}>{group.project.placement}</p>
                                  </div>
                                )}
                                {group.project.estimatedSize && (
                                  <div className="bg-secondary/50 rounded-[16px] p-3">
                                    <p className={typography.nano + " text-muted-foreground mb-0.5"}>Size</p>
                                    <p className={cn(typography.labelValue, "capitalize")}>{group.project.estimatedSize}</p>
                                  </div>
                                )}
                                {group.project.budgetLabel && (
                                  <div className="bg-secondary/50 rounded-[16px] p-3">
                                    <p className={typography.nano + " text-muted-foreground mb-0.5"}>Budget</p>
                                    <p className={typography.labelValue}>{group.project.budgetLabel}</p>
                                  </div>
                                )}
                              </div>

                              {styles.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {styles.map((style: string) => (
                                    <span key={style} className={cn(tokens.display.badge, tokens.display.badgePrimary)}>
                                      {style}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Quick Actions — SSOT button tokens */}
                          <div className="flex gap-2 pt-1">
                            <a
                              href={`sms:${group.clientPhone}`}
                              className={cn(tokens.button.outline, "flex-1 flex items-center justify-center gap-1.5")}
                            >
                              <MessageCircle className="w-4 h-4" />
                              Message
                            </a>
                            <a
                              href={`tel:${group.clientPhone}`}
                              className={cn(tokens.button.outline, "flex-1 flex items-center justify-center gap-1.5")}
                            >
                              <Phone className="w-4 h-4" />
                              Call
                            </a>
                            <button
                              onClick={() => setSelectedClientId(group.clientId)}
                              className={cn(tokens.button.primary, "flex-1 flex items-center justify-center gap-1.5")}
                            >
                              Profile
                              <ChevronRight className="w-4 h-4" />
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
        <div className={tokens.display.emptyState}>
          <div className={tokens.display.emptyStateIcon}>
            <Calendar className="w-8 h-8" />
          </div>
          <p className={tokens.display.emptyStateText}>No upcoming projects. Appointments appear here once clients book sessions.</p>
        </div>
      )}

      {/* ── All Clients ────────────────────────────────── */}
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
                      <img src={client.avatar} alt={client.name} className={cn(tokens.photography.avatar, tokens.photography.avatarSizes.sm, "w-10 h-10")} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border-2 border-background shrink-0">
                        {client.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(typography.bodySm, "font-bold truncate")}>{client.name}</span>
                        <span className={cn(tokens.display.badge, sc.tokenClass)}>
                          {sc.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {client.sittings > 0 && <span className={typography.label + " text-muted-foreground"}>{client.sittings} session{client.sittings !== 1 ? "s" : ""}</span>}
                        {client.tlv > 0 && <span className={cn(typography.label, statusColor.info.text, "font-semibold")}>${client.tlv.toLocaleString()}</span>}
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

// ── Status config (SSOT status colors) ────────────────────

const STATUS_CONFIG: Record<ClientStatus, { label: string; tokenClass: string }> = {
  active:      { label: "Active",      tokenClass: statusColor.success.full },
  past_client: { label: "Past Client", tokenClass: statusColor.neutral.full },
  lead:        { label: "Lead",        tokenClass: statusColor.info.full },
  imported:    { label: "Imported",    tokenClass: "bg-purple-500/10 text-purple-400 border border-purple-500/20" },
};

// ── Deposit helpers ───────────────────────────────────────

/**
 * Compute deposit info for the entire grouped project.
 * Deposit = 25% of each session price, paid as one lump sum.
 * e.g. 4 sessions × $375 = $1,500 total deposit.
 */
function getProjectDepositInfo(sessions: GroupedProject["sessions"]) {
  let totalDeposit = 0;
  let perSession = 0;
  let sessionsWithDeposit = 0;
  let paidCount = 0;
  let fullyPaidCount = 0;

  for (const s of sessions) {
    if (s.depositAmount && s.depositAmount > 0) {
      totalDeposit += s.depositAmount;
      perSession = s.depositAmount; // they're all the same rate
      sessionsWithDeposit++;
      if (s.paymentStatus === "fully_paid") {
        fullyPaidCount++;
      } else if (s.paymentStatus === "deposit_paid" || s.depositPaid === 1) {
        paidCount++;
      }
    }
  }

  if (totalDeposit === 0) {
    return { badge: null, badgeClass: "", summary: null, summaryBg: "", breakdown: null, totalDeposit: 0 };
  }

  const allPaid = (paidCount + fullyPaidCount) === sessionsWithDeposit;
  const breakdown = sessionsWithDeposit > 1
    ? `$${perSession} × ${sessionsWithDeposit} sessions = $${totalDeposit.toLocaleString()} total`
    : null;

  if (fullyPaidCount === sessionsWithDeposit) {
    return {
      badge: "Fully Paid",
      badgeClass: statusColor.success.full,
      summary: `$${totalDeposit.toLocaleString()} deposit + balance paid`,
      summaryBg: "bg-[var(--color-status-success-bg)]",
      breakdown,
      totalDeposit,
    };
  }

  if (allPaid) {
    return {
      badge: `$${totalDeposit.toLocaleString()} Paid`,
      badgeClass: statusColor.success.full,
      summary: `$${totalDeposit.toLocaleString()} deposit received`,
      summaryBg: "bg-[var(--color-status-success-bg)]",
      breakdown,
      totalDeposit,
    };
  }

  return {
    badge: `$${totalDeposit.toLocaleString()} Due`,
    badgeClass: statusColor.warning.full,
    summary: `$${totalDeposit.toLocaleString()} deposit outstanding`,
    summaryBg: "bg-[var(--color-status-warning-bg)]",
    breakdown,
    totalDeposit,
  };
}

function formatProjectType(slug: string): string {
  return slug.replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// ── Client Profile Drill-Down ─────────────────────────────

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
          <img src={client.avatar} alt={client.name} className={cn(tokens.photography.avatar, tokens.photography.avatarSizes.lg)} />
        ) : (
          <div className={cn(tokens.photography.avatarSizes.lg, "rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl border-2 border-background")}>
            {client.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className={cn(typography.h2, "truncate")}>{client.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            {client.sittings > 0 && <span className={cn(typography.label, "text-muted-foreground")}>{client.sittings} session{client.sittings !== 1 ? "s" : ""}</span>}
            {client.tlv > 0 && <span className={cn(typography.label, statusColor.info.text, "font-semibold")}>${client.tlv.toLocaleString()} TLV</span>}
          </div>
        </div>
      </div>

      {/* Quick Actions — SSOT buttons */}
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

      {/* Section Tabs — SSOT viewToggle */}
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
                      <p className={cn(typography.label, statusColor.info.text, "font-semibold mt-1")}>${apt.price}</p>
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
                      <p className={cn(typography.label, statusColor.info.text, "font-semibold mt-1")}>${(order.totalAmountCents / 100).toFixed(2)}</p>
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
