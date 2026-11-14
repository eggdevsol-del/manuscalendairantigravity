import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineNotice } from "./OfflineNotice";

const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    get: () => value,
  });

afterEach(() => {
  setOnline(true);
  vi.unstubAllGlobals();
});

describe("OfflineNotice", () => {
  it("stays hidden while the device is online", () => {
    setOnline(true);
    render(<OfflineNotice />);
    expect(screen.queryByText(/offline/i)).toBeNull();
  });

  it("appears when the connection drops and leaves when it returns", () => {
    const onReconnect = vi.fn();
    setOnline(true);
    render(<OfflineNotice onReconnect={onReconnect} />);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    expect(
      screen.getByText("You’re offline. Reconnect to continue.")
    ).toBeTruthy();
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText(/offline/i)).toBeNull();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("keeps the notice when Try again still cannot reach the server", async () => {
    setOnline(false);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<OfflineNotice />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("clears the notice when Try again reaches the server", async () => {
    const onReconnect = vi.fn();
    setOnline(false);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    render(<OfflineNotice onReconnect={onReconnect} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });
    expect(screen.queryByText(/offline/i)).toBeNull();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });
});
