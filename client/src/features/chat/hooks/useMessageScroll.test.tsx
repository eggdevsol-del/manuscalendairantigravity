import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useMessageScroll } from "./useMessageScroll";
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
function fixture() {
  let resize = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: () => void) {
        resize = cb;
      }
      observe() {}
      disconnect() {}
    }
  );
  const el = document.createElement("div"),
    stream = document.createElement("div"),
    row = document.createElement("article");
  stream.className = "v3-message-stream";
  row.dataset.messageId = "7";
  stream.append(row);
  el.append(stream);
  document.body.append(el);
  let height = 500,
    offset = 20;
  Object.defineProperty(el, "scrollHeight", { get: () => height });
  el.scrollTo = vi.fn();
  el.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
  row.getBoundingClientRect = () =>
    ({ top: offset, bottom: offset + 60 }) as DOMRect;
  return {
    el,
    resize: () => resize(),
    grow: () => {
      height = 820;
      offset = 340;
    },
  };
}
it("follows the bottom when a delayed image grows the stream", () => {
  const f = fixture();
  renderHook(() => useMessageScroll({ current: f.el }, [], true));
  act(() => {
    f.grow();
    f.resize();
  });
  expect(f.el.scrollTo).toHaveBeenLastCalledWith({
    top: 820,
    behavior: "instant",
  });
});
it("preserves the visible message while reading history when media grows above it", () => {
  const f = fixture();
  renderHook(() => useMessageScroll({ current: f.el }, [], false));
  act(() => {
    f.grow();
    f.resize();
  });
  expect(f.el.scrollTop).toBe(320);
  expect(f.el.scrollTo).not.toHaveBeenCalled();
});
it("does not write scrollTop when an unchanged history anchor is already correct", () => {
  const f = fixture(),
    write = vi.fn();
  Object.defineProperty(f.el, "scrollTop", { get: () => 100, set: write });
  renderHook(() => useMessageScroll({ current: f.el }, [], false));
  act(() => f.resize());
  expect(write).not.toHaveBeenCalled();
});
