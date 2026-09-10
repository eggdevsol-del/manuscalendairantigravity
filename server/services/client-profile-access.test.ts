// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  relationship: vi.fn(),
  user: vi.fn(),
  calendar: vi.fn(),
}));
vi.mock("../db", () => ({
  getDb: mocks.db,
  getUser: mocks.user,
  getClientCalendar: mocks.calendar,
}));
import { clientProfileRouter } from "../routers/clientProfile";
const caller = (role = "artist", id = "artist") =>
  clientProfileRouter.createCaller({
    user: { id, role },
    req: {},
    res: {},
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.relationship.mockResolvedValue({ id: 1 });
  mocks.db.mockResolvedValue({
    query: { conversations: { findFirst: mocks.relationship } },
  });
  mocks.user.mockResolvedValue({
    id: "client",
    name: "Mia",
    password: "private-hash",
    clerkId: "private-clerk",
    googleSub: "private-oauth",
    savedSignature: "private-signature",
  });
});
describe("client profile privacy", () => {
  it("rejects unrelated artist access before loading profile data", async () => {
    mocks.relationship.mockResolvedValue(undefined);
    await expect(
      caller().getProfile({ clientId: "client" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("never exposes credentials or another person's reusable signature", async () => {
    const profile = await caller().getProfile({ clientId: "client" });
    expect(profile).toMatchObject({
      id: "client",
      name: "Mia",
      savedSignature: null,
    });
    expect(profile).not.toHaveProperty("password");
    expect(profile).not.toHaveProperty("clerkId");
    expect(profile).not.toHaveProperty("googleSub");
  });
  it("allows self access without requiring an artist relationship", async () => {
    const profile = await caller("client", "client").getProfile();
    expect(profile.savedSignature).toBe("private-signature");
    expect(mocks.relationship).not.toHaveBeenCalled();
    expect(profile).not.toHaveProperty("password");
  });
  it("scopes spend information to the requesting artist", async () => {
    mocks.calendar.mockResolvedValue([
      { artistId: "artist", status: "completed", price: 100 },
      { artistId: "another-artist", status: "completed", price: 900 },
    ]);
    expect(await caller().getSpendSummary({ clientId: "client" })).toEqual({
      totalSpend: 100,
      maxSingleSpend: 100,
      appointmentCount: 1,
    });
  });
});
