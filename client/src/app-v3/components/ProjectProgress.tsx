import { useId } from "react";
import { projectProgress, type ProjectSitting } from "../data/projectProgress";

export function ProjectProgress({ sittings }: { sittings: ProjectSitting[] }) {
  const id = useId();
  const progress = projectProgress(sittings);
  const label =
    progress.total === null
      ? `${progress.completed} ${progress.completed === 1 ? "sitting" : "sittings"} completed · total to be confirmed`
      : `${progress.completed} of ${progress.total} sittings completed`;
  return (
    <div
      className="ivory-project-progress"
      data-tour-title="Project progress"
      data-tour-description="Progress counts completed sittings against the saved planned total. It does not measure artwork or payment completion. If the total is unknown, no percentage is shown."
    >
      <div className="ivory-project-progress-copy">
        <p id={id}>{label}</p>
        {progress.total !== null && (
          <span className="v3-muted">
            {progress.remaining === 0
              ? "Complete"
              : `${progress.remaining} left`}
          </span>
        )}
      </div>
      {progress.total !== null && (
        <progress
          aria-labelledby={id}
          max={progress.total}
          value={progress.completed}
        />
      )}
      {(progress.cancelled > 0 || progress.missed > 0) && (
        <span className="v3-muted">
          {[
            progress.cancelled > 0 && `${progress.cancelled} cancelled`,
            progress.missed > 0 && `${progress.missed} missed`,
          ]
            .filter(Boolean)
            .join(" · ")}{" "}
          · check the remaining plan with your artist
        </span>
      )}
    </div>
  );
}
