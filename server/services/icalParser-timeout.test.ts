// @vitest-environment node
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { fetchCalendarText } from "./icalParser";

/** A request whose response keeps sending a few bytes and never ends. */
function drippingRequest() {
  const req: any = new EventEmitter();
  req.setTimeout = vi.fn();
  req.end = vi.fn();
  req.destroy = vi.fn((error?: Error) => {
    if (error) req.emit("error", error);
  });
  return req;
}

describe("calendar feed time limit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("closes a connection that is still dripping data when time runs out", async () => {
    const req = drippingRequest();
    mocks.request.mockImplementation((_url, _options, onResponse) => {
      const res: any = new EventEmitter();
      res.statusCode = 200;
      res.headers = {};
      res.resume = vi.fn();
      queueMicrotask(() => {
        onResponse(res);
        res.emit("data", Buffer.from("BEGIN:VCALENDAR"));
      });
      return req;
    });

    const result = fetchCalendarText("https://calendar.example.com/a.ics");
    const outcome = expect(result).rejects.toThrow("Timed out");
    await vi.advanceTimersByTimeAsync(9_000);
    expect(req.destroy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_500);
    await outcome;
    expect(req.destroy).toHaveBeenCalledTimes(1);
  });
});
