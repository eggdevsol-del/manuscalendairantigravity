import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { addDays, format } from "date-fns";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarTimeline } from "./CalendarTimeline";

const initialDate = new Date(2026, 8, 10);
const noEvents: any[] = [];
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

function Harness({ events = noEvents }: { events?: any[] }) {
  const [date, setDate] = useState(initialDate);
  const [navigationKey, setNavigationKey] = useState(0);
  return (
    <>
      <output aria-label="Selected calendar date">
        {format(date, "yyyy-MM-dd")}
      </output>
      <button onClick={() => setNavigationKey(key => key + 1)}>
        Return to selected day
      </button>
      <CalendarTimeline
        events={events}
        date={date}
        onDate={setDate}
        navigationKey={navigationKey}
        onSelect={vi.fn()}
        selectedId={null}
        zone="UTC"
      />
    </>
  );
}

function frame() {
  act(() => {
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(callback => callback(performance.now()));
  });
}

function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

function day(offset: number) {
  return screen.getByRole("region", {
    name: format(addDays(initialDate, offset), "EEEE d MMMM yyyy"),
  });
}

function topOf(row: HTMLElement) {
  return Number(row.style.transform.match(/translateY\(([-.\d]+)px\)/)?.[1]);
}

function nativeScroller() {
  const element = screen.getByRole("region", {
    name: "Scrollable calendar timeline",
  });
  let position = element.scrollTop;
  const writes = vi.fn((value: number) => {
    position = value;
  });
  const scrollTo = vi.fn((options: ScrollToOptions) => {
    writes(options.top ?? position);
  });
  // A browser moves its scroll position without calling JavaScript's setter.
  // Keeping these paths separate catches even same-position writes, which can
  // interrupt WKWebView inertia without causing an obvious visual jump.
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    get: () => position,
    set: writes,
  });
  Object.defineProperty(element, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: 600,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    get: () =>
      parseFloat((element.firstElementChild as HTMLElement).style.height),
  });
  return {
    element,
    writes,
    scrollTo,
    moveTo(value: number) {
      position = value;
      fireEvent.scroll(element);
    },
  };
}

function appointment(id: number, dayOfMonth: number, clientName: string) {
  return {
    id,
    startTime: `2026-09-${dayOfMonth}T10:00:00Z`,
    endTime: `2026-09-${dayOfMonth}T11:00:00Z`,
    title: "Tattoo session",
    clientName,
    status: "confirmed",
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal(
    "matchMedia",
    vi.fn((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    })
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => frames.delete(id))
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [
            { target, contentRect: { width: 380, height: 600 } },
          ] as ResizeObserverEntry[],
          this as unknown as ResizeObserver
        );
      }
      unobserve() {}
      disconnect() {}
    }
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("calendar native scrolling", () => {
  it("updates the selected date without writing over native motion across day boundaries", () => {
    render(<Harness />);
    const scroll = nativeScroller();
    fireEvent.touchStart(scroll.element, { touches: [{ identifier: 1 }] });
    scroll.moveTo(topOf(day(1)) + 24);
    scroll.moveTo(topOf(day(2)) + 37);
    frame();

    expect(screen.getByLabelText("Selected calendar date")).toHaveTextContent(
      "2026-09-12"
    );
    expect(scroll.writes).not.toHaveBeenCalled();

    fireEvent.touchEnd(scroll.element, { touches: [] });
    // The browser continues advancing after the finger is lifted.
    scroll.moveTo(topOf(day(3)) + 19);
    frame();
    advance(100);
    expect(screen.getByLabelText("Selected calendar date")).toHaveTextContent(
      "2026-09-13"
    );
    expect(scroll.writes).not.toHaveBeenCalled();
  });

  it("defers new booking geometry while a finger is held and while momentum continues, then preserves the visible anchor", () => {
    const original = [appointment(1, 11, "Original client")];
    const { rerender } = render(<Harness events={original} />);
    const scroll = nativeScroller();
    fireEvent.touchStart(scroll.element, { touches: [{ identifier: 1 }] });
    scroll.moveTo(topOf(day(1)) + 31);
    frame();
    const oldHeight = scroll.element.scrollHeight;
    rerender(
      <Harness
        events={[
          ...original,
          appointment(2, 10, "New morning client"),
          appointment(3, 10, "New afternoon client"),
        ]}
      />
    );

    // A quiet finger is not the end of a gesture.
    advance(500);
    frame();
    expect(scroll.element.scrollHeight).toBe(oldHeight);
    expect(screen.queryByText("New morning client")).not.toBeInTheDocument();
    expect(scroll.writes).not.toHaveBeenCalled();

    fireEvent.touchEnd(scroll.element, { touches: [] });
    advance(100);
    scroll.moveTo(topOf(day(1)) + 51);
    frame();
    advance(190);
    expect(scroll.element.scrollHeight).toBe(oldHeight);
    expect(scroll.writes).not.toHaveBeenCalled();

    advance(30);
    frame();
    expect(screen.getByText("New morning client")).toBeVisible();
    expect(scroll.element.scrollHeight).toBeGreaterThan(oldHeight);
    expect(scroll.element.scrollTop).toBe(topOf(day(1)) + 51);
    expect(scroll.writes).toHaveBeenCalled();
    expect(screen.getByLabelText("Selected calendar date")).toHaveTextContent(
      "2026-09-11"
    );
  });

  it("honours explicit navigation to the same date while partway through that date", () => {
    render(<Harness />);
    const scroll = nativeScroller();
    scroll.moveTo(topOf(day(0)) + 55);
    frame();
    expect(scroll.writes).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Return to selected day" })
    );
    frame();
    expect(scroll.writes).toHaveBeenCalled();
    expect(scroll.scrollTo).toHaveBeenCalledWith({
      top: topOf(day(0)),
      behavior: "smooth",
    });
    expect(scroll.element.scrollTop).toBe(topOf(day(0)));
    advance(300);
    frame();
    expect(scroll.element.scrollTop).toBe(topOf(day(0)));
  });

  it("accepts native scrollend as settled only after the finger is released", () => {
    const original = [appointment(1, 11, "Original client")];
    const { rerender } = render(<Harness events={original} />);
    const scroll = nativeScroller();
    fireEvent.touchStart(scroll.element, { touches: [{ identifier: 1 }] });
    scroll.moveTo(topOf(day(1)) + 29);
    frame();
    rerender(
      <Harness
        events={[
          ...original,
          appointment(2, 10, "New morning client"),
          appointment(3, 10, "New afternoon client"),
        ]}
      />
    );
    fireEvent(scroll.element, new Event("scrollend"));
    expect(screen.queryByText("New morning client")).not.toBeInTheDocument();
    expect(scroll.writes).not.toHaveBeenCalled();

    fireEvent.touchEnd(scroll.element, { touches: [] });
    fireEvent(scroll.element, new Event("scrollend"));
    expect(screen.getByText("New morning client")).toBeVisible();
    expect(scroll.element.scrollTop).toBe(topOf(day(1)) + 29);
    expect(scroll.writes).toHaveBeenCalled();
  });

  it("uses an immediate date jump when reduced motion is enabled", () => {
    vi.mocked(window.matchMedia).mockImplementation(media => ({
      matches: media === "(prefers-reduced-motion: reduce)",
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    render(<Harness />);
    const scroll = nativeScroller();
    scroll.moveTo(topOf(day(0)) + 55);
    frame();
    fireEvent.click(
      screen.getByRole("button", { name: "Return to selected day" })
    );
    frame();
    expect(scroll.element.scrollTop).toBe(topOf(day(0)));
    expect(scroll.writes).toHaveBeenCalled();
    expect(scroll.scrollTo).not.toHaveBeenCalled();
  });

  it.each(["previous", "next"])(
    "extends the %s date boundary only after scrolling settles and keeps the DOM bounded",
    direction => {
      render(<Harness />);
      const scroll = nativeScroller();
      const position =
        direction === "previous"
          ? 0
          : scroll.element.scrollHeight - scroll.element.clientHeight;
      scroll.moveTo(position);
      frame();
      const selectedDate = screen.getByLabelText(
        "Selected calendar date"
      ).textContent;
      expect(scroll.writes).not.toHaveBeenCalled();
      expect(
        scroll.element.querySelectorAll(".v3-timeline-day").length
      ).toBeLessThan(40);

      advance(250);
      frame();
      expect(scroll.element.scrollTop).toBeGreaterThan(1000);
      expect(scroll.element.scrollTop).toBeLessThan(
        scroll.element.scrollHeight - 1000
      );
      expect(screen.getByLabelText("Selected calendar date")).toHaveTextContent(
        selectedDate!
      );
      expect(
        scroll.element.querySelectorAll(".v3-timeline-day").length
      ).toBeLessThan(40);
    }
  );

  it("cancels queued scroll work when leaving the calendar", () => {
    const { unmount } = render(<Harness />);
    const scroll = nativeScroller();
    scroll.moveTo(topOf(day(2)) + 25);
    expect(frames.size).toBeGreaterThan(0);
    unmount();
    expect(frames.size).toBe(0);
    advance(500);
    expect(scroll.writes).not.toHaveBeenCalled();
  });
});
