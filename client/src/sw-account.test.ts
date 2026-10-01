// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, it, expect, vi } from "vitest";
function worker() {
  const handlers: Record<string, Function> = {};
  const store = new Map(); const show = vi.fn();
  const source = readFileSync(new URL("./sw.js", import.meta.url), "utf8");
  runInNewContext(source.slice(source.indexOf('const ownerCache'), source.indexOf('self.addEventListener("notificationclick"')), {
    self: { location: { origin: "https://fixture.test" }, addEventListener: (name: string, fn: Function) => handlers[name] = fn, registration: { showNotification: show } },
    caches: { open: async () => ({ match: async (key: string) => store.get(key)?.clone(), put: async (key: string, value: any) => store.set(key, value) }) },
    Response, URL, console: { log() {}, error() {} },
  });
  const fire = async (name: string, data: any) => {
    let pending: Promise<any> | undefined;
    handlers[name]({ data: name === "push" ? { json: () => data } : data, waitUntil: (p: Promise<any>) => pending = p });
    await pending;
  };
  return { show, fire };
}
describe("account-bound PWA push", () => {
  it("discards notifications from the previous account after switching or signing out", async () => {
    const w = worker();
    await w.fire("message", { type: "NOTIFICATION_OWNER", userId: "client" });
    await w.fire("push", { title: "Artist payment", data: { recipientUserId: "artist" } });
    expect(w.show).not.toHaveBeenCalled();
    await w.fire("push", { title: "Client payment", data: { recipientUserId: "client" } });
    expect(w.show).toHaveBeenCalledTimes(1);
    await w.fire("message", { type: "NOTIFICATION_OWNER", userId: "" });
    await w.fire("push", { data: { recipientUserId: "client" } });
    expect(w.show).toHaveBeenCalledTimes(1);
  });
});
