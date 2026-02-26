import { ChallengeTemplate, DashboardTask } from "./types";

// Simple ID generator
const generateId = () => Math.random().toString(36).substring(2, 15);

// Expanded Source Data containing 'Action Payloads' for V1 Demo
export const BUSINESS_DEFAULTS: Omit<
  DashboardTask,
  "id" | "status" | "dueDate" | "createdAt" | "source"
>[] = [
  {
    title: "Consult Follow-up",
    context: "Check pending inquiries",
    priority: "high",
    domain: "business",
    actionType: "internal",
    actionPayload: "/inbox",
  },
  {
    title: "Deposit Due",
    context: "Verify payments",
    priority: "high",
    domain: "business",
    actionType: "internal",
    actionPayload: "/finance",
  },
  {
    title: "Upcoming Confirm",
    context: "Send confirmation texts",
    priority: "medium",
    domain: "business",
    actionType: "sms",
    actionPayload: "",
  }, // Empty payload suggests "Use Client List" logic later, or generic
  {
    title: "Post-Sitting Check",
    context: "Ask for healed photos",
    priority: "medium",
    domain: "business",
    actionType: "sms",
    actionPayload: "",
  },
  {
    title: "Supplies Check",
    context: "Inventory run needed?",
    priority: "low",
    domain: "business",
    actionType: "none",
  },
];

export const SOCIAL_DEFAULTS: Omit<
  DashboardTask,
  "id" | "status" | "dueDate" | "createdAt" | "source"
>[] = [
  {
    title: "Post Reel",
    context: "Showcase recent work",
    priority: "high",
    domain: "social",
    actionType: "social",
    actionPayload: "https://instagram.com",
  },
  {
    title: "Story Availability",
    context: "Post open slots",
    priority: "medium",
    domain: "social",
    actionType: "social",
    actionPayload: "https://instagram.com",
  },
  {
    title: "Post Healed Work",
    context: "Tag clients",
    priority: "medium",
    domain: "social",
    actionType: "social",
    actionPayload: "https://instagram.com",
  },
  {
    title: "Engage Client Lists",
    context: "Reply to comments/DMs",
    priority: "low",
    domain: "social",
    actionType: "social",
    actionPayload: "https://instagram.com",
  },
];

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: "75_hard_lite",
    title: "75 Hard Lite",
    description: "A mental toughness challenge for busy artists.",
    durationDays: 75,
    dailyTasks: [
      {
        title: "45min Workout",
        context: "Any movement counts",
        priority: "high",
      },
      { title: "Drink 3L Water", context: "Stay hydrated", priority: "medium" },
      { title: "Read 10 Pages", context: "Non-fiction only", priority: "low" },
      { title: "Progress Photo", context: "Daily check-in", priority: "low" },
    ],
  },
  {
    id: "daily_walk",
    title: "Daily Walk",
    description: "Clear your mind with a daily stroll.",
    durationDays: 30,
    dailyTasks: [
      {
        title: "30min Walk",
        context: "No phone, just walk",
        priority: "medium",
      },
    ],
  },
  {
    id: "content_machine",
    title: "Content Machine",
    description: "Boost your social presence in 30 days.",
    durationDays: 30,
    dailyTasks: [
      { title: "Film Process", context: "Capture 5 clips", priority: "high" },
      { title: "Edit & Post", context: "Reel or TikTok", priority: "medium" },
    ],
  },
];

export const DashboardTaskRegister = {
  generateDailyTasks: (domain: "business" | "social"): DashboardTask[] => {
    const source = domain === "business" ? BUSINESS_DEFAULTS : SOCIAL_DEFAULTS;

    // V1 Demo: Pick 3-5 random tasks to simulate variety
    // In real app, this would be intelligent
    const shuffled = [...source].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3 + Math.floor(Math.random() * 2));

    return selected.map(t => ({
      ...t,
      id: generateId(),
      status: "pending",
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      source: "system",
    }));
  },

  generateChallengeTasks: (template: ChallengeTemplate): DashboardTask[] => {
    return template.dailyTasks.map(t => ({
      ...t,
      id: generateId(),
      domain: "personal",
      status: "pending",
      dueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      source: "template",
      actionType: "none",
    }));
  },
};
