/**
 * HowTosSettings — Settings panel listing available tooltip tours
 * ────────────────────────────────────────────────────────────────
 * Users can view, replay, or reset completed tours from here.
 * Selecting a tour navigates to the relevant page and starts it.
 */
import React from "react";
import { useTooltipTour, getToursForRole, type TourConfig } from "@/components/tooltip-tour";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import {
  UserCircle, Calendar, Compass, Settings, ChevronRight, RotateCcw, CheckCircle2,
} from "lucide-react";

const ICON_MAP: Record<string, React.ElementType> = {
  UserCircle,
  Calendar,
  Compass,
  Settings,
};

interface HowTosSettingsProps {
  onBack: () => void;
}

export function HowTosSettings({ onBack }: HowTosSettingsProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { isTourCompleted, resetTour, startTour } = useTooltipTour();

  const role = user?.role === "artist" ? "artist" : "client";
  const tours = getToursForRole(role);

  const handleStartTour = (tour: TourConfig) => {
    // Reset so it can be replayed
    if (isTourCompleted(tour.id)) {
      resetTour(tour.id);
    }
    // Navigate to the tour's page
    setLocation(tour.route);
    // Small delay for page to mount, then startTour is triggered by page component
    onBack();
  };

  return (
    <div style={{ padding: "0 16px" }}>
      {/* Back header */}
      <button
        onClick={onBack}
        style={{
          background: "none", border: "none", color: "var(--foreground)",
          fontSize: 14, fontWeight: 600, cursor: "pointer",
          display: "flex", alignItems: "center", gap: 4, padding: "12px 0",
        }}
      >
        ← How to&apos;s
      </button>

      <p style={{
        fontSize: 13, color: "var(--muted-foreground, #888)",
        margin: "0 0 16px", lineHeight: 1.5,
      }}>
        Guided walkthroughs to help you get the most out of the app.
        Tap any item to replay it.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tours.map((tour) => {
          const completed = isTourCompleted(tour.id);
          const Icon = ICON_MAP[tour.icon] || UserCircle;

          return (
            <button
              key={tour.id}
              onClick={() => handleStartTour(tour)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "var(--popover, rgba(30,30,30,0.6))",
                border: "1px solid var(--border, rgba(255,255,255,0.1))",
                borderRadius: "var(--radius-md, 12px)",
                padding: "14px 14px",
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: "var(--radius-sm, 8px)",
                background: completed
                  ? "rgba(34, 197, 94, 0.15)"
                  : "rgba(123, 92, 245, 0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <Icon size={20} style={{
                  color: completed ? "rgba(34, 197, 94, 1)" : "rgba(123, 92, 245, 1)",
                }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: "var(--foreground)",
                  lineHeight: 1.3,
                }}>
                  {tour.label}
                </div>
                <div style={{
                  fontSize: 12, color: "var(--muted-foreground, #888)",
                  lineHeight: 1.4, marginTop: 2,
                }}>
                  {tour.description}
                </div>
              </div>

              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                {completed && (
                  <CheckCircle2 size={14} style={{ color: "rgba(34, 197, 94, 0.8)" }} />
                )}
                <ChevronRight size={16} style={{ color: "var(--muted-foreground, #888)" }} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
