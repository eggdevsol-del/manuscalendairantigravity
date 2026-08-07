import { ChallengeTemplate, DashboardTask } from "./types";

// Simple ID generator
const generateId = () => Math.random().toString(36).substring(2, 15);

// ── Deprecated: Static task templates removed ──
// All business & social tasks are now generated server-side by
// businessTaskGenerator.ts via the Revenue Protection Algorithm.
// These stubs remain for API compatibility only.

export const BUSINESS_DEFAULTS: Omit<
  DashboardTask,
  "id" | "status" | "dueDate" | "createdAt" | "source"
>[] = [];

export const SOCIAL_DEFAULTS: Omit<
  DashboardTask,
  "id" | "status" | "dueDate" | "createdAt" | "source"
>[] = [];

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [];

export const DashboardTaskRegister = {
  generateDailyTasks: (_domain: "business" | "social"): DashboardTask[] => {
    // All tasks now come from the server-side task generator
    return [];
  },

  generateChallengeTasks: (_template: ChallengeTemplate): DashboardTask[] => {
    // Challenges deprecated — placeholder for future implementation
    return [];
  },
};
