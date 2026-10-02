import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useReadReceipts } from "./useReadReceipts";
const mocks = vi.hoisted(() => ({ mutate: vi.fn(), invalidate: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      messages: { list: { invalidate: mocks.invalidate } },
      conversations: { list: { invalidate: mocks.invalidate } },
      consultations: { list: { invalidate: mocks.invalidate } },
    }),
    conversations: {
      markAsRead: { useMutation: () => ({ mutate: mocks.mutate }) },
    },
  },
}));
let notify: IntersectionObserverCallback;
let observed: Element[];
beforeEach(() => {
  mocks.mutate.mockReset();
  observed = [];
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  document.body.innerHTML =
    '<article data-message-id="1"></article><article data-message-id="2"></article>';
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe(el: Element) {
        observed.push(el);
      }
      disconnect() {}
    }
  );
});
const messages = [
  { id: 1, senderId: "client", readBy: null },
  { id: 2, senderId: "artist", readBy: null },
];
function intersect() {
  notify(
    [
      {
        target: document.querySelector('[data-message-id="1"]')!,
        isIntersecting: true,
      } as IntersectionObserverEntry,
    ],
    {} as IntersectionObserver
  );
}
describe("visible message receipts", () => {
  it("marks only visible incoming messages", () => {
    renderHook(() => useReadReceipts(9, "artist", messages));
    expect(observed).toHaveLength(1);
    expect(mocks.mutate).not.toHaveBeenCalled();
    act(intersect);
    expect(mocks.mutate).toHaveBeenCalledWith(
      { conversationId: 9, messageIds: [1] },
      expect.any(Object)
    );
  });
  it("does not mark messages while the app is in the background", () => {
    renderHook(() => useReadReceipts(9, "artist", messages));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(intersect);
    expect(mocks.mutate).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
  });
});
