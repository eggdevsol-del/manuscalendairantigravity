import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useIvoryPalette } from "./useIvoryPalette";

const css = readFileSync("client/src/ui/ivory-theme.css", "utf8");
function palette(selector: string) {
  const block = css.slice(css.indexOf(selector)).split("}")[0];
  return Object.fromEntries(Array.from(block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/g)).map(m => [m[1], m[2]]));
}
function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
for (const mode of [":root {", ".dark {"]) {
  describe(mode, () => {
    const p = palette(mode);
    for (const [fg, bg] of [["--foreground", "--background"], ["--muted-foreground", "--background"], ["--primary-foreground", "--primary"], ["--card-foreground", "--card"], ["--destructive", "--background"]]) {
      it(`${fg} is readable on ${bg}`, () => {
        const values = [luminance(p[fg]), luminance(p[bg])].sort((a,b) => a-b);
        expect((values[1]+0.05)/(values[0]+0.05)).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}
afterEach(() => { cleanup(); document.documentElement.classList.remove("dark"); document.querySelector("#ivory-test-style")?.remove(); });
it("updates provider colours when the existing theme changes without remounting checkout", async () => {
  const style = document.createElement("style");
  style.id = "ivory-test-style";
  style.textContent = css;
  document.head.append(style);
  const { result } = renderHook(useIvoryPalette);
  expect(result.current.primary).toBe("#382c24");
  document.documentElement.classList.add("dark");
  await waitFor(() => expect(result.current.primary).toBe("#e3d6c5"));
  expect(result.current.surface).toBe("#29251f");
  document.documentElement.classList.remove("dark");
  await waitFor(() => expect(result.current.primary).toBe("#382c24"));
});
