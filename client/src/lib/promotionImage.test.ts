import { expect, it } from "vitest";
import { promotionImageSize } from "./promotionImage";
it("fits large originals without stretching or enlarging small photos", () => {
  expect(promotionImageSize(12000, 6000)).toEqual({ width: 2048, height: 1024 });
  expect(promotionImageSize(3000, 6000)).toEqual({ width: 1024, height: 2048 });
  expect(promotionImageSize(400, 200)).toEqual({ width: 400, height: 200 });
  expect(() => promotionImageSize(0, 10)).toThrow();
});
