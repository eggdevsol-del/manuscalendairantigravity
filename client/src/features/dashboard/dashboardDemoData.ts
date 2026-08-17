/**
 * Dashboard Demo Data — Mock data shown only during the dashboard tooltip tour
 * ─────────────────────────────────────────────────────────────────────────────
 * All mock data in one file. Only rendered when isDemoMode === true.
 * Reverts to real data the moment the tour ends.
 */
// ExtendedTask type — only used for demo mock data during tooltip tour
interface ExtendedTask {
  id: string;
  title: string;
  context?: string;
  priority: "high" | "medium" | "low";
  status: "pending" | "completed" | "dismissed" | "snoozed";
  actionType: string;
  domain: "business" | "social" | "personal";
}

export const DEMO_TASKS: ExtendedTask[] = [
  {
    id: "demo-task-1",
    title: "Follow up with Sarah Chen",
    context: "No reply in 3 days — last message was about sleeve design.",
    priority: "high",
    status: "pending",
    actionType: "sms",
    domain: "business",
  },
  {
    id: "demo-task-2",
    title: "Send aftercare instructions",
    context: "Marcus Thorne — session completed yesterday.",
    priority: "medium",
    status: "pending",
    actionType: "email",
    domain: "business",
  },
];

// ── Mock Clients (for Clients tab demo) ───────────────────

export interface DemoClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string | null;
  city: string;
  tlv: number;
  sittings: number;
  nextAppointment: string | null;
  lastSeen: string;
  status: "active" | "lead" | "past_client" | "imported";
}

export const DEMO_CLIENTS: DemoClient[] = [
  {
    id: "demo-client-1",
    name: "Sarah Chen",
    email: "sarah@example.com",
    phone: "0412 345 678",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=60",
    city: "Sydney, NSW",
    tlv: 1200,
    sittings: 2,
    nextAppointment: "Aug 20 — Sleeve session 3",
    lastSeen: "2 days ago",
    status: "active",
  },
  {
    id: "demo-client-2",
    name: "Marcus Thorne",
    email: "marcus@example.com",
    phone: "0423 456 789",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&auto=format&fit=crop&q=60",
    city: "Melbourne, VIC",
    tlv: 800,
    sittings: 1,
    nextAppointment: null,
    lastSeen: "1 week ago",
    status: "past_client",
  },
  {
    id: "demo-client-3",
    name: "Elena Rodriguez",
    email: "elena@example.com",
    phone: "0434 567 890",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=60",
    city: "Gold Coast, QLD",
    tlv: 0,
    sittings: 0,
    nextAppointment: null,
    lastSeen: "3 days ago",
    status: "lead",
  },
];

// ── Mock Automated Reminders ──────────────────────────────

export interface DemoReminder {
  id: string;
  emoji: string;
  title: string;
  description: string;
  timing: string;
}

export const DEMO_REMINDERS: DemoReminder[] = [
  {
    id: "reminder-1",
    emoji: "📅",
    title: "Appointment reminder",
    description: "Automatically sent to the client",
    timing: "24h before session",
  },
  {
    id: "reminder-2",
    emoji: "💊",
    title: "Aftercare instructions",
    description: "Sent when you mark a session as complete",
    timing: "After session",
  },
  {
    id: "reminder-3",
    emoji: "💰",
    title: "Deposit nudge",
    description: "Gentle reminder if no payment received",
    timing: "48h after quote",
  },
];

// ── Mock Suppliers (for Suppliers tab demo) ────────────────

export const DEMO_SUPPLIERS = [
  {
    id: 8001,
    name: "Pro Tattoo Supply",
    url: "https://protattoosupply.com.au",
    productCount: 142,
    logoUrl: null,
  },
  {
    id: 8002,
    name: "Dr Pickles",
    url: "https://drpickles.com",
    productCount: 38,
    logoUrl: null,
  },
];
