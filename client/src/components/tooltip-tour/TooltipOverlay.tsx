import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTooltipTour } from "./TooltipTourProvider";
import "./tooltipTour.css";

type Rect = { top: number; left: number; width: number; height: number };
/** Original spotlight/bubble presentation, anchored to the current live control. */
export function TooltipOverlay() {
  const {
    activeTour,
    currentStep,
    getTarget,
    nextStep,
    previousStep,
    skipTour,
  } = useTooltipTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const [bounds, setBounds] = useState({
    left: 12,
    top: 12,
    right: innerWidth - 12,
    bottom: innerHeight - 100,
  });
  const bubble = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(180);
  const step = activeTour?.steps[currentStep];
  useEffect(() => {
    if (!step) return;
    let target: HTMLElement | null = null;
    const measure = () => {
      const el = getTarget(step.targetId);
      if (el && el !== target) {
        target = el;
        el.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "auto",
        });
      }
      const box = el?.getBoundingClientRect();
      setRect(
        box
          ? {
              top: box.top - 6,
              left: box.left - 6,
              width: box.width + 12,
              height: box.height + 12,
            }
          : null
      );
      const view = window.visualViewport;
      const style = getComputedStyle(document.documentElement);
      const safe = (name: string) =>
        parseFloat(style.getPropertyValue(name)) || 0;
      const top = (view?.offsetTop || 0) + Math.max(12, safe("--app-safe-top"));
      const left =
        (view?.offsetLeft || 0) + Math.max(12, safe("--app-safe-left"));
      const right =
        (view?.offsetLeft || 0) +
        (view?.width || innerWidth) -
        Math.max(12, safe("--app-safe-right"));
      const nav = document
        .getElementById("bottom-nav")
        ?.getBoundingClientRect();
      const bottom = Math.min(
        (view?.offsetTop || 0) +
          (view?.height || innerHeight) -
          Math.max(12, safe("--app-safe-bottom")),
        nav?.top && nav.top > top ? nav.top - 12 : Infinity
      );
      setBounds({ top, left, right, bottom });
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipTour();
    };
    measure();
    const timer = setInterval(measure, 200);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    window.addEventListener("keydown", escape);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      clearInterval(timer);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.removeEventListener("keydown", escape);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [step, getTarget, skipTour]);
  useEffect(() => {
    if (!bubble.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setHeight(entry.target.getBoundingClientRect().height)
    );
    observer.observe(bubble.current);
    return () => observer.disconnect();
  }, [activeTour?.id]);
  if (!activeTour || !step) return null;
  const width = Math.min(320, bounds.right - bounds.left);
  const maxHeight = Math.max(80, bounds.bottom - bounds.top);
  const actualHeight = Math.min(height, maxHeight);
  let left = rect ? rect.left + rect.width / 2 - width / 2 : bounds.left;
  let top = rect ? rect.top + rect.height + 14 : bounds.top;
  if (rect && (step.position === "top" || top + actualHeight > bounds.bottom))
    top = rect.top - actualHeight - 14;
  if (
    rect &&
    (step.position === "right" || rect.width > width) &&
    rect.left + rect.width + 14 + width <= bounds.right
  ) {
    left = rect.left + rect.width + 14;
    top = rect.top;
  }
  left = Math.max(bounds.left, Math.min(left, bounds.right - width));
  top = Math.max(bounds.top, Math.min(top, bounds.bottom - actualHeight));
  return createPortal(
    <div className="tooltip-tour-backdrop" data-tour-id={activeTour.id}>
      <svg aria-hidden="true">
        <defs>
          <mask id="tour-spotlight">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect {...rect} x={rect.left} y={rect.top} rx="12" fill="black" />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,.35)"
          mask="url(#tour-spotlight)"
        />
        {rect && (
          <rect
            className="tooltip-tour-pulse-ring"
            x={rect.left}
            y={rect.top}
            width={rect.width}
            height={rect.height}
            rx="12"
            fill="none"
            stroke="var(--v3-gold)"
            strokeWidth="2"
          />
        )}
      </svg>
      <div
        ref={bubble}
        className="tooltip-tour-bubble"
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        style={{ top, left, width, maxHeight, overflowY: "auto" }}
      >
        <div className="tooltip-tour-bubble-inner">
          <p id="tour-title" className="tooltip-tour-title">
            {step.title}
          </p>
          <p className="tooltip-tour-body">{step.body}</p>
          {!rect && (
            <p className="tooltip-tour-body" role="status">
              Open the section or control described above to continue. If it
              isn’t available for this account, skip this tour.
            </p>
          )}
          <div className="tooltip-tour-footer">
            <span aria-live="polite">
              {currentStep + 1} / {activeTour.steps.length}
            </span>
            <div className="tooltip-tour-actions">
              {currentStep > 0 && (
                <button className="tooltip-tour-skip" onClick={previousStep}>
                  Back
                </button>
              )}
              <button className="tooltip-tour-skip" onClick={skipTour}>
                Skip
              </button>
              <button
                className="tooltip-tour-next"
                disabled={!rect}
                onClick={nextStep}
              >
                {currentStep === activeTour.steps.length - 1 ? "Done" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
