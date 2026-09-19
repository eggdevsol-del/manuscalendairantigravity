import { CircleHelp } from "lucide-react";
import { useOptionalTooltipTour } from "./TooltipTourProvider";
/** Small, consistent entry point for every screen and portalled feature. */
export function TourHelp({ feature = false }: { feature?: boolean }) {
  const tour = useOptionalTooltipTour();
  if (!tour) return null;
  return (
    <button
      type="button"
      className="tour-help"
      data-tour-ui
      aria-label={feature ? "Tour this feature" : "Tour this page"}
      title="Show me around"
      onClick={tour.startContextualTour}
    >
      <CircleHelp size={21} />
    </button>
  );
}
