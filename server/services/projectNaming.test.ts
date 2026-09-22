// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), generate: vi.fn() }));
vi.mock("./core", () => ({ withDatabaseTransaction: mocks.transaction }));
vi.mock("./llmEnrichment", () => ({ generateProjectName: mocks.generate }));
import { processProjectName, savedProjectName } from "./projectNaming";
import * as schema from "../../drizzle/schema";

function database(plan: any, appointments: any[] = [], metadata?: string) {
  const writes: { table: unknown; value: any }[] = [];
  const chain: any = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    for: async () => (plan ? [plan] : []),
  };
  const db: any = {
    select: () => chain,
    update: (table: unknown) => ({
      set: (value: any) => ({
        where: async () => {
          writes.push({ table, value });
        },
      }),
    }),
    query: {
      appointments: { findMany: async () => appointments },
      messages: {
        findFirst: async () => (metadata ? { id: 7, metadata } : null),
      },
      sessionPlans: { findFirst: async () => null },
    },
  };
  mocks.transaction.mockImplementation(fn => fn(db));
  return writes;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "test-only");
});
describe("persistent project naming", () => {
  it("prioritises canonical/manual names over stale mirrors", () => {
    expect(savedProjectName("Rose tribute", "Old sleeve", "Old flower")).toBe(
      "Rose tribute"
    );
    expect(
      savedProjectName(null, "Session rescheduling", "Botanical sleeve")
    ).toBe("Botanical sleeve");
  });
  it("adopts a saved name without calling AI", async () => {
    const writes = database(
      { id: 1, messageId: null, conversationId: 4, projectNameAttempts: 0 },
      [{ projectName: "Rose sleeve" }]
    );
    await processProjectName();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(
      writes.find(w => w.table === schema.sessionPlans)?.value.projectName
    ).toBe("Rose sleeve");
  });
  it("names imported projects without an original message", async () => {
    mocks.generate.mockResolvedValue("Dragon backpiece");
    const writes = database({
      id: 1,
      messageId: null,
      conversationId: 4,
      projectNameAttempts: 0,
    });
    await processProjectName();
    expect(
      writes.find(w => w.table === schema.sessionPlans)?.value.projectName
    ).toBe("Dragon backpiece");
    expect(writes.some(w => w.table === schema.messages)).toBe(false);
  });
  it("keeps an unavailable AI result out of persisted names and schedules retry", async () => {
    mocks.generate.mockResolvedValue("Tattoo project");
    const writes = database({
      id: 1,
      messageId: null,
      conversationId: 4,
      projectNameAttempts: 1,
    });
    await processProjectName();
    expect(writes[0].value).toMatchObject({ projectNameAttempts: 2 });
    expect(writes[0].value.projectName).toBeUndefined();
    expect(writes[0].value.projectNameRetryAt).toBeTruthy();
  });
  it("leaves projects with no conversation for artist naming without AI", async () => {
    const writes = database({
      id: 1,
      messageId: null,
      conversationId: null,
      projectNameAttempts: 2,
    });
    await processProjectName();
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(writes[0].value.projectNameAttempts).toBe(3);
  });
  it("preserves proposal metadata when saving the name", async () => {
    const writes = database(
      { id: 1, messageId: 7, conversationId: 4, projectNameAttempts: 0 },
      [],
      JSON.stringify({
        projectName: "Dragon sleeve",
        totalEstimateCents: 60000,
      })
    );
    await processProjectName();
    expect(
      JSON.parse(writes.find(w => w.table === schema.messages)!.value.metadata)
    ).toEqual({ projectName: "Dragon sleeve", totalEstimateCents: 60000 });
  });
});
