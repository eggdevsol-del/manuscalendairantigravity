/**
 * useTooltipTarget — Attach a ref to register it as a tooltip target
 * ──────────────────────────────────────────────────────────────────
 * Usage:
 *   const ref = useTooltipTarget("edit-profile-btn");
 *   <button ref={ref}>Edit Profile</button>
 */
import { useEffect, useRef, useCallback } from "react";
import { useTooltipTour } from "./TooltipTourProvider";

export function useTooltipTarget(targetId: string) {
  const { registerTarget, unregisterTarget } = useTooltipTour();
  const ref = useRef<HTMLElement | null>(null);

  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el;
    registerTarget(targetId, el);
  }, [targetId, registerTarget]);

  useEffect(() => {
    return () => {
      unregisterTarget(targetId);
    };
  }, [targetId, unregisterTarget]);

  return setRef;
}
