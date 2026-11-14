// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  checkCalendarUrl,
  fetchCalendarText,
  isBlockedAddress,
  parseExternalCalendar,
  parseIcsText,
} from "./icalParser";

describe("calendar feed address checks", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.10",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "2002:7f00:1::1",
    "2001:0:4136:e378:8000:63bf:3fff:fdd2",
    "not-an-address",
  ])("blocks %s", address => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "172.32.0.1", "2607:f8b0:4004:800::200e"])(
    "allows public address %s",
    address => {
      expect(isBlockedAddress(address)).toBe(false);
    }
  );

  it.each([
    "http://example.com/cal.ics",
    "ftp://example.com/cal.ics",
    "file:///etc/passwd",
    "https://localhost/cal.ics",
    "https://127.0.0.1/cal.ics",
    "https://[::1]/cal.ics",
    "https://169.254.169.254/latest/meta-data/",
    "https://2130706433/",
    "https://user:pass@example.com/cal.ics",
    "https://example.com:8443/cal.ics",
    "https://example.com:22/",
  ])("rejects %s before any request", url => {
    expect(() => checkCalendarUrl(url)).toThrow();
  });

  it("accepts https and treats webcal as https", () => {
    expect(checkCalendarUrl("https://example.com/a.ics").href).toBe(
      "https://example.com/a.ics"
    );
    expect(checkCalendarUrl("webcal://example.com/a.ics").protocol).toBe(
      "https:"
    );
    expect(checkCalendarUrl("https://example.com:443/a.ics").hostname).toBe(
      "example.com"
    );
  });

  it("refuses a public-looking name that resolves to a private address", async () => {
    const resolve = vi.fn((_host: string, _options: any, cb: any) =>
      cb(null, [{ address: "10.0.0.5", family: 4 }])
    );
    await expect(
      fetchCalendarText("https://calendar.example.com/a.ics", resolve as any)
    ).rejects.toThrow("Address not allowed");
    expect(resolve).toHaveBeenCalled();
  });

  it("gives callers one generic error whatever went wrong", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const url of [
      "http://example.com/a.ics",
      "https://127.0.0.1:8080/admin",
      "https://169.254.169.254/latest/meta-data/",
    ]) {
      await expect(parseExternalCalendar(url)).rejects.toThrow(
        "Invalid or unreachable calendar URL."
      );
    }
  });
});

describe("parseIcsText", () => {
  it("reads events", () => {
    const events = parseIcsText(
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nDTSTART:20260102T030000Z\r\nDTEND:20260102T040000Z\r\nSUMMARY:Dentist\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"
    );
    expect(events).toHaveLength(1);
    expect(events[0].summary).toBe("Dentist");
    expect(events[0].start.toISOString()).toBe("2026-01-02T03:00:00.000Z");
  });
});
