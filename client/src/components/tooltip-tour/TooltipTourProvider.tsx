/**
 * TooltipTourProvider — Global context for guided tooltip tours
 * ─────────────────────────────────────────────────────────────
 * Wraps the app. Manages:
 * - Which tour is active (if any)
 * - Current step index
 * - Target element refs registry
 * - Completion persistence (localStorage + future DB sync)
 */
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

import { ALL_TOURS } from "./tours";

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
}

interface TooltipTourContextType {
  /** Start a tour by definition or string ID */
  startTour: (tour: TourDefinition | string) => void;
  /** Advance to next step (or finish) */
  nextStep: () => void;
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
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setCompletedTours(tours: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tours));
}

export function TooltipTourProvider({ children }: { children: React.ReactNode }) {
  const [activeTour, setActiveTour] = useState<TourDefinition | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedTours, setCompleted] = useState<string[]>(getCompletedTours);
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
    return targets.current.get(id) || null;
  }, []);

  const isTourCompleted = useCallback((tourId: string) => {
    return completedTours.includes(tourId);
  }, [completedTours]);

  const markComplete = useCallback((tourId: string) => {
    setCompleted(prev => {
      if (prev.includes(tourId)) return prev;
      const next = [...prev, tourId];
      setCompletedTours(next);
      return next;
    });
  }, []);

  const startTour = useCallback((tour: TourDefinition | string) => {
    if (typeof tour === "string") {
      const found = ALL_TOURS.find((t) => t.id === tour);
      if (found) {
        setActiveTour(found);
        setCurrentStep(0);
      }
      return;
    }
    setActiveTour(tour);
    setCurrentStep(0);
  }, []);

  const skipTour = useCallback(() => {
    if (activeTour) {
      markComplete(activeTour.id);
    }
    setActiveTour(null);
    setCurrentStep(0);
  }, [activeTour, markComplete]);

  const nextStep = useCallback(async () => {
    if (!activeTour) return;
    const step = activeTour.steps[currentStep];

    // Run onNext callback if defined
    if (step?.onNext) {
      await step.onNext();
    }

    const delay = step?.nextDelay || 0;

    if (currentStep + 1 < activeTour.steps.length) {
      // Advance with optional delay
      if (delay > 0) {
        setTimeout(() => setCurrentStep(currentStep + 1), delay);
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
        nextStep,
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
  if (!ctx) throw new Error("useTooltipTour must be used within TooltipTourProvider");
  return ctx;
}
