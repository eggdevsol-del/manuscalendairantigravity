import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useMessageHistory, mergeMessageHistory } from "./useMessageHistory";
const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/trpc", () => ({
  trpc: { useUtils: () => ({ messages: { list: { fetch } } }) },
}));
const row = (id: number) => ({
  id,
  createdAt: "2026-09-16T00:00:00Z",
  content: `Message ${id}`,
});
it("deduplicates overlapping pages and uses ID as a timestamp tie breaker", () => {
  expect(
    mergeMessageHistory(
      [row(2), row(1)],
      [{ ...row(2), content: "updated" }, row(3)]
    )
  ).toEqual([row(1), { ...row(2), content: "updated" }, row(3)]);
});
it("loads older history through the oldest composite cursor and detects exhaustion", async () => {
  fetch.mockResolvedValue([row(99), row(100)]);
  const latest = Array.from({ length: 100 }, (_, i) => row(i + 101));
  const h = renderHook(() => useMessageHistory(12, latest));
  await act(() => h.result.current.loadOlderMessages());
  expect(fetch).toHaveBeenCalledWith({
    conversationId: 12,
    limit: 100,
    before: { id: 101, createdAt: latest[0].createdAt },
  });
  expect(h.result.current.messages).toHaveLength(102);
  expect(h.result.current.hasOlderMessages).toBe(false);
});
it("retains a failed history request for retry without losing the current page", async () => {
  fetch.mockRejectedValue(new Error("Offline"));
  const latest = Array.from({ length: 100 }, (_, i) => row(i + 101));
  const h = renderHook(() => useMessageHistory(12, latest));
  await act(() => h.result.current.loadOlderMessages());
  expect(h.result.current.olderMessagesError).toContain("Try again");
  expect(h.result.current.messages).toHaveLength(100);
  expect(h.result.current.hasOlderMessages).toBe(true);
});
it("retains a message displaced from the newest page by an incoming message", () => {
  const latest = Array.from({ length: 100 }, (_, i) => row(i + 101));
  const h = renderHook(({ data }) => useMessageHistory(12, data), {
    initialProps: { data: latest },
  });
  h.rerender({ data: [...latest.slice(1), row(201)] });
  expect(h.result.current.messages).toHaveLength(101);
  expect(h.result.current.messages[0].id).toBe(101);
});
