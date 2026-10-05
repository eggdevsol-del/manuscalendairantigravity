import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { controlLabel } from "@/components/tooltip-tour/contextualTargets";
import { PRACTICE_TOURS } from "@shared/practiceTours";
import { PRACTICE_CHAPTERS, type PracticeState } from "@shared/practice";
import type { PracticeResolver } from "./PracticeControls";

/** Highlights actual DOM controls. Successful mutations, not guide buttons, complete save steps. */
export function PracticeFlowGuide({
  state,
  resolve,
}: {
  state: PracticeState;
  resolve: PracticeResolver;
}) {
  const [, go] = useLocation();
  const chapterId = state.chapterId || "enquiry";
  const tour = PRACTICE_TOURS[chapterId];
  const storedCursor =
    state.sandbox?.guide?.chapterId === chapterId
      ? state.sandbox.guide.cursor
      : 0;
  const [cursor, setCursor] = useState(storedCursor);
  const cursorRef = useRef(cursor);
  const saving = useRef(0);
  useEffect(() => {
    if (!saving.current) {
      cursorRef.current = storedCursor;
      setCursor(storedCursor);
    }
  }, [storedCursor]);
  const step = tour?.steps[cursor];
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [above, setAbove] = useState(false);
  const [spotlight, setSpotlight] = useState<{
    top: number;
    left: number;
    right: number;
    bottom: number;
  } | null>(null);
  const latest = useRef({ resolve, cursor, chapterId });
  latest.current = { resolve, cursor, chapterId };
  const advance = async () => {
    saving.current++;
    const nextCursor = cursorRef.current + 1;
    cursorRef.current = nextCursor;
    setCursor(nextCursor);
    setBusy(true);
    setError("");
    try {
      const v = latest.current;
      await v.resolve(
        "practice.guideProgress",
        { chapterId: v.chapterId, cursor: nextCursor },
        "mutation"
      );
    } catch (e) {
      cursorRef.current = storedCursor;
      setCursor(storedCursor);
      setError(
        e instanceof Error
          ? e.message
          : "Could not save guide progress. Please retry."
      );
    } finally {
      saving.current--;
      setBusy(saving.current > 0);
    }
  };
  useEffect(() => {
    if (step?.route) go(step.route);
  }, [chapterId, cursor, go]);
  useEffect(() => {
    setHidden(false);
    const regex = step?.target ? new RegExp(step.target, "i") : null;
    const scan = () => {
      if (!regex) {
        setTarget(null);
        return;
      }
      const sheets = Array.from(
        document.querySelectorAll<HTMLElement>("[data-practice-surface]")
      );
      const root =
        sheets.at(-1) ||
        document.querySelector<HTMLElement>("[data-practice-app]");
      const controls = Array.from(
        root?.querySelectorAll<HTMLElement>(
          "button,a[href],input,select,textarea,label,h2,h3,[data-tour-title],.v3-facts"
        ) || []
      );
      const eligible = controls.filter(
        el =>
          !el.closest('[data-practice-guide],[hidden],[aria-hidden="true"]') &&
          getComputedStyle(el).display !== "none" &&
          !el.hasAttribute("disabled")
      );
      setTarget(eligible.find(el => regex.test(controlLabel(el))) || null);
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "aria-hidden", "style"],
    });
    const click = (event: Event) => {
      const el = event.target as HTMLElement;
      const control = el.closest<HTMLElement>(
        "button,a[href],input,select,textarea"
      );
      const matches =
        !!control &&
        !control.closest("[data-practice-guide]") &&
        !!regex?.test(controlLabel(control));
      if (
        !(target?.contains(el) || matches) ||
        step?.review ||
        step?.mutation ||
        step?.simulation
      )
        return;
      // Inputs do not complete on focus; wait for their change event.
      if (control?.matches("input,select,textarea") && event.type !== "change")
        return;
      void advance();
    };
    const success = (event: Event) => {
      const operation = (event as CustomEvent).detail;
      if (
        step?.mutation &&
        !operation.data?.requiresApproval &&
        new RegExp(`^(?:${step.mutation})$`).test(operation.path)
      )
        void advance();
    };
    document.addEventListener("click", click);
    document.addEventListener("change", click);
    document.addEventListener("practice-operation-success", success);
    return () => {
      observer.disconnect();
      document.removeEventListener("click", click);
      document.removeEventListener("change", click);
      document.removeEventListener("practice-operation-success", success);
    };
  }, [chapterId, cursor, step, target]);
  useEffect(() => {
    if (!target || hidden) {
      setSpotlight(null);
      return;
    }
    const place = () => {
      const r = target.getBoundingClientRect();
      setAbove(r.top > window.innerHeight * 0.5);
      setSpotlight({
        top: Math.max(0, r.top - 8),
        left: Math.max(0, r.left - 8),
        right: Math.min(window.innerWidth, r.right + 8),
        bottom: Math.min(window.innerHeight, r.bottom + 8),
      });
    };
    target.classList.add("practice-highlight");
    target.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    place();
    const resize =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(place) : null;
    resize?.observe(target);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      resize?.disconnect();
      target.classList.remove("practice-highlight");
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [target, hidden]);
  useEffect(() => {
    const show = () => setHidden(false);
    document.addEventListener("practice-open-control-guide", show);
    return () =>
      document.removeEventListener("practice-open-control-guide", show);
  }, []);
  const simulate = async () => {
    setBusy(true);
    setError("");
    try {
      await resolve(
        "practice.clientOutcome",
        { outcome: step?.simulation },
        "mutation"
      );
      await advance();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not continue. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };
  const title = PRACTICE_CHAPTERS.find(c => c.id === chapterId)?.title;
  return createPortal(
    <>
      {step && !hidden && (
        <div
          className="practice-spotlight"
          aria-hidden="true"
          data-practice-guide
        >
          {spotlight ? (
            <>
              <div
                style={{ top: 0, left: 0, right: 0, height: spotlight.top }}
              />
              <div
                style={{
                  top: spotlight.top,
                  left: 0,
                  width: spotlight.left,
                  height: Math.max(0, spotlight.bottom - spotlight.top),
                }}
              />
              <div
                style={{
                  top: spotlight.top,
                  left: spotlight.right,
                  right: 0,
                  height: Math.max(0, spotlight.bottom - spotlight.top),
                }}
              />
              <div
                style={{ top: spotlight.bottom, left: 0, right: 0, bottom: 0 }}
              />
              <span
                className="practice-spotlight-ring"
                style={{
                  top: spotlight.top,
                  left: spotlight.left,
                  width: Math.max(0, spotlight.right - spotlight.left),
                  height: Math.max(0, spotlight.bottom - spotlight.top),
                }}
              />
            </>
          ) : (
            <div style={{ inset: 0 }} />
          )}
        </div>
      )}
      <aside
        className="practice-flow-guide"
        style={above && !hidden ? { top: 64, bottom: "auto" } : undefined}
        data-practice-guide
        aria-label="Guided tutorial"
        aria-live="polite"
      >
        <div className="practice-flow-heading">
          <span>Guide · {title}</span>
          <button
            onClick={() => setHidden(!hidden)}
            aria-label={hidden ? "Show guide" : "Minimise guide"}
          >
            {hidden ? "?" : "−"}
          </button>
        </div>
        {!hidden && (
          <>
            {step ? (
              <>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
                {!target && !step.simulation && (
                  <p className="v3-muted">
                    Use the page to open the relevant form or details. The next
                    control will highlight when it appears.
                  </p>
                )}
                {error && <p role="alert">{error}</p>}
                <div className="practice-flow-actions">
                  <small>
                    {cursor + 1} / {tour.steps.length}
                  </small>
                  {step.simulation ? (
                    <button disabled={busy} onClick={() => void simulate()}>
                      Continue
                    </button>
                  ) : step.review ? (
                    <button
                      disabled={busy || !target}
                      onClick={() => void advance()}
                    >
                      I’ve reviewed this
                    </button>
                  ) : (
                    <small>Use the highlighted app control</small>
                  )}
                </div>
              </>
            ) : (
              <>
                <strong>Workflow complete</strong>
                <p>
                  The updated records are visible throughout the app. Use the ?
                  button on any page to see its guide.
                </p>
              </>
            )}
          </>
        )}
      </aside>
    </>,
    document.body
  );
}
