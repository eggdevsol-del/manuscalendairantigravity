import { usePractice } from "@/features/practice/PracticeContext";
import { CircleHelp } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { useOptionalTooltipTour } from "./TooltipTourProvider";
import { practiceChapterForRoute } from "@shared/practiceRoutes";
/** Help keeps the overview and safe, account-scoped practice as distinct choices. */
export function TourHelp({ feature = false }: { feature?: boolean }) {
  const tour = useOptionalTooltipTour();
  const practice = usePractice();
  const [path, go] = useLocation(),
    search = useSearch();
  if (practice)
    return (
      <button
        type="button"
        className="tour-help"
        data-tour-ui
        aria-label="Guide this page"
        onClick={() => {
          if (practice.startGuide)
            practice.startGuide(practiceChapterForRoute(path, search));
          else document.dispatchEvent(new Event("practice-open-control-guide"));
        }}
      >
        <CircleHelp size={21} />
      </button>
    );
  if (!tour) return null;
  const artist =
    typeof document !== "undefined" &&
    !!document.querySelector(".artist-workspace");
  return (
    <button
      type="button"
      className="tour-help"
      data-tour-ui
      aria-label={feature ? "Tour this feature" : "Tour this page"}
      title="Show me around"
      onClick={() =>
        artist
          ? go(
              `/practice?chapter=${practiceChapterForRoute(path, search)}&return=${encodeURIComponent(path + (search ? "?" + search.replace(/^\?/, "") : ""))}`
            )
          : tour.startContextualTour()
      }
    >
      <CircleHelp size={21} />
    </button>
  );
}
