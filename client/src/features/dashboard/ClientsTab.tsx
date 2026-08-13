import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  Search,
  ChevronLeft,
  ChevronDown,
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
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useTooltipTarget } from "@/components/tooltip-tour";
import { DEMO_CLIENTS, DEMO_REMINDERS } from "./dashboardDemoData";
import { format } from "date-fns";

interface ClientsTabProps {
  demoMode?: boolean;
}

export function ClientsTab({ demoMode = false }: ClientsTabProps) {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Tooltip tour targets
  const demoClientsAreaRef = useTooltipTarget("demo-clients-area");
  const demoClientCardRef = useTooltipTarget("demo-client-card");
  const demoRemindersAreaRef = useTooltipTarget("demo-reminders-area");

  // Real data
  const { data: clients, isLoading } = trpc.conversations.getClients.useQuery(undefined, {
    enabled: !demoMode,
  });

  // Merge real + demo
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
        nextAppointment: null as string | null,
        lastSeen: "",
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

  if (!demoMode && isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
      </div>
    );
  }

  // ── Client List ────────────────────────────────────────
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

      {/* Client Count */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold tracking-tight">
          {demoMode ? "Clients" : `${filteredClients.length} Client${filteredClients.length !== 1 ? "s" : ""}`}
        </h2>
      </div>

      {/* Client Cards */}
      {filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 text-center h-64 bg-secondary/50 rounded-3xl border border-border">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">No Clients Yet</h2>
          <p className="text-muted-foreground text-sm">
            Clients will appear here once they book or message you.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client, i) => {
            const statusConfig = {
              active: { label: "Active", bg: "bg-[var(--color-status-success-bg)]", text: "text-[var(--color-success)]" },
              completed: { label: "Completed", bg: "bg-secondary", text: "text-muted-foreground" },
              lead: { label: "Lead", bg: "bg-[var(--color-status-info-bg)]", text: "text-[var(--color-status-info-text)]" },
            }[client.status];

            return (
              <motion.div
                key={client.id}
                ref={demoMode && i === 0 ? (demoClientCardRef as any) : undefined}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => !demoMode && setSelectedClientId(client.id)}
                  className="w-full text-left bg-secondary/50 border border-border rounded-[20px] p-4 flex items-center gap-4 hover:bg-secondary/70 transition-colors"
                >
                  {/* Avatar */}
                  <div className="shrink-0">
                    {client.avatar ? (
                      <img
                        src={client.avatar}
                        alt={client.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-border"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border-2 border-border">
                        {client.name.charAt(0)}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[15px] truncate">{client.name}</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", statusConfig.bg, statusConfig.text)}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {client.sittings > 0 && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {client.sittings} session{client.sittings !== 1 ? "s" : ""}
                        </span>
                      )}
                      {client.tlv > 0 && (
                        <span className="flex items-center gap-1 font-semibold text-[var(--color-status-info-text)]">
                          <DollarSign className="w-3 h-3" />
                          ${client.tlv.toLocaleString()}
                        </span>
                      )}
                      {client.city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {client.city.split(",")[0]}
                        </span>
                      )}
                    </div>
                    {client.nextAppointment && (
                      <p className="text-xs text-primary/80 font-medium mt-1">
                        📅 {client.nextAppointment}
                      </p>
                    )}
                  </div>

                  {/* Chevron */}
                  <ChevronDown className="w-5 h-5 text-muted-foreground -rotate-90 shrink-0" />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

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
          <img
            src={client.avatar}
            alt={client.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-primary/20"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl border-2 border-primary/20">
            {client.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold truncate">{client.name}</h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            {client.sittings > 0 && (
              <span>{client.sittings} session{client.sittings !== 1 ? "s" : ""}</span>
            )}
            {client.tlv > 0 && (
              <span className="font-semibold text-[var(--color-status-info-text)]">
                ${client.tlv.toLocaleString()} TLV
              </span>
            )}
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
                      <p className="text-xs font-semibold text-[var(--color-status-info-text)] mt-1">
                        ${apt.price}
                      </p>
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
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs font-semibold text-[var(--color-status-info-text)] mt-1">
                        ${(order.totalAmountCents / 100).toFixed(2)}
                      </p>
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
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(note.createdAt), "MMM d, yyyy")}
                      </p>
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
