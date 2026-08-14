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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTooltipTarget } from "@/components/tooltip-tour";
import { DEMO_CLIENTS, DEMO_REMINDERS } from "./dashboardDemoData";
import { format } from "date-fns";

interface ClientsTabProps {
  demoMode?: boolean;
}

// ── Demo upcoming projects (for tour) ─────────────────────
const DEMO_UPCOMING = [
  {
    id: 9001,
    title: "Sleeve Session 3",
    startTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000).toISOString(),
    status: "confirmed",
    price: 450,
    depositAmount: 150,
    depositPaid: 1,
    paymentStatus: "deposit_paid",
    serviceName: "Full sleeve — Japanese Traditional",
    client: {
      id: "demo-client-1",
      name: "Sarah Chen",
      email: "sarah@example.com",
      phone: "0412 345 678",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=60",
      city: "Sydney",
    },
    project: {
      projectType: "full-sleeve",
      projectDescription: "Koi fish and waves flowing into existing shoulder piece. Want traditional Japanese style with modern color palette.",
      stylePreferences: JSON.stringify(["Japanese Traditional", "Neo-Traditional"]),
      referenceImages: null,
      placement: "Full left arm",
      estimatedSize: "extra-large",
      budgetLabel: "$3,000 – $5,000",
      status: "scheduled",
    },
  },
  {
    id: 9002,
    title: "Back Piece Session 1",
    startTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000).toISOString(),
    status: "pending",
    price: 600,
    depositAmount: 200,
    depositPaid: 0,
    paymentStatus: "pending_deposit",
    serviceName: "Full back piece — Realism",
    client: {
      id: "demo-client-2",
      name: "Marcus Thorne",
      email: "marcus@example.com",
      phone: "0423 456 789",
      avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=60",
      city: "Melbourne",
    },
    project: {
      projectType: "back-piece",
      projectDescription: "Full back piece — realistic lion portrait with geometric frame elements.",
      stylePreferences: JSON.stringify(["Realism", "Geometric"]),
      referenceImages: null,
      placement: "Full back",
      estimatedSize: "extra-large",
      budgetLabel: "$5,000 – $8,000",
      status: "deposit_requested",
    },
  },
];

export function ClientsTab({ demoMode = false }: ClientsTabProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);
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

  // Merge real + demo
  const displayProjects = demoMode ? DEMO_UPCOMING : (upcomingProjects || []);

  const displayClients = demoMode
    ? DEMO_CLIENTS
    : (clients || []).map((c: any) => ({
        id: c.id,
        name: c.name || "Unknown",
        email: c.email || "",
        phone: c.phone || "",
        avatar: c.avatar || null,
        city: c.city ? `${c.city}${c.country ? `, ${c.country}` : ""}` : "",
        tlv: c.tlv || 0,
        sittings: c.sittings || 0,
        status: (c.sittings > 0 ? "completed" : "lead") as "active" | "lead" | "completed",
      }));

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
      className="space-y-6 animate-in fade-in duration-500 pb-20"
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

      {/* ── Upcoming Projects ──────────────────────────── */}
      {displayProjects.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-xl font-bold tracking-tight">Upcoming Projects</h2>
            <span className="text-xs font-bold text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
              {displayProjects.length} upcoming
            </span>
          </div>

          <div className="space-y-3">
            {displayProjects.map((project: any, i: number) => {
              const isExpanded = expandedProjectId === project.id;
              const depositPending = project.paymentStatus === "pending_deposit";
              const date = new Date(project.startTime);
              let styles: string[] = [];
              try {
                if (project.project?.stylePreferences) {
                  styles = JSON.parse(project.project.stylePreferences);
                }
              } catch {}

              return (
                <motion.div
                  key={project.id}
                  ref={demoMode && i === 0 ? (demoClientCardRef as any) : undefined}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-secondary/50 border border-border rounded-[20px] overflow-hidden"
                >
                  {/* Collapsed Header */}
                  <button
                    onClick={() => !demoMode && setExpandedProjectId(isExpanded ? null : project.id)}
                    className="w-full text-left p-4 flex items-center gap-3"
                  >
                    {/* Client Avatar */}
                    <div className="shrink-0">
                      {project.client?.avatar ? (
                        <img
                          src={project.client.avatar}
                          alt={project.client.name}
                          className="w-11 h-11 rounded-full object-cover border-2 border-border"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border-2 border-border">
                          {(project.client?.name || "?").charAt(0)}
                        </div>
                      )}
                    </div>

                    {/* Project Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-[15px] truncate">{project.client?.name || "Client"}</span>
                        {depositPending && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning-text)]">
                            Deposit Due
                          </span>
                        )}
                        {!depositPending && project.status === "confirmed" && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-status-success-bg)] text-[var(--color-success)]">
                            Confirmed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{project.title || project.serviceName}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{format(date, "EEE, MMM d · h:mm a")}</span>
                        {project.price && (
                          <>
                            <span>·</span>
                            <span className="font-semibold text-[var(--color-status-info-text)]">${project.price}</span>
                          </>
                        )}
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
                          {/* Project Details */}
                          {project.project && (
                            <div className="space-y-3">
                              {project.project.projectDescription && (
                                <div>
                                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Project Brief</p>
                                  <p className="text-sm leading-relaxed">{project.project.projectDescription}</p>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-3">
                                {project.project.placement && (
                                  <div className="bg-secondary/50 rounded-xl p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Placement</p>
                                    <p className="text-sm font-semibold">{project.project.placement}</p>
                                  </div>
                                )}
                                {project.project.estimatedSize && (
                                  <div className="bg-secondary/50 rounded-xl p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Size</p>
                                    <p className="text-sm font-semibold capitalize">{project.project.estimatedSize}</p>
                                  </div>
                                )}
                                {project.project.budgetLabel && (
                                  <div className="bg-secondary/50 rounded-xl p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Budget</p>
                                    <p className="text-sm font-semibold">{project.project.budgetLabel}</p>
                                  </div>
                                )}
                                {project.depositAmount && (
                                  <div className="bg-secondary/50 rounded-xl p-3">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Deposit</p>
                                    <p className={cn("text-sm font-semibold", depositPending ? "text-[var(--color-status-warning-text)]" : "text-[var(--color-success)]")}>
                                      ${project.depositAmount} {depositPending ? "pending" : "paid"}
                                    </p>
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
                              href={`sms:${project.client?.phone}`}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-secondary/50 border border-border rounded-xl text-xs font-semibold hover:bg-secondary/80 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-primary" />
                              Message
                            </a>
                            <a
                              href={`tel:${project.client?.phone}`}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-secondary/50 border border-border rounded-xl text-xs font-semibold hover:bg-secondary/80 transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5 text-primary" />
                              Call
                            </a>
                            <button
                              onClick={() => project.client && setSelectedClientId(project.client.id)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-foreground text-background rounded-xl text-xs font-bold hover:opacity-90 transition-colors"
                            >
                              View Profile
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
      {displayProjects.length === 0 && !demoMode && (
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
              const statusConfig = {
                active: { label: "Active", bg: "bg-[var(--color-status-success-bg)]", text: "text-[var(--color-success)]" },
                completed: { label: "Completed", bg: "bg-secondary", text: "text-muted-foreground" },
                lead: { label: "Lead", bg: "bg-[var(--color-status-info-bg)]", text: "text-[var(--color-status-info-text)]" },
              }[client.status];

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
    <div className="animate-in slide-in-from-right duration-300 pb-20">
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
