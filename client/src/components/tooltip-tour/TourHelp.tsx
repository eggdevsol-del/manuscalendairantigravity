import { usePractice } from "@/features/practice/PracticeContext";
import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import * as Dialog from "@radix-ui/react-dialog";
import { useOptionalTooltipTour } from "./TooltipTourProvider";
import { practiceChapterForRoute } from "@shared/practiceRoutes";
/** Help keeps the overview and safe, account-scoped practice as distinct choices. */
export function TourHelp({ feature = false }: { feature?: boolean }) {
  const tour = useOptionalTooltipTour();
  const practice = usePractice();
  const [path, go] = useLocation(),
    search = useSearch();
  const [open, setOpen] = useState(false);
  if (practice)
    return (
      <button
        type="button"
        className="tour-help"
        data-tour-ui
        aria-label="Guide these practice controls"
        onClick={() =>
          document.dispatchEvent(new Event("practice-open-control-guide"))
        }
      >
        <CircleHelp size={21} />
      </button>
    );
  if (!tour) return null;
  const artist =
    typeof document !== "undefined" &&
    !!document.querySelector(".artist-workspace");
  return (
    <>
      <button
        type="button"
        className="tour-help"
        data-tour-ui
        aria-label={feature ? "Tour this feature" : "Tour this page"}
        title="Show me around"
        onClick={() => (artist ? setOpen(true) : tour.startContextualTour())}
      >
        <CircleHelp size={21} />
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="practice-help-backdrop" />
          <Dialog.Content
            className="practice-help-menu"
            aria-describedby={undefined}
          >
            <Dialog.Title>How can we help?</Dialog.Title>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                tour.startContextualTour();
              }}
            >
              Show this page’s guide
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                go(
                  `/practice?chapter=${practiceChapterForRoute(path, search)}`
                );
              }}
            >
              Practise this workflow
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                go("/practice");
              }}
            >
              Resume practice
            </button>
            <Dialog.Close>Close</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
