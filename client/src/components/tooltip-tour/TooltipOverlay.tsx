import { createPortal } from "react-dom";
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
import React, { useState, useEffect, useCallback, useRef } from "react";
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
  const bubbleRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activeTour) return;
    const previous = document.activeElement as HTMLElement | null;
    const timer = setTimeout(() => bubbleRef.current?.focus(), 650);
    return () => { clearTimeout(timer); if (previous?.isConnected) previous.focus(); };
  }, [activeTour?.id, currentStep]);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [viewportSize, setViewportSize] = useState({
    w: document.documentElement.clientWidth,
    h: document.documentElement.clientHeight,
  });

  // Scroll target into view then measure it
  const scrollAndMeasure = useCallback(() => {
    if (!activeTour) return;
    const step = activeTour.steps[currentStep];
    if (!step) return;

    const el = getTarget(step.targetId);
    if (el) {
      // Scroll into view first, then measure after scroll settles
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Delay measurement to let scroll animation finish
      setTimeout(() => {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top - PADDING,
          left: rect.left - PADDING,
          width: rect.width + PADDING * 2,
          height: rect.height + PADDING * 2,
        });
      }, 350);
    } else {
      setTargetRect(null);
    }
  }, [activeTour, currentStep, getTarget]);

  // Silent re-measure (no scroll — for resize/scroll listeners)
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

  // Scroll + measure on step change; silent re-measure on resize/scroll
  useEffect(() => {
    scrollAndMeasure();
    const handle = () => {
      setViewportSize({
        w: document.documentElement.clientWidth,
        h: document.documentElement.clientHeight,
      });
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
  }, [scrollAndMeasure, measureTarget]);

  if (!activeTour) return null;

  const step = activeTour.steps[currentStep];
  if (!step) return null;

  const isLastStep = currentStep === activeTour.steps.length - 1;
  const position = step.position || "bottom";

  // Keep the guide in the opposite half from the spotlight. CSS resolves the
  // actual safe-area values in Safari, including landscape and split view.
  const useTop = targetRect && targetRect.top > viewportSize.h / 2;
  const tooltipStyle: React.CSSProperties = {
    left: "max(20px, var(--app-safe-left))",
    right: "max(20px, var(--app-safe-right))",
    marginInline: "auto",
    width: "min(320px, calc(100vw - var(--app-safe-left) - var(--app-safe-right) - 40px))",
    ...(useTop ? { top: "calc(var(--app-safe-top) + 20px)" } : { bottom: "calc(var(--app-safe-bottom) + 84px)" }),
    maxHeight: "calc(100dvh - var(--app-safe-top) - var(--app-safe-bottom) - 124px)",
    overflowY: "auto",
  };

  return createPortal(
    <AnimatePresence mode="wait">
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
          ref={bubbleRef}
          tabIndex={-1}
          onKeyDown={event => {
            if (event.key === "Escape") { event.preventDefault(); skipTour(); }
            if (event.key === "Tab") {
              const buttons = bubbleRef.current?.querySelectorAll<HTMLButtonElement>("button");
              if (!buttons?.length) return;
              const first = buttons[0], last = buttons[buttons.length - 1];
              if (event.shiftKey && (document.activeElement === first || document.activeElement === bubbleRef.current)) { event.preventDefault(); last.focus(); }
              else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
            }
          }}
          role="dialog"
          aria-label={step.title}
          aria-modal="true"
          style={tooltipStyle}
          initial={{ opacity: 0, y: position === "bottom" ? -8 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.2 }}
        >
          <div className="tooltip-tour-bubble-inner">
            {/* Arrow */}


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
    </AnimatePresence>, document.body
  );
}
