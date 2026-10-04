// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ progress: vi.fn(), update: vi.fn() }));
vi.mock("../_core/auth-router", () => ({
  authRouter: { _def: { procedures: {} } },
}));
vi.mock("../services/artistSetup", () => ({
  getArtistSetupProgress: mocks.progress,
}));
vi.mock("../db", () => ({ updateUserProfile: mocks.update }));
import { authRouter } from "./auth";
const caller = (role = "artist") =>
  authRouter.createCaller({
    user: { id: "artist-a", role },
    req: {},
    res: {},
  } as any);
beforeEach(() => vi.resetAllMocks());
describe("completion enforcement", () => {
  it("rejects completion without saved requirements", async () => {
    mocks.progress.mockResolvedValue({
      complete: false,
      steps: [{ title: "Your profile", done: false }],
    });
    await expect(caller().completeOnboarding()).rejects.toThrow(
      "Complete your profile"
    );
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("marks only the authenticated artist complete after validation", async () => {
    mocks.progress.mockResolvedValue({ complete: true });
    await caller().completeOnboarding();
    expect(mocks.progress).toHaveBeenCalledWith("artist-a");
    expect(mocks.update).toHaveBeenCalledWith("artist-a", {
      hasCompletedOnboarding: 1,
    });
  });
  it("keeps existing client onboarding behavior", async () => {
    await caller("client").completeOnboarding();
    expect(mocks.progress).not.toHaveBeenCalled();
  });
});
