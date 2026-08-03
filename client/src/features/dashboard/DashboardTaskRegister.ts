import { ChallengeTemplate, DashboardTask } from "./types";

// Deprecated mock task generators removed.
// All tasks now stem strictly from real database entities via businessTaskGenerator.ts.

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
    return [];
  },

  generateChallengeTasks: (_template: ChallengeTemplate): DashboardTask[] => {
    return [];
  },
};
