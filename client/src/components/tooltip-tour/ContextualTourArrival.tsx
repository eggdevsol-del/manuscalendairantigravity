import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useTooltipTour } from "./TooltipTourProvider";
import { activeTourSurface } from "./contextualTargets";
/** A guide link opens the real page, then starts once that page is mounted. */
export function ContextualTourArrival() {
  const [path, go] = useLocation(),
    search = useSearch();
  const { startContextualTour } = useTooltipTour();
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("walkthrough") !== "1") return;
    const timer = setInterval(() => {
      const surface = activeTourSurface();
      if (!surface || surface.dataset.tourSurface === "Guided walkthroughs")
        return;
      clearInterval(timer);
      params.delete("walkthrough");
      go(path + (params.size ? "?" + params.toString() : ""), {
        replace: true,
      });
      startContextualTour();
    }, 100);
    return () => clearInterval(timer);
  }, [path, search, go, startContextualTour]);
  return null;
}
