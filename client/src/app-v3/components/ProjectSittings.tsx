import { useState, type ReactNode } from "react";
import {
  nextProjectSitting,
  type ProjectSitting,
} from "../data/projectProgress";
import { Action } from "../design/primitives";

/** Long projects reveal all rows on request; selected deep links always remain visible. */
export function ProjectSittings<T extends ProjectSitting>({
  sittings,
  selectedId,
  render,
}: {
  sittings: T[];
  selectedId?: number | null;
  render: (sitting: T, index: number) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  const next = nextProjectSitting(sittings);
  const compact = sittings.length > 4;
  const shown =
    compact && !all
      ? sittings.filter(
          s => s.id === (selectedId || next?.id || sittings.at(-1)?.id)
        )
      : sittings;
  return (
    <div className="ivory-project-sittings">
      <ol className="v3-sitting-list" aria-label="Project sittings">
        {shown.map(s => (
          <li key={s.id} data-next={s.id === next?.id}>
            {render(s, sittings.indexOf(s))}
          </li>
        ))}
      </ol>
      {compact && (
        <Action tone="quiet" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? "Show fewer sittings" : `View all ${sittings.length} sittings`}
        </Action>
      )}
    </div>
  );
}
