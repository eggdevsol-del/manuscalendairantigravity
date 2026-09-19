/** Live UI inventory. No sample records, business mutations or positional selectors. */
import type { TourStep } from "./TooltipTourProvider";
import { describeControl, describeSurface } from "./tourCopy";

export const TOUR_CONTROLS =
  "button,a[href],input:not([type=hidden]),select,textarea,[role=button],[role=switch],[role=radio],[role=slider],summary,video,canvas,iframe,.v3-section-heading h2,.v3-facts,.v3-attention,[role=status],[role=alert],[data-tour-description]";
export function isTourVisible(el: HTMLElement | null): el is HTMLElement {
  if (
    !el ||
    !el.isConnected ||
    el.closest(
      '[hidden],[inert],[aria-hidden="true"],.tooltip-tour-backdrop,[data-tour-ui]'
    )
  )
    return false;
  if(el.classList.contains("sr-only") && document.activeElement !== el) return false;
  const style = getComputedStyle(el);
  return (
    !!el.getClientRects().length &&
    style.visibility !== "hidden" &&
    style.display !== "none"
  );
}
export function activeTourSurface(): HTMLElement | null {
  const dialogs = [
    ...document.querySelectorAll<HTMLElement>(
      "[role=dialog],[role=alertdialog]"
    ),
  ].filter(isTourVisible);
  return (
    dialogs.at(-1) ||
    [
      ...document.querySelectorAll<HTMLElement>(
        "[data-tour-surface],.v3-screen,.app-document"
      ),
    ]
      .filter(isTourVisible)
      .at(-1) ||
    null
  );
}
export function surfaceTitle(surface: HTMLElement): string {
  return (
    surface.dataset.tourSurface ||
    surface
      .querySelector("h1,[data-slot=sheet-title],[data-slot=dialog-title],h2")
      ?.textContent?.trim() ||
    surface.getAttribute("aria-label") ||
    "This feature"
  );
}
export function controlLabel(el: HTMLElement): string {
  if(el.dataset.tourTitle) return el.dataset.tourTitle;
  const ids = el.getAttribute("aria-labelledby")?.split(/\s+/) || [];
  const explicit =
    el.getAttribute("aria-label") ||
    ids
      .map(id => document.getElementById(id)?.textContent || "")
      .join(" ")
      .trim();
  if (explicit) return explicit;
  if (el.matches(".v3-facts")) return "Summary and amounts";
  if (el.matches(".v3-attention")) return "Needs your attention";
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    const labels = [...(el.labels || [])]
      .map(label => {
        const copy = label.cloneNode(true) as HTMLElement;
        copy
          .querySelectorAll("input,select,textarea,button,[data-tour-ui]")
          .forEach(node => node.remove());
        return copy.textContent?.trim() || "";
      })
      .filter(Boolean)
      .join(" ");
    return (
      labels ||
      el.getAttribute("placeholder") ||
      el.name ||
      (el.type === "file" ? "Choose a file" : "Input")
    );
  }
  if (el.tagName === "VIDEO") return "Video playback";
  if (el.tagName === "CANVAS") return "Signature";
  if (el.tagName === "IFRAME") return el.title || "Secure payment details";
  return (
    el.querySelector(".v3-row-copy strong")?.textContent?.trim() ||
    el.textContent?.replace(/\s+/g, " ").trim() ||
    el.getAttribute("title") ||
    [...el.querySelectorAll<HTMLImageElement>("img[alt]")]
      .map(image => image.alt.trim()).filter(Boolean).join(" · ") ||
    "Control"
  ).slice(0, 100);
}
let nextTarget = 0;
const ids = new WeakMap<HTMLElement, string>();
export function liveTargetId(el: HTMLElement) {
  let id = ids.get(el);
  if (!id) {
    id = `live-${++nextTarget}`;
    ids.set(el, id);
    el.dataset.tourAnchor = id;
  }
  return id;
}
export function collectTourSteps(
  surface: HTMLElement
): (TourStep & { element: HTMLElement })[] {
  const title = surfaceTitle(surface);
  const heading = [...surface.querySelectorAll<HTMLElement>('[data-tour-intro],h1,[data-slot=sheet-title],[data-slot=dialog-title],h2,h3')].find(isTourVisible) || surface;
  const candidates = [...surface.querySelectorAll<HTMLElement>(TOUR_CONTROLS)];
  if (!surface.matches("[role=dialog],[role=alertdialog]"))
    candidates.push(
      ...document.querySelectorAll<HTMLElement>(
        "#bottom-nav a,#bottom-nav button"
      )
    );
  const repeated = new Set<string>();
  const controls = [...new Set(candidates)].sort((a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1).filter(el => {
    if (!isTourVisible(el)) return false;
    const repeat=el.dataset.tourRepeat;
    if(repeat && repeated.has(repeat)) return false;
    if(repeat) repeated.add(repeat);
    // Composite buttons are one control; their icons and labels aren't separate steps.
    if (el.parentElement?.closest("button,a[href],[role=button]")) return false;
    return !el.matches("[data-slot=sheet-close],[data-slot=dialog-close]");
  });
  return [
    {
      element: heading,
      targetId: liveTargetId(heading),
      title,
      body: describeSurface(title),
    },
    ...controls.map(element => ({
      element,
      targetId: element.dataset.tourRepeat ? `css:[data-tour-repeat="${element.dataset.tourRepeat}"]` : liveTargetId(element),
      title: controlLabel(element),
      body: describeControl(element, title),
    })),
  ];
}
