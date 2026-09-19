/**
 * TooltipTourProvider — Global context for guided tooltip tours
 * ─────────────────────────────────────────────────────────────
 * Wraps the app. Manages:
 * - Which tour is active (if any)
 * - Current step index
 * - Target element refs registry
 * - Completion persistence (localStorage + future DB sync)
 */
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

import {
  activeTourSurface,
  collectTourSteps,
  isTourVisible,
  surfaceTitle,
} from "./contextualTargets";

export interface TourStep {
  targetId: string;
  title: string;
  body: string;
  position?: "top" | "bottom" | "left" | "right";
  /** Called when advancing FROM this step (before next step renders) */
  onNext?: () => void | Promise<void>;
  /** Delay (ms) before showing next step — useful when onNext triggers DOM changes */
  nextDelay?: number;
}

export interface TourDefinition {
  id: string;
  steps: TourStep[];
  contextual?: boolean;
}

interface TooltipTourContextType {
  /** Start a tour by definition */
  startTour: (tour: TourDefinition) => void;
  startContextualTour: () => void;
  /** Advance to next step (or finish) */
  nextStep: () => void;
  previousStep: () => void;
  /** Skip / dismiss the entire tour */
  skipTour: () => void;
  /** Register a target element ref */
  registerTarget: (id: string, el: HTMLElement | null) => void;
  /** Unregister a target */
  unregisterTarget: (id: string) => void;
  /** Current active tour */
  activeTour: TourDefinition | null;
  /** Current step index */
  currentStep: number;
  /** Get a registered target element */
  getTarget: (id: string) => HTMLElement | null;
  /** Check if a tour has been completed */
  isTourCompleted: (tourId: string) => boolean;
  /** Get all completed tour IDs */
  completedTours: string[];
  /** Reset a completed tour (for "How to's" replay) */
  resetTour: (tourId: string) => void;
}

const TooltipTourContext = createContext<TooltipTourContextType | null>(null);

const STORAGE_KEY = "manus_completed_tours";

function getCompletedTours(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value)
      ? value.filter(id => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function setCompletedTours(tours: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tours));
  } catch {}
}

export function TooltipTourProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeTour, setActiveTour] = useState<TourDefinition | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedTours, setCompleted] = useState<string[]>(getCompletedTours);
  const generation = useRef(0);
  const targets = useRef<Map<string, HTMLElement>>(new Map());

  const registerTarget = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      targets.current.set(id, el);
    } else {
      targets.current.delete(id);
    }
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    targets.current.delete(id);
  }, []);

  const getTarget = useCallback((id: string) => {
    const visible = (el: HTMLElement | null) => (isTourVisible(el) ? el : null);
    if (id.startsWith("css:")) {
      try {
        const matches=Array.from(document.querySelectorAll<HTMLElement>(id.slice(4))).map(visible).filter((el):el is HTMLElement=>!!el);
        return matches.find(el=>{const rect=el.getBoundingClientRect();return rect.top>=0 && rect.bottom<=innerHeight && rect.left>=0 && rect.right<=innerWidth;}) || matches[0] || null;
      } catch {
        return null;
      }
    }
    if (id.startsWith("text:")) {
      const text = id.slice(5);
      return (
        Array.from(
          document.querySelectorAll<HTMLElement>("button,a,label,h2,h3,summary")
        )
          .filter(
            el =>
              (el.getAttribute("aria-label") || el.textContent || "").trim() ===
              text
          )
          .map(visible)
          .find(Boolean) || null
      );
    }
    return visible(targets.current.get(id) || null);
  }, []);

  const isTourCompleted = useCallback(
    (tourId: string) => {
      return completedTours.includes(tourId);
    },
    [completedTours]
  );

  const markComplete = useCallback((tourId: string) => {
    setCompleted(prev => {
      if (prev.includes(tourId)) return prev;
      const next = [...prev, tourId];
      setCompletedTours(next);
      return next;
    });
  }, []);

  const startTour = useCallback((tour: TourDefinition) => {
    generation.current++;
    setActiveTour(tour);
    setCurrentStep(0);
  }, []);

  const skipTour = useCallback(() => {
    generation.current++;
    setActiveTour(null);
    setCurrentStep(0);
  }, []);

  const nextStep = useCallback(async () => {
    if (!activeTour) return;
    const run = generation.current;
    const step = activeTour.steps[currentStep];

    // Run onNext callback if defined
    if (step?.onNext) {
      await step.onNext();
    }

    if (run !== generation.current) return;
    const delay = step?.nextDelay || 0;

    if (currentStep + 1 < activeTour.steps.length) {
      // Advance with optional delay
      if (delay > 0) {
        setTimeout(() => {
          if (run === generation.current) setCurrentStep(currentStep + 1);
        }, delay);
      } else {
        setCurrentStep(currentStep + 1);
      }
    } else {
      // Tour complete
      markComplete(activeTour.id);
      setActiveTour(null);
      setCurrentStep(0);
    }
  }, [activeTour, currentStep, markComplete]);

  const collectLiveTour = useCallback(() => {
    const surface = activeTourSurface();
    if (!surface) return null;
    for (const id of targets.current.keys())
      if (id.startsWith("live-")) targets.current.delete(id);
    const steps = collectTourSteps(surface);
    steps.forEach(step => registerTarget(step.targetId, step.element));
    return {
      id: `contextual:${location.pathname.replace(/\/\d+(?=\/|$)/g, "/record")}:${surfaceTitle(surface)}`,
      steps,
      contextual: true,
    };
  }, [registerTarget]);

  const startContextualTour = useCallback(() => {
    const next = collectLiveTour();
    if (next) startTour(next);
  }, [collectLiveTour, startTour]);

  // New tabs, sheets, wizard stages and asynchronously loaded controls join the
  // same live guide. No tour code invokes the controls or business mutations.
  useEffect(() => {
    if (!activeTour?.contextual) return;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = collectLiveTour();
        if (!next) return;
        setActiveTour(previous => {
          if (!previous?.contextual) return previous;
          const signature = (tour: TourDefinition) =>
            JSON.stringify(
              tour.steps.map(step => [step.targetId, step.title, step.body])
            );
          if (
            previous.id === next.id &&
            signature(previous) === signature(next)
          )
            return previous;
          const target = previous.steps[currentStep]?.targetId;
          const index =
            previous.id === next.id
              ? next.steps.findIndex(step => step.targetId === target)
              : -1;
          setCurrentStep(Math.max(0, index));
          return next;
        });
      }, 100);
    };
    const observer = new MutationObserver(records => {
      if (
        records.some(
          record => {
            const element = record.target instanceof Element
              ? record.target : record.target.parentElement;
            return !element?.closest("[data-tour-ui],.tooltip-tour-backdrop");
          }
        )
      )
        refresh();
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "aria-expanded",
        "aria-selected",
        "aria-checked",
        "aria-pressed",
        "data-tour-description",
        "data-tour-title",
        "data-tour-surface",
        "disabled",
        "data-state",
        "data-tour-booking-step",
      ],
    });
    window.addEventListener("popstate", refresh);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("popstate", refresh);
    };
  }, [activeTour?.contextual, currentStep, collectLiveTour]);

  const resetTour = useCallback((tourId: string) => {
    setCompleted(prev => {
      const next = prev.filter(id => id !== tourId);
      setCompletedTours(next);
      return next;
    });
  }, []);

  return (
    <TooltipTourContext.Provider
      value={{
        startTour,
        startContextualTour,
        nextStep,
        previousStep: () => {
          generation.current++;
          setCurrentStep(step => Math.max(0, step - 1));
        },
        skipTour,
        registerTarget,
        unregisterTarget,
        activeTour,
        currentStep,
        getTarget,
        isTourCompleted,
        completedTours,
        resetTour,
      }}
    >
      {children}
    </TooltipTourContext.Provider>
  );
}

export function useTooltipTour() {
  const ctx = useContext(TooltipTourContext);
  if (!ctx)
    throw new Error("useTooltipTour must be used within TooltipTourProvider");
  return ctx;
}

export function useOptionalTooltipTour() {
  return useContext(TooltipTourContext);
}
