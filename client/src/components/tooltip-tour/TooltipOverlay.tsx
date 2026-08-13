/**
 * TooltipOverlay — Renders spotlight + tooltip bubble
 * ────────────────────────────────────────────────────
 * Renders when a tour is active. Uses SVG mask for the
 * spotlight hole (supports rounded corners) with a pulse
 * ring for visual emphasis.
 *
 * Tooltip bubble styled to match the SSOT update banner:
 * bg-popover/95, backdrop-blur, border-border, shadow.
 */
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTooltipTour } from "./TooltipTourProvider";
import "./tooltipTour.css";

const PADDING = 8;  // padding around the spotlight hole
const RADIUS = 12;  // corner radius of the spotlight hole

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function TooltipOverlay() {
  const { activeTour, currentStep, getTarget, nextStep, skipTour } = useTooltipTour();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewportSize, setViewportSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Measure the target element
  const measureTarget = useCallback(() => {
    if (!activeTour) return;
    const step = activeTour.steps[currentStep];
    if (!step) return;

    const el = getTarget(step.targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
      });
    } else {
      setTargetRect(null);
    }
  }, [activeTour, currentStep, getTarget]);

  // Re-measure on step change, resize, scroll
  useEffect(() => {
    measureTarget();
    const handle = () => {
      setViewportSize({ w: window.innerWidth, h: window.innerHeight });
      measureTarget();
    };
    window.addEventListener("resize", handle);
    window.addEventListener("scroll", handle, true);
    // Re-measure periodically (for animated elements)
    const interval = setInterval(measureTarget, 300);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("scroll", handle, true);
      clearInterval(interval);
    };
  }, [measureTarget]);

  if (!activeTour) return null;

  const step = activeTour.steps[currentStep];
  if (!step) return null;

  const isLastStep = currentStep === activeTour.steps.length - 1;
  const position = step.position || "bottom";

  // Compute tooltip position relative to target
  let tooltipStyle: React.CSSProperties = {};
  let arrowClass = "";

  if (targetRect) {
    const bubbleWidth = Math.min(340, viewportSize.w - 40);

    if (position === "bottom") {
      tooltipStyle = {
        top: targetRect.top + targetRect.height + 16,
        left: Math.max(20, Math.min(
          targetRect.left + targetRect.width / 2 - bubbleWidth / 2,
          viewportSize.w - bubbleWidth - 20
        )),
      };
      arrowClass = "tooltip-tour-arrow-top";
    } else if (position === "top") {
      tooltipStyle = {
        bottom: viewportSize.h - targetRect.top + 16,
        left: Math.max(20, Math.min(
          targetRect.left + targetRect.width / 2 - bubbleWidth / 2,
          viewportSize.w - bubbleWidth - 20
        )),
      };
      arrowClass = "tooltip-tour-arrow-bottom";
    }
  } else {
    // No target found — center the tooltip
    tooltipStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
    };
  }

  return (
    <AnimatePresence>
      <motion.div
        key={`tour-${activeTour.id}-${currentStep}`}
        className="tooltip-tour-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* SVG mask for spotlight */}
        <svg>
          <defs>
            <mask id="tooltip-spotlight-mask">
              {/* White = visible (dimmed area) */}
              <rect width="100%" height="100%" fill="white" />
              {/* Black = transparent (spotlight hole) */}
              {targetRect && (
                <rect
                  x={targetRect.left}
                  y={targetRect.top}
                  width={targetRect.width}
                  height={targetRect.height}
                  rx={RADIUS}
                  ry={RADIUS}
                  fill="black"
                />
              )}
            </mask>
          </defs>

          {/* Dimmed background */}
          <rect
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.7)"
            mask="url(#tooltip-spotlight-mask)"
          />

          {/* Pulse ring around spotlight */}
          {targetRect && (
            <rect
              className="tooltip-tour-pulse-ring"
              x={targetRect.left - 3}
              y={targetRect.top - 3}
              width={targetRect.width + 6}
              height={targetRect.height + 6}
              rx={RADIUS + 3}
              ry={RADIUS + 3}
              fill="none"
              stroke="var(--primary, #7b5cf5)"
              strokeWidth="2"
            />
          )}
        </svg>

        {/* Tooltip bubble */}
        <motion.div
          className="tooltip-tour-bubble"
          style={tooltipStyle}
          initial={{ opacity: 0, y: position === "bottom" ? -8 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.2 }}
        >
          <div className="tooltip-tour-bubble-inner">
            {/* Arrow */}
            {targetRect && <div className={`tooltip-tour-arrow ${arrowClass}`} />}

            <p className="tooltip-tour-title">{step.title}</p>
            <p className="tooltip-tour-body">{step.body}</p>

            <div className="tooltip-tour-footer">
              {/* Step dots */}
              <div className="tooltip-tour-dots">
                {activeTour.steps.map((_, i) => (
                  <div
                    key={i}
                    className={`tooltip-tour-dot ${i === currentStep ? "active" : ""}`}
                  />
                ))}
              </div>

              {/* Actions */}
              <div className="tooltip-tour-actions">
                <button className="tooltip-tour-skip" onClick={skipTour}>
                  Skip
                </button>
                <button className="tooltip-tour-next" onClick={nextStep}>
                  {isLastStep ? "Done ✓" : "Next →"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
