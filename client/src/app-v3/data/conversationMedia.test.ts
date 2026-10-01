import { expect, it } from "vitest";
import { conversationMedia } from "./messagePresentation";
it("includes individual and grouped photos once, ignoring unsafe and non-image messages", () => {
  expect(
    conversationMedia([
      { messageType: "image", content: "https://example.com/a.webp" },
      {
        messageType: "system",
        content: JSON.stringify({
          images: [
            "https://example.com/a.webp",
            "https://example.com/b.webp",
            "javascript:bad",
          ],
        }),
      },
      { messageType: "text", content: "https://example.com/not-photo" },
      { messageType: "image", content: "javascript:bad" },
    ])
  ).toEqual(["https://example.com/a.webp", "https://example.com/b.webp"]);
});
