import { describe, it, expect } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateWorkspace } from "./workspaceSync";
describe("shared workspace refresh", () => {
  it("invalidates every cached workspace view while preserving auth and the revision probe", async () => {
    const client = new QueryClient();
    const keys = ["appointments", "sessionPlans", "projects", "messages", "dashboard", "offers", "storefront", "auth", "system", "push"].map(name => [[name, "fixture"], { type: "query" }]);
    keys.forEach(key => client.setQueryData(key, { value: 1 }));
    await invalidateWorkspace(client);
    keys.forEach((key, i) => expect(client.getQueryState(key)?.isInvalidated).toBe(i < 7));
  });
});
