import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  test: vi.fn().mockResolvedValue({ success: true, results: [] }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    push: {
      subscribe: { useMutation: () => ({}) },
      unsubscribe: { useMutation: () => ({}) },
      test: {
        useMutation: () => ({ mutateAsync: mocks.test, isPending: false }),
      },
      getPublicKey: { useQuery: () => ({}) },
    },
  },
}));
vi.mock("@/features/practice/PracticeContext", () => ({
  usePractice: () => null,
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), warning: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { useWebPush } from "./useWebPush";

describe("useWebPush.sendTestPush", () => {
  it("never names another person: the server only pushes to the caller", async () => {
    const { result } = renderHook(() => useWebPush());
    await act(async () => {
      await result.current.sendTestPush({
        title: "Reminder",
        body: "See you tomorrow",
        // A stale caller passing a client id must not reach the server.
        ...({ targetUserId: "client-1" } as object),
      });
    });
    expect(mocks.test).toHaveBeenCalledWith({
      title: "Reminder",
      body: "See you tomorrow",
    });
  });
});
