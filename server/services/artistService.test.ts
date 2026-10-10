import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), insert: vi.fn(), update: vi.fn(), reads: [] as any[] }));
vi.mock("./core", () => ({ getDb: mocks.getDb }));
import { upsertArtistSettings } from "./artistService";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.reads = [];
  mocks.getDb.mockResolvedValue({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.reads.shift() || [] }) }) }),
    insert: () => ({ values: mocks.insert.mockResolvedValue({}) }),
    update: () => ({ set: (value: unknown) => { mocks.update(value); return { where: async () => ({}) }; } }),
  });
});
describe("artist settings partial saves", () => {
  it("initialises required JSON fields on the first business-details save", async () => {
    mocks.reads = [[], [{ userId: "artist-test", businessAddress: "Test address", workSchedule: "{}", services: "[]" }]];
    const saved = await upsertArtistSettings({ userId: "artist-test", businessAddress: "Test address" } as any);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ workSchedule: "{}", services: "[]" }));
    expect(saved?.businessAddress).toBe("Test address");
  });
  it("preserves explicitly provided initial availability and services", async () => {
    await upsertArtistSettings({ userId: "artist-test", workSchedule: '{"monday":{"enabled":true}}', services: '[{"name":"Full day"}]' } as any);
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ workSchedule: '{"monday":{"enabled":true}}', services: '[{"name":"Full day"}]' }));
  });
  it("does not overwrite existing availability or services during a partial edit", async () => {
    mocks.reads = [[{ userId: "artist-test", workSchedule: "existing schedule", services: "existing services" }]];
    await upsertArtistSettings({ userId: "artist-test", businessAddress: "New address" } as any);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("workSchedule");
    expect(mocks.update.mock.calls[0][0]).not.toHaveProperty("services");
  });
  it("does not report a successful save when the database is unavailable", async () => {
    mocks.getDb.mockResolvedValue(null);
    await expect(upsertArtistSettings({ userId: "artist-test" } as any)).rejects.toThrow("Couldn’t save");
  });
});
