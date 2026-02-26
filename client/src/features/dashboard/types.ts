export type TaskDomain = "business" | "social" | "personal";
export type Priority = "high" | "medium" | "low"; // Maps to Red, Orange, Green
export type ActionType =
  | "sms"
  | "email"
  | "social"
  | "internal"
  | "link"
  | "none";
export type TaskStatus = "pending" | "completed" | "dismissed" | "snoozed";

export interface DashboardTask {
  id: string;
  title: string;
  context?: string; // Subtitle
  domain: TaskDomain;
  priority: Priority;
  status: TaskStatus;

  // Dates
  dueDate: string; // ISO
  createdAt: string; // ISO

  // Source
  source: "system" | "template" | "user";

  // Action Logic
  actionType: ActionType;
  actionPayload?: string; // URL, Phone, Email, etc.
}

export interface ChallengeTemplate {
  id: string;
  title: string;
  description: string;
  durationDays: number;
  dailyTasks: {
    title: string;
    context?: string;
    priority: Priority;
  }[];
}

export interface DashboardEvent {
  type:
    | "task_shown"
    | "task_opened"
    | "task_completed"
    | "task_snoozed"
    | "task_dismissed"
    | "challenge_started"
    | "challenge_stopped"
    | "challenge_task_completed"
    | "handoff_opened";
  timestamp: number;
  meta?: any;
}

export interface SheetConfig {
  maxVisibleTasks: number; // Starts at 6
  lastWeekEvaluatedAt: string | null; // ISO Date of last capacity check
  consecutiveWeeksCleared: number;
}

export interface DashboardConfig {
  business: SheetConfig;
  social: SheetConfig;
  comms: {
    platform: "ios" | "android" | "desktop";
    preferredEmail: "default" | "gmail" | "outlook";
    preferredSms: "default";
  };
}
