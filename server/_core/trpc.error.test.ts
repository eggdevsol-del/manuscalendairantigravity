import { describe, expect, it } from "vitest";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "./trpc";
describe("client error responses", () => {
  it("does not expose database query parameters or stack traces", async () => {
    const app = router({ broken: protectedProcedure.query(() => {
      throw new Error("Failed query: insert into artistSettings params: private@example.test");
    }) });
    const response = await fetchRequestHandler({
      endpoint: "/trpc", req: new Request("http://localhost/trpc/broken"), router: app,
      createContext: () => ({ user: { id: "qa", role: "artist" } }) as any,
    });
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).toContain("Please try again");
    expect(text).not.toContain("artistSettings");
    expect(text).not.toContain("private@example.test");
    expect(text).not.toContain('"stack"');
  });
  it("preserves actionable validation messages", async () => {
    const app = router({ invalid: protectedProcedure.query(() => {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a working day." });
    }) });
    const response = await fetchRequestHandler({
      endpoint: "/trpc", req: new Request("http://localhost/trpc/invalid"), router: app,
      createContext: () => ({ user: { id: "qa", role: "artist" } }) as any,
    });
    expect(response.status).toBe(400);
    expect(await response.text()).toContain("Choose a working day.");
  });
});
