import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInboxRequests } from "./useInboxRequests";

const mocks = vi.hoisted(() => ({
  role: "artist",
  leadsError: new Error("Could not load booking requests"),
  refetchLeads: vi.fn(),
  refetchConsultations: vi.fn(),
}));
vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user", role: mocks.role } }),
}));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    funnel: {
      getLeads: {
        useQuery: () => ({
          data: undefined,
          isLoading: false,
          error: mocks.leadsError,
          refetch: mocks.refetchLeads,
        }),
      },
    },
    consultations: {
      list: {
        useQuery: () => ({
          data: [],
          isLoading: false,
          error: null,
          refetch: mocks.refetchConsultations,
        }),
      },
    },
  },
}));

beforeEach(() => {
  mocks.role = "artist";
  vi.clearAllMocks();
});

describe("inbox request recovery", () => {
  it("exposes request failures and retries both request sources", async () => {
    const hook = renderHook(() => useInboxRequests());
    expect(hook.result.current.error).toBe(mocks.leadsError);
    await hook.result.current.refetch();
    expect(mocks.refetchLeads).toHaveBeenCalledOnce();
    expect(mocks.refetchConsultations).toHaveBeenCalledOnce();
  });

  it("does not force artist-only request queries when a client retries their inbox", async () => {
    mocks.role = "client";
    const hook = renderHook(() => useInboxRequests());
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.requestItems).toEqual([]);
    await hook.result.current.refetch();
    expect(mocks.refetchLeads).not.toHaveBeenCalled();
    expect(mocks.refetchConsultations).not.toHaveBeenCalled();
  });
});
