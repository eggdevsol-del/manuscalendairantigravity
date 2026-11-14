// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: vi.fn(),
  relationship: vi.fn(),
  relationships: vi.fn(),
  user: vi.fn(),
  calendar: vi.fn(),
}));
vi.mock("../db", () => ({
  getDb: mocks.db,
  getUser: mocks.user,
  getClientCalendar: mocks.calendar,
}));
vi.mock("./userService", () => ({
  hasClientRelationship: mocks.relationship,
  getClientRelationships: mocks.relationships,
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
  mocks.relationship.mockResolvedValue(true);
  mocks.db.mockResolvedValue({});
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
    mocks.relationship.mockResolvedValue(false);
    await expect(
      caller().getProfile({ clientId: "client" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.relationship).toHaveBeenCalledWith(
      expect.anything(),
      "artist",
      "client"
    );
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

describe("an artist editing a client's name and phone", () => {
  const set = vi.fn();
  const sets = (related: string[] = [], unclaimed: string[] = []) => ({
    related: new Set(related),
    unclaimed: new Set(unclaimed),
  });
  beforeEach(() => {
    set.mockReset();
    set.mockReturnValue({ where: async () => undefined });
    mocks.db.mockResolvedValue({ update: () => ({ set }) });
    mocks.user.mockResolvedValue({
      id: "client",
      name: "Mia Wong",
      phone: "0400000000",
    });
  });

  it("is refused on a bare conversation, for admins too", async () => {
    mocks.relationships.mockResolvedValue(sets());
    for (const role of ["artist", "admin"])
      await expect(
        caller(role).updateClientProfile({ clientId: "client", name: "x" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(set).not.toHaveBeenCalled();
  });

  it("never rewrites a signed-up client's account", async () => {
    mocks.relationships.mockResolvedValue(sets(["client"]));
    await expect(
      caller().updateClientProfile({
        clientId: "client",
        name: "Mia Wong",
        phone: "0499999999",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().updateClientProfile({
        clientId: "client",
        name: "Renamed",
        phone: "0400000000",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().updateClientProfile({
        clientId: "client",
        name: "Mia Wong",
        phone: "",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(set).not.toHaveBeenCalled();
  });

  it("lets the booking editor save a signed-up client's contact tab unchanged", async () => {
    mocks.relationships.mockResolvedValue(sets(["client"]));
    expect(
      await caller().updateClientProfile({
        clientId: "client",
        name: "Mia Wong",
        phone: "0400000000",
      })
    ).toEqual({ success: true });
    expect(set).not.toHaveBeenCalled();
  });

  it("edits a client record nobody has signed in to", async () => {
    mocks.relationships.mockResolvedValue(sets(["client"], ["client"]));
    await caller().updateClientProfile({
      clientId: "client",
      name: " Mia W ",
      phone: "0411111111",
    });
    expect(set).toHaveBeenLastCalledWith({ name: "Mia W", phone: "0411111111" });
    // No phone sent means the stored number is left alone.
    await caller().updateClientProfile({ clientId: "client", name: "Mia W" });
    expect(set).toHaveBeenLastCalledWith({ name: "Mia W" });
  });
});
