import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { ChevronDown, Info } from "lucide-react";

interface AftercareTimelineProps {
  appointmentId: number;
  completedAt: string;
  artistId: string;
  artistName: string;
  conversationId: number | null;
}

interface Phase {
  id: number;
  fromDay: number;
  toDay: number;
  label: string;
  instruction: string;
  sortOrder: number;
}

export function AftercareTimeline({
  appointmentId,
  completedAt,
  artistId,
  artistName,
  conversationId,
}: AftercareTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const [, setLocation] = useLocation();

  const { data: aftercareData } = trpc.aftercare.getForBooking.useQuery({
    appointmentId,
  });

  if (!aftercareData || !aftercareData.template) return null;

  const { template, daysSince, totalDays, isHealed } = aftercareData;
  const phases: Phase[] = template.phases || [];

  if (phases.length === 0) return null;

  // Find current phase
  const currentPhase = phases.find(
    (p) => daysSince >= p.fromDay && daysSince <= p.toDay
  );
  const todaysCopy = currentPhase?.instruction || phases[phases.length - 1]?.instruction || "";
  const currentPhaseLabel = isHealed
    ? "Healed"
    : currentPhase?.label || "Settling";

  // Clamp display day
  const displayDay = Math.min(daysSince, totalDays);

  return (
    <div
      style={{
        borderRadius: 12,
        background: "rgba(74,222,128,0.08)",
        border: "1px solid rgba(74,222,128,0.25)",
        padding: "12px 14px 0",
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-bold uppercase"
          style={{ color: "var(--color-success)", letterSpacing: "0.08em" }}
        >
          AFTERCARE · DAY {displayDay} OF {totalDays}
        </span>
        <span
          className="text-[11px] font-semibold"
          style={{ color: "var(--color-success)" }}
        >
          {currentPhaseLabel}
        </span>
      </div>

      {/* Today's instruction */}
      <p
        className="text-[13px] leading-relaxed mb-0"
        style={{ color: "color-mix(in srgb, var(--foreground) 78%, transparent)" }}
      >
        {todaysCopy}
      </p>

      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-center gap-1.5 w-full text-[12px] font-semibold"
        style={{
          color: "var(--color-success)",
          padding: "11px 0 12px",
          minHeight: 44,
        }}
      >
        {expanded ? "Hide full timeline" : "See full aftercare timeline"}
        <ChevronDown
          className="w-3.5 h-3.5 transition-transform duration-200"
          style={{
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Expanded timeline */}
      {expanded && (
        <div className="pb-3">
          {phases.map((phase, idx) => {
            const isDone = daysSince > phase.toDay;
            const isCurrent =
              daysSince >= phase.fromDay && daysSince <= phase.toDay;
            const isFuture = daysSince < phase.fromDay;
            const isLast = idx === phases.length - 1;

            // Dot colours
            const dotBg = isDone
              ? "var(--color-success)"
              : isCurrent
              ? "var(--primary)"
              : "var(--card)";
            const dotBorder = isDone
              ? "var(--color-success)"
              : isCurrent
              ? "var(--primary)"
              : "color-mix(in srgb, var(--foreground) 18%, transparent)";
            const connectorColor = isDone
              ? "rgba(74,222,128,.35)"
              : "color-mix(in srgb, var(--foreground) 10%, transparent)";

            // Status label
            const status = isDone
              ? "DONE"
              : isCurrent
              ? "TODAY"
              : "AHEAD";
            const statusColor = isDone
              ? "var(--color-success)"
              : isCurrent
              ? "var(--primary)"
              : "var(--muted-foreground)";

            // Window label color
            const windowColor = isCurrent ? "var(--primary)" : "var(--foreground)";

            return (
              <div key={phase.id} className="flex gap-3" style={{ minHeight: 8 }}>
                {/* Rail: dot + connector */}
                <div className="flex flex-col items-center shrink-0" style={{ width: 11 }}>
                  {/* Dot */}
                  <div
                    className="shrink-0"
                    style={{
                      width: 11,
                      height: 11,
                      borderRadius: "50%",
                      background: dotBg,
                      border: `2px solid ${dotBorder}`,
                      marginTop: 2,
                    }}
                  />
                  {/* Connector line */}
                  {!isLast && (
                    <div
                      className="flex-1"
                      style={{
                        width: 2,
                        background: connectorColor,
                        minHeight: 8,
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-3" style={{ gap: 11 }}>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className="text-[12.5px] font-bold"
                      style={{ color: windowColor }}
                    >
                      Day {phase.fromDay}–{phase.toDay}
                    </span>
                    <span
                      className="text-[10.5px] font-semibold uppercase"
                      style={{ color: statusColor, letterSpacing: "0.06em" }}
                    >
                      {status}
                    </span>
                  </div>
                  <p
                    className="text-[12.5px] leading-relaxed"
                    style={{ color: "color-mix(in srgb, var(--foreground) 70%, transparent)" }}
                  >
                    {phase.instruction}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Footer note */}
          <div
            className="flex items-start gap-2 mt-1"
            style={{
              borderRadius: 10,
              background: "color-mix(in srgb, var(--foreground) 4%, transparent)",
              padding: "10px 12px",
            }}
          >
            <Info
              className="w-3.5 h-3.5 shrink-0 mt-0.5"
              style={{ color: "var(--muted-foreground)" }}
            />
            <p className="text-[12px] text-[var(--muted-foreground)]">
              Something looks wrong?{" "}
              <button
                onClick={() => {
                  if (conversationId) setLocation(`/chat/${conversationId}`);
                }}
                className="font-bold text-foreground underline-offset-2 hover:underline"
              >
                Message {artistName}
              </button>{" "}
              with a photo.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
