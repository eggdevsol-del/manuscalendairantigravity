import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  activeTourSurface,
  collectTourSteps,
  controlLabel,
} from "./contextualTargets";
beforeEach(() => {
  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([
    { width: 44, height: 44 },
  ] as unknown as DOMRectList);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
describe("live tour coverage", () => {
  it("covers real controls and read-only information without exposing typed values", () => {
    document.body.innerHTML =
      '<main data-tour-surface="Checkout"><h1>Checkout</h1><div class="v3-facts">Total $100</div><label>Email<input value="private@example.com"></label><label>Country<select><option>Australia</option><option>Canada</option></select></label><button disabled>Pay now</button><button data-tour-ui>Tour</button><div hidden><button>Hidden</button></div></main>';
    const steps = collectTourSteps(activeTourSurface()!);
    expect(steps.map(s => s.title)).toEqual(["Pay now"]);
    expect(
      JSON.stringify(steps.map(({ title, body }) => ({ title, body })))
    ).not.toContain("private@example.com");
    expect(steps.at(-1)?.body).toContain("recorded payments");
    expect(steps.at(-1)?.body).toContain("duplicate collection");
  });
  it("follows the top dialog and excludes the guide itself and inert background", () => {
    document.body.innerHTML =
      '<main data-tour-surface="Calendar" inert><h1>Calendar</h1></main><section role="dialog"><h2>New booking</h2><button>Choose service</button><div role="dialog" data-tour-ui><button>Next</button></div></section>';
    expect(collectTourSteps(activeTourSurface()!).map(s => s.title)).toEqual([
      "Choose service",
    ]);
  });
  it("keeps stable targets while new wizard controls appear", () => {
    document.body.innerHTML =
      '<main data-tour-surface="Booking"><h1>Booking</h1><button>Choose service</button></main>';
    const surface = activeTourSurface()!,
      initial = collectTourSteps(surface);
    surface.insertAdjacentHTML(
      "beforeend",
      '<label>Project completed by<input type="date"></label>'
    );
    const updated = collectTourSteps(surface);
    expect(updated[0].targetId).toBe(initial[0].targetId);
    expect(updated.at(-1)?.title).toBe("Project completed by");
    expect(
      updated.every(s => s.element.dataset.tourAnchor === s.targetId)
    ).toBe(true);
  });
  it("uses image alternative text for image-only links", () => {
    document.body.innerHTML =
      '<a href="/artwork"><img alt="Botanical tattoo by Ella"></a>';
    expect(controlLabel(document.querySelector("a")!)).toBe(
      "Botanical tattoo by Ella"
    );
  });
  it("uses an associated label without including select options", () => {
    document.body.innerHTML =
      '<label for="frequency">Frequency</label><select id="frequency"><option>Daily</option><option>Monthly</option></select>';
    expect(controlLabel(document.querySelector("select")!)).toBe("Frequency");
  });
  it("covers navigation on pages but never includes background navigation in a sheet", () => {
    document.body.innerHTML =
      '<main data-tour-surface="Home"><h1>Home</h1></main><nav id="bottom-nav"><a href="/calendar">Calendar</a></nav>';
    expect(
      collectTourSteps(activeTourSurface()!).map(s => s.title)
    ).not.toContain("Calendar");
    document.body.insertAdjacentHTML(
      "beforeend",
      '<section role="dialog"><h2>Booking</h2></section>'
    );
    expect(collectTourSteps(activeTourSurface()!).map(s => s.title)).toEqual(
      []
    );
  });
});
