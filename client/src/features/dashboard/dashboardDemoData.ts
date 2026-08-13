/**
 * Dashboard Demo Data — Mock data shown only during the dashboard tooltip tour
 * ─────────────────────────────────────────────────────────────────────────────
 * All mock data in one file. Only rendered when isDemoMode === true.
 * Reverts to real data the moment the tour ends.
 */
import type { ExtendedTask } from "@/pages/Dashboard";

// ── Mock Business Tasks ───────────────────────────────────

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

// ── Mock Orders ───────────────────────────────────────────

export interface DemoOrder {
  id: number;
  customerName: string;
  customerEmail: string;
  item: string;
  amount: number;
  status: "paid" | "pending" | "fulfilled";
  createdAt: string;
  quantity: number;
}

export const DEMO_ORDERS: DemoOrder[] = [
  {
    id: 9001,
    customerName: "Sarah Chen",
    customerEmail: "sarah@example.com",
    item: "Custom flash sheet",
    amount: 85,
    status: "paid",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    quantity: 1,
  },
  {
    id: 9002,
    customerName: "Marcus T",
    customerEmail: "marcus@example.com",
    item: "Aftercare bundle × 2",
    amount: 42,
    status: "pending",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    quantity: 2,
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

// ── Mock Suppliers (for Contacts demo) ────────────────────

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

// ── Mock Artists (for Contacts demo) ──────────────────────

export const DEMO_ARTISTS = [
  {
    id: "demo-artist-1",
    name: "Sarah Chen",
    style: "Fineline / Floral",
    location: "Sydney, NSW",
  },
  {
    id: "demo-artist-2",
    name: "Marcus Thorne",
    style: "Traditional",
    location: "Melbourne, VIC",
  },
];
