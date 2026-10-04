import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { PracticeResolver } from "./PracticeControls";
type Entry = {
  id: string;
  label: string;
  screen: string;
  kind: "navigation" | "input" | "review" | "mutation" | "external";
  element: HTMLElement;
  description: string;
};
const hash = (text: string) => {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
};
/** Enumerates mounted conditional controls, including React portals. Never records a failed mutation as completed. */
export function PracticeActionGuide({
  frame,
  screen,
  resolve,
  completed,
}: {
  frame: React.RefObject<HTMLDivElement | null>;
  screen: string;
  resolve: PracticeResolver;
  completed: Record<string, unknown>;
}) {
  const [entries, setEntries] = useState<Entry[]>([]),
    [index, setIndex] = useState(0),
    [active, setActive] = useState(false);
  const pending = useRef<Entry | null>(null),
    current = useRef(resolve);
  current.current = resolve;
  const done = (e: Entry) => {
    void current
      .current(
        "practice.recordAction",
        { id: e.id, label: e.label, screen: e.screen, kind: e.kind },
        "mutation"
      )
      .catch(() => {});
  };
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scan = () => {
      const sheets = [
        ...document.querySelectorAll<HTMLElement>("[data-practice-surface]"),
      ];
      const roots = (sheets.length ? [sheets.at(-1)] : [frame.current]).filter(
        Boolean
      ) as HTMLElement[];
      const found: Entry[] = [];
      const seen = new Set<string>();
      for (const root of roots)
        for (const el of root.querySelectorAll<HTMLElement>(
          'button,a[href],input:not([type="hidden"]),select,textarea,[role="button"]'
        )) {
          if (
            el.closest("[data-practice-guide]") ||
            el.hasAttribute("disabled") ||
            el.getAttribute("aria-hidden") === "true" ||
            el.closest("[hidden]")
          )
            continue;
          const labels = (el as HTMLInputElement).labels;
          const label = (
            el.getAttribute("aria-label") ||
            el.getAttribute("data-tour-title") ||
            labels?.[0]?.textContent ||
            el.getAttribute("placeholder") ||
            el.textContent ||
            el.getAttribute("name") ||
            el.getAttribute("title") ||
            el.tagName
          )
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 250);
          const surface =
            el
              .closest("[data-practice-surface]")
              ?.getAttribute("data-practice-surface") ||
            root.querySelector("h1,h2")?.textContent ||
            screen;
          const href = el.getAttribute("href");
          const kind: Entry["kind"] = href
            ? /^(https?:|sms:|mailto:)/.test(href)
              ? "external"
              : "navigation"
            : ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName)
              ? "input"
              : (el as HTMLButtonElement).type === "submit"
                ? "mutation"
                : "review";
          const id = hash(
            `${screen}|${surface}|${label}|${el.tagName}|${el.getAttribute("type")}|${href || ""}`
          );
          if (seen.has(id)) continue;
          seen.add(id);
          el.dataset.practiceAction = id;
          found.push({
            id,
            label,
            screen,
            kind,
            element: el,
            description:
              el.getAttribute("data-tour-description") ||
              {
                input:
                  "Change this field using fictional information. Review the result before saving.",
                navigation:
                  "Open this destination to explore its mock records and available actions.",
                external:
                  "Preview this external action safely. Practice never opens a provider or sends a message.",
                mutation:
                  "Submit this form to update your private mock records. It completes only after the mock action succeeds.",
                review:
                  "Use this control to review or change the mock workflow. New controls appear as you open its next step.",
              }[kind],
          });
        }
      setEntries(old =>
        old.length === found.length &&
        old.every(
          (e, i) => e.id === found[i].id && e.element === found[i].element
        )
          ? old
          : found
      );
    };
    scan();
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(scan, 50);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const capture = (event: Event) => {
      const target = (event.target as HTMLElement)?.closest<HTMLElement>(
        "[data-practice-action]"
      );
      const entry = entries.find(e => e.id === target?.dataset.practiceAction);
      if (!entry) return;
      if (entry.kind === "external") {
        event.preventDefault();
        event.stopPropagation();
        done(entry);
        return;
      }
      pending.current = entry;
      if (event.type === "change" || entry.kind === "navigation") done(entry);
    };
    const success = (event: Event) => {
      const path = (event as CustomEvent).detail;
      if (
        [
          "practice.recordAction",
          "messages.markRead",
          "conversations.markAsRead",
        ].includes(path)
      )
        return;
      if (pending.current) {
        done({ ...pending.current, kind: "mutation" });
        pending.current = null;
      }
    };
    document.addEventListener("click", capture, true);
    document.addEventListener("change", capture, true);
    document.addEventListener("practice-mutation-success", success);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      document.removeEventListener("click", capture, true);
      document.removeEventListener("change", capture, true);
      document.removeEventListener("practice-mutation-success", success);
    };
  }, [frame, screen, entries]);
  useEffect(() => {
    const open = () => {
      setActive(true);
      setIndex(0);
    };
    document.addEventListener("practice-open-control-guide", open);
    return () =>
      document.removeEventListener("practice-open-control-guide", open);
  }, []);
  const entry = entries[Math.min(index, Math.max(0, entries.length - 1))];
  useEffect(() => {
    if (!active || !entry) return;
    entry.element.classList.add("practice-highlight");
    entry.element.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    return () => entry.element.classList.remove("practice-highlight");
  }, [active, entry]);
  const panel = (
    <aside className="practice-action-guide" data-practice-guide>
      <button type="button" onClick={() => setActive(!active)}>
        {active ? "Hide control guide" : "Guide every control on this screen"}
      </button>
      {active && (
        <>
          <p>
            {entry?.label || "Open a screen to begin"} ·{" "}
            {Math.min(index + 1, entries.length)}/{entries.length} controls ·{" "}
            {entries.filter(e => completed[e.id]).length} recorded
          </p>
          <p>{entry?.description}</p>
          <div>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex(i => Math.max(0, i - 1))}
            >
              Previous control
            </button>
            <button
              type="button"
              onClick={() => {
                if (entry && entry.kind === "review") done(entry);
                setIndex(i => (i + 1) % Math.max(1, entries.length));
              }}
            >
              Next control
            </button>
            <button type="button" onClick={() => setIndex(0)}>
              Replay controls
            </button>
          </div>
          <label>
            Jump to a control
            <select
              value={entry?.id || ""}
              onChange={e =>
                setIndex(entries.findIndex(c => c.id === e.target.value))
              }
            >
              {entries.map(e => (
                <option key={e.id} value={e.id}>
                  {completed[e.id] ? "✓ " : ""}
                  {e.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </aside>
  );
  const sheet = active
    ? [...document.querySelectorAll<HTMLElement>("[data-practice-surface]")].at(
        -1
      )
    : null;
  return sheet ? createPortal(panel, sheet) : panel;
}
