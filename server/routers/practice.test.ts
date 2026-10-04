import { describe, it, expect, vi, beforeEach } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const store = vi.hoisted(
  () => new Map<string, { revision: number; state: string }>()
);
vi.mock("../services/core", () => {
  const database = {
    execute: async (statement: any) => {
      const query = new MySqlDialect().sqlToQuery(statement);
      const p = query.params;
      if (query.sql.startsWith("INSERT")) {
        const id = String(p[0]);
        if (!store.has(id)) store.set(id, { revision: 0, state: String(p[1]) });
        return [{}, []];
      }
      if (query.sql.startsWith("SELECT")) {
        const row = store.get(String(p[0]));
        return [row ? [row] : [], []];
      }
      if (query.sql.startsWith("UPDATE")) {
        store.set(String(p[2]), {
          revision: Number(p[0]),
          state: String(p[1]),
        });
        return [{}, []];
      }
      throw new Error("Unexpected table access");
    },
  };
  return {
    getDb: async () => database,
    withDatabaseTransaction: async (work: any) => work(database),
  };
});
import { practiceRouter } from "./practice";
function caller(id = "artist-a", role = "artist") {
  return practiceRouter.createCaller({
    user: { id, role },
    req: {},
    res: {},
  } as any);
}
beforeEach(() => store.clear());
describe("practice API ownership and revision control", () => {
  it("persists independent sessions for two artists", async () => {
    const a = caller();
    const b = caller("artist-b");
    await a.session();
    await b.session();
    const changed = await a.command({
      revision: 0,
      action: "start",
      chapterId: "enquiry",
    });
    expect(changed.chapterId).toBe("enquiry");
    expect((await b.session()).chapterId).toBeNull();
    expect(store.size).toBe(2);
  });
  it.each(["client", "merchant", "master_dev", "disabled_artist"])(
    "denies %s roles",
    async role => {
      await expect(caller("wrong", role).session()).rejects.toThrow();
      expect(store.size).toBe(0);
    }
  );
  it("rejects stale commands rather than overwriting newer progress", async () => {
    const a = caller();
    await a.session();
    await a.command({ revision: 0, action: "start", chapterId: "enquiry" });
    await expect(a.command({ revision: 0, action: "reset" })).rejects.toThrow(
      "another tab"
    );
    expect((await a.session()).chapterId).toBe("enquiry");
  });
  it("persists no changes after a simulated failure", async () => {
    const a = caller();
    await a.session();
    await a.command({ revision: 0, action: "start", chapterId: "enquiry" });
    await expect(
      a.command({
        revision: 1,
        action: "advance",
        stepId: "request",
        outcome: "failure",
      })
    ).rejects.toThrow("nothing changed");
    expect((await a.session()).revision).toBe(1);
  });
  it("rejects unknown steps without changing a booking", async () => {
    const a = caller();
    await a.session();
    await a.command({ revision: 0, action: "start", chapterId: "enquiry" });
    await expect(
      a.command({ revision: 1, action: "advance", stepId: "balance" })
    ).rejects.toThrow("already changed");
    expect((await a.session()).booking.paid).toBe(25000);
  });
  it("reset only touches the calling artist session", async () => {
    const a = caller();
    const b = caller("artist-b");
    await a.session();
    await b.session();
    await b.command({ revision: 0, action: "start", chapterId: "voucher" });
    await a.command({ revision: 0, action: "reset" });
    expect((await b.session()).chapterId).toBe("voucher");
  });
});

describe("real-control practice API", () => {
  it("persists a control action only for the authenticated artist", async () => {
    const a = caller(),
      b = caller("artist-b");
    await a.session();
    await b.session();
    const result = await a.controlMutation({
      revision: 0,
      path: "messages.send",
      input: { conversationId: 999, content: "Mock question" },
    });
    expect(result.state.messages.at(-1)?.text).toBe("Mock question");
    expect((await b.session()).messages).not.toEqual(result.state.messages);
    expect(
      (await a.controlQuery({ path: "conversations.getById", input: 999 })).id
    ).toBe(1);
  });
  it("rejects stale control actions without replacing progress", async () => {
    const a = caller();
    await a.session();
    await a.controlMutation({
      revision: 0,
      path: "messages.send",
      input: { content: "First" },
    });
    await expect(
      a.controlMutation({
        revision: 0,
        path: "messages.send",
        input: { content: "Stale" },
      })
    ).rejects.toThrow("Practice changed");
    expect((await a.session()).messages.at(-1)?.text).toBe("First");
  });
  it("rejects non-artist access to the control adapter", async () => {
    await expect(
      caller("client", "client").controlQuery({ path: "auth.me" })
    ).rejects.toThrow();
    expect(store.size).toBe(0);
  });
  it("cannot call a provider through the control mutation endpoint", async () => {
    await expect(
      caller().controlMutation({
        revision: 0,
        path: "upload.realProviderUpload" as any,
        input: {},
      })
    ).rejects.toThrow();
    expect(store.size).toBe(0);
  });
});
