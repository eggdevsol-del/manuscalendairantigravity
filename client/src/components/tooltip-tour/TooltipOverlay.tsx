import { guideViewportBounds, placeGuide } from "./guidePlacement";
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
  const [owner, setOwner] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(180);
  const step = activeTour?.steps[currentStep];
  useEffect(() => {
    if (!step) return;
    let target: HTMLElement | null = null;
    const measure = () => {
      if (bubble.current) setHeight(bubble.current.scrollHeight);
      const el = getTarget(step.targetId);
      if (el && el !== target) {
        target?.removeAttribute("data-tour-current-target");
        target = el;
        el.setAttribute("data-tour-current-target", step.targetId);
        const box = el.getBoundingClientRect();
        const outside =
          box.top < 12 ||
          box.bottom > innerHeight - 90 ||
          box.left < 0 ||
          box.right > innerWidth;
        if (outside && !el.dataset.tourRepeat)
          el.scrollIntoView({
            block: "center",
            inline: "nearest",
            behavior: "auto",
          });
      }
      const dialog =
        el?.closest<HTMLElement>('[role="dialog"],[role="alertdialog"]') ||
        null;
      setOwner(dialog);
      const box = el?.getBoundingClientRect();
      const nextRect = box
        ? {
            top: box.top - 6,
            left: box.left - 6,
            width: box.width + 12,
            height: box.height + 12,
          }
        : null;
      setRect(previous =>
        JSON.stringify(previous) === JSON.stringify(nextRect)
          ? previous
          : nextRect
      );
      const nextBounds = guideViewportBounds(dialog);
      setBounds(previous =>
        JSON.stringify(previous) === JSON.stringify(nextBounds)
          ? previous
          : nextBounds
      );
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        skipTour();
      }
    };
    measure();
    let frame = 0;
    const follow = () => {
      measure();
      frame = requestAnimationFrame(follow);
    };
    frame = requestAnimationFrame(follow);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    window.addEventListener("keydown", escape, true);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      target?.removeAttribute("data-tour-current-target");
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.removeEventListener("keydown", escape, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [step, getTarget, skipTour]);
  useEffect(() => {
    if (!bubble.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setHeight((entry.target as HTMLElement).scrollHeight)
    );
    observer.observe(bubble.current);
    return () => observer.disconnect();
  }, [activeTour?.id, owner, collapsed]);
  useEffect(() => {
    if (!activeTour) return;
    const dismissOutside = (event: PointerEvent) => {
      if (!bubble.current?.contains(event.target as Node)) skipTour();
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    return () =>
      document.removeEventListener("pointerdown", dismissOutside, true);
  }, [!!activeTour, skipTour]);
  useEffect(() => {
    if (!activeTour) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() =>
      bubble.current?.focus({ preventScroll: true })
    );
    return () => {
      cancelAnimationFrame(frame);
      if (
        previous?.isConnected &&
        !previous.closest('[inert],[aria-hidden="true"]')
      )
        previous.focus({ preventScroll: true });
    };
  }, [!!activeTour]);
  if (!activeTour || !step) return null;
  const { width, maxHeight, left, top } = placeGuide(
    rect,
    bounds,
    { width: 320, height },
    step.position
  );
  const offset = owner?.getBoundingClientRect();
  const localTop = top - (offset?.top || 0) + (owner?.scrollTop || 0);
  const localLeft = left - (offset?.left || 0) + (owner?.scrollLeft || 0);
  return createPortal(
    <div
      className="tooltip-tour-backdrop"
      data-tour-ui
      onClick={event => event.stopPropagation()}
      data-tour-id={activeTour.id}
      style={owner ? { position: "absolute", zIndex: 9990 } : undefined}
    >
      {!owner && (
        <svg aria-hidden="true">
          <defs>
            <mask id="tour-spotlight">
              <rect width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  {...rect}
                  x={rect.left}
                  y={rect.top}
                  rx="12"
                  fill="black"
                />
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
      )}
      {owner && rect && (
        <div
          aria-hidden="true"
          className="tooltip-tour-local-ring"
          style={{
            left: rect.left - (offset?.left || 0),
            top: rect.top - (offset?.top || 0),
            width: rect.width,
            height: rect.height,
          }}
        />
      )}
      <div
        ref={bubble}
        className="tooltip-tour-bubble"
        data-tour-target={step.targetId}
        data-collapsed={collapsed}
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        style={{
          top: localTop,
          left: localLeft,
          width,
          maxHeight,
          overflowY: "auto",
          position: owner ? "absolute" : "fixed",
        }}
      >
        <div className="tooltip-tour-bubble-inner">
          <button
            type="button"
            className="tooltip-tour-collapse"
            aria-label={collapsed ? "Expand guide" : "Minimise guide"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(value => !value)}
          >
            {collapsed ? "+" : "−"}
          </button>
          <p aria-live="polite" id="tour-title" className="tooltip-tour-title">
            {step.title}
          </p>
          {!collapsed && <p className="tooltip-tour-body">{step.body}</p>}
          {!rect && !collapsed && (
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
                Close guide
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
    // Stay inside the owning portalled dialog so its focus trap and inertness
    // continue to protect the background while the guide remains operable.
    owner || document.body
  );
}
