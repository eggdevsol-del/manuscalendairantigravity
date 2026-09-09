import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useConversationDraft } from "./useConversationDraft";
beforeEach(() => sessionStorage.clear());
describe("conversation drafts", () => {
  it("restores after navigation and never crosses conversation or account boundaries", () => {
    const hook = renderHook(({ id, user }) => useConversationDraft(id, user), {
      initialProps: { id: 1, user: "a" },
    });
    act(() => hook.result.current[1]("My unfinished message"));
    hook.rerender({ id: 2, user: "a" });
    expect(hook.result.current[0]).toBe("");
    hook.rerender({ id: 1, user: "b" });
    expect(hook.result.current[0]).toBe("");
    hook.rerender({ id: 1, user: "a" });
    expect(hook.result.current[0]).toBe("My unfinished message");
    act(() => hook.result.current[1](""));
    hook.unmount();
    const restored = renderHook(() => useConversationDraft(1, "a"));
    expect(restored.result.current[0]).toBe("");
  });
});
