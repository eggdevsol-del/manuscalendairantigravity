import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ invalidate: vi.fn(), cancel: vi.fn(), setData: vi.fn(), detach: vi.fn() }));
vi.mock("@/const", () => ({ getLoginUrl: () => "/login" }));
vi.mock("@/lib/errorReporter", () => ({ setErrorUser: vi.fn() }));
vi.mock("@/lib/onesignal", () => ({ removeExternalUserId: m.detach }));
vi.mock("@/lib/trpc", () => ({ trpc: {
  useUtils: () => ({ auth: { me: { invalidate: m.invalidate, cancel: m.cancel, setData: m.setData } } }),
  auth: {
    me: { useQuery: () => ({ data: null, isFetched: true, isLoading: false }) },
    logout: { useMutation: () => ({ mutateAsync: async () => {}, isPending: false }) },
    refreshToken: { useMutation: () => ({ mutate: vi.fn() }) },
  },
} }));
import { useAuth } from "./useAuth";
describe("logout account isolation", () => {
  it("clears both bearer token stores before refreshing auth, and detaches push identity", async () => {
    localStorage.setItem("authToken", "artist-fixture"); sessionStorage.setItem("authToken", "client-fixture");
    m.invalidate.mockImplementation(async () => {
      expect(localStorage.getItem("authToken")).toBeNull();
      expect(sessionStorage.getItem("authToken")).toBeNull();
    });
    const { result } = renderHook(() => useAuth());
    await act(async () => result.current.logout());
    expect(m.cancel).toHaveBeenCalled(); expect(m.invalidate).toHaveBeenCalled(); expect(m.detach).toHaveBeenCalled();
  });
});
