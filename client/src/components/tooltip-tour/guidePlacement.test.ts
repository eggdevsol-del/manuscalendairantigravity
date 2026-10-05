import { describe, it, expect } from "vitest";
import { placeGuide, type GuideRect, type GuideBounds } from "./guidePlacement";
const bounds = { left: 12, top: 12, right: 378, bottom: 730 };
const inside = (
  p: ReturnType<typeof placeGuide>,
  b: GuideBounds,
  height: number
) => {
  expect(p.left).toBeGreaterThanOrEqual(b.left);
  expect(p.top).toBeGreaterThanOrEqual(b.top);
  expect(p.left + p.width).toBeLessThanOrEqual(b.right);
  expect(p.top + Math.min(height, p.maxHeight)).toBeLessThanOrEqual(b.bottom);
};
describe("shared guide placement", () => {
  it("follows the highlighted control below, then above near the bottom", () => {
    const start = placeGuide(
      { left: 100, top: 40, width: 40, height: 40 },
      bounds,
      { width: 320, height: 160 }
    );
    expect(start.top).toBe(94);
    const moved = placeGuide(
      { left: 100, top: 650, width: 40, height: 40 },
      bounds,
      { width: 320, height: 160 }
    );
    expect(moved.top).toBe(476);
    inside(start, bounds, 160);
    inside(moved, bounds, 160);
  });
  it("uses side space without covering the highlighted control on wide screens", () => {
    const b = { left: 12, top: 12, right: 1000, bottom: 500 };
    const p = placeGuide({ left: 20, top: 180, width: 80, height: 200 }, b, {
      width: 320,
      height: 250,
    });
    expect(p.left).toBe(114);
    inside(p, b, 250);
  });
  it("keeps long text, edge controls and keyboard-sized viewports within bounds", () => {
    const boxes: GuideBounds[] = [
      bounds,
      { left: 12, top: 80, right: 308, bottom: 260 },
      { left: 12, top: 12, right: 200, bottom: 92 },
    ];
    const targets: (GuideRect | null)[] = [
      null,
      { left: -100, top: -100, width: 80, height: 60 },
      { left: 300, top: 700, width: 100, height: 50 },
      { left: 0, top: 0, width: 390, height: 800 },
    ];
    for (const b of boxes)
      for (const target of targets)
        for (const height of [60, 180, 900])
          inside(placeGuide(target, b, { width: 340, height }), b, height);
  });
});
