import { DashboardConfig } from "./types";

const CONFIG_KEY = "dashboard_v1_config";

const DEFAULT_CONFIG: DashboardConfig = {
  business: {
    maxVisibleTasks: 6,
    lastWeekEvaluatedAt: null,
    consecutiveWeeksCleared: 0,
  },
  social: {
    maxVisibleTasks: 6,
    lastWeekEvaluatedAt: null,
    consecutiveWeeksCleared: 0,
  },
  comms: {
    platform: "ios", // Default Safe
    preferredEmail: "default",
    preferredSms: "default",
  },
};

export const DashboardConfigRegister = {
  getConfig: (): DashboardConfig => {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      return stored
        ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) }
        : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  },

  updateConfig: (updates: Partial<DashboardConfig>) => {
    const current = DashboardConfigRegister.getConfig();
    const next = { ...current, ...updates };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  },

  // Specific update for a sheet's config
  updateSheetConfig: (
    domain: "business" | "social",
    updates: Partial<DashboardConfig["business"]>
  ) => {
    const current = DashboardConfigRegister.getConfig();
    const next = {
      ...current,
      [domain]: { ...current[domain], ...updates },
    };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
    return next;
  },
};
