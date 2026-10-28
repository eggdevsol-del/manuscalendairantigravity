import { describe, expect, it } from "vitest";
import { firstStoredImage } from "./projectImages";

describe("project images", () => {
  it("takes the first usable URL from stored lists, skipping inline data", () => {
    expect(firstStoredImage('["data:image/png;base64,AAA","https://cdn.example/ref.jpg"]')).toBe(
      "https://cdn.example/ref.jpg"
    );
    expect(firstStoredImage(null, '[{"url":"/uploads/placement.jpg"}]')).toBe("/uploads/placement.jpg");
    expect(firstStoredImage("https://cdn.example/plain.jpg")).toBe("https://cdn.example/plain.jpg");
    expect(firstStoredImage("[]", null)).toBeNull();
  });
});
