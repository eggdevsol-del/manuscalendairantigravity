import { useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTooltipTour } from "./TooltipTourProvider";
import {
  activeTourSurface,
  collectTourSteps,
  surfaceTitle,
} from "./contextualTargets";

export function automaticGuideKey(userId: string, path: string, title: string) {
  return `tattoi:guide:inline:v4:${encodeURIComponent(userId)}:${path.replace(/\/\d+(?=\/|$)/g, "/record")}:${title}`;
}
/** First visits guide a signed-in account; help and guide links always replay. */
export function ContextualTourArrival() {
  const [path, go] = useLocation(),
    search = useSearch();
  const { user, loading } = useAuth();
  const { startContextualTour, activeTour } = useTooltipTour();
  const active = useRef(activeTour);
  active.current = activeTour;
  const shown = useRef(new Set<string>());
  useEffect(() => {
    if (path === "/practice") return;
    if (user?.role === "artist" && user.hasCompletedOnboarding !== 1) return;
    const params = new URLSearchParams(search);
    const replay = params.get("walkthrough") === "1";
    if (
      !replay &&
      (loading ||
        !user?.id ||
        /\/(login|signup|register|auth|reset|recover)(\/|$)/.test(path))
    )
      return;
    let checks = 0;
    const timer = setInterval(() => {
      if (++checks > 40) {
        clearInterval(timer);
        return;
      }
      if (document.visibilityState !== "visible" || active.current) return;
      const surface = activeTourSurface();
      if (!surface || surfaceTitle(surface) === "Guided walkthroughs") return;
      // On sign-in, wait for the real page, not a login or unrelated dialog.
      if (!replay && surface.matches("[role=dialog],[role=alertdialog]"))
        return;
      if (!collectTourSteps(surface).length) return;
      const key = user?.id
        ? automaticGuideKey(user.id, path, surfaceTitle(surface))
        : null;
      if (!replay && key) {
        let persisted = false;
        try {
          persisted = localStorage.getItem(key) === "shown";
        } catch {}
        if (persisted || shown.current.has(key)) {
          clearInterval(timer);
          return;
        }
      }
      clearInterval(timer);
      if (key) {
        shown.current.add(key);
        try {
          localStorage.setItem(key, "shown");
        } catch {}
      }
      if (replay) {
        params.delete("walkthrough");
        go(path + (params.size ? "?" + params.toString() : ""), {
          replace: true,
        });
      }
      startContextualTour();
    }, 350);
    return () => clearInterval(timer);
  }, [
    path,
    search,
    go,
    startContextualTour,
    user?.id,
    user?.role,
    user?.hasCompletedOnboarding,
    loading,
  ]);
  return null;
}
