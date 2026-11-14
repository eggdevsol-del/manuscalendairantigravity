// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ settings: vi.fn(), parse: vi.fn() }));
vi.mock("../db", () => ({ getArtistSettings: mocks.settings }));
vi.mock("../services/core", () => ({ getDb: vi.fn() }));
vi.mock("../services/icalParser", () => ({
  parseExternalCalendar: mocks.parse,
}));
import { artistSettingsRouter } from "./artistSettings";

const caller = (role: string, id: string) =>
  artistSettingsRouter.createCaller({
    user: { id, role },
    req: {},
    res: {},
  } as any);

beforeEach(() => vi.clearAllMocks());

describe("artist settings shown to other people", () => {
  it("never includes bank details", async () => {
    mocks.settings.mockResolvedValue({
      businessName: "Ink",
      bsb: "062000",
      accountNumber: "12345678",
      services: "[]",
    });
    const result = await caller("client", "stranger").getPublicByArtistId({
      artistId: "artist",
    });
    expect(result).toMatchObject({ businessName: "Ink", services: "[]" });
    expect(result).not.toHaveProperty("bsb");
    expect(result).not.toHaveProperty("accountNumber");
  });
});

describe("calendar link test", () => {
  it("does not echo why a fetch failed", async () => {
    mocks.parse.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.5:6379")
    );
    const result = await caller("artist", "artist").testExternalCalendarUrl({
      url: "https://example.com/a.ics",
    });
    expect(result.success).toBe(false);
    expect(result.message).not.toContain("ECONNREFUSED");
    expect(result.message).not.toContain("10.0.0.5");
  });
});
