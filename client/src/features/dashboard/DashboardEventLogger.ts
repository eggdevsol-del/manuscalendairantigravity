import { DashboardEvent } from "./types";

const LOCAL_STORAGE_KEY = "dashboard_v1_events";

export const DashboardEventLogger = {
  log: (type: DashboardEvent["type"], meta?: any) => {
    try {
      const event: DashboardEvent = {
        type,
        timestamp: Date.now(),
        meta,
      };

      const existing = JSON.parse(
        localStorage.getItem(LOCAL_STORAGE_KEY) || "[]"
      );
      existing.push(event);

      // Keep log size manageable (last 1000 events)
      if (existing.length > 1000) {
        existing.shift();
      }

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existing));

      // Dev check
      if (process.env.NODE_ENV === "development") {
        console.log(`[DashboardEvent] ${type}`, meta);
      }
    } catch (e) {
      console.error("Failed to log dashboard event", e);
    }
  },

  getLogs: (): DashboardEvent[] => {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  },
};
