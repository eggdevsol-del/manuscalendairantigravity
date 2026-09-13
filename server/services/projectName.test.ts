// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("../_core/llm", () => ({ invokeLLM: invoke }));
import { generateProjectName } from "./llmEnrichment";
describe("project naming", () => {
  it("uses the model's tattoo-specific title", async () => {
    invoke.mockResolvedValue({
      choices: [{ message: { content: "Jesus/Angels full arm" } }],
    });
    const db = {
      query: {
        messages: {
          findMany: vi.fn().mockResolvedValue([
            {
              senderId: "client",
              content: "A full sleeve of Jesus and the archangels",
            },
          ]),
        },
      },
    };
    expect(
      await generateProjectName(
        db as any,
        12,
        "Full day",
        "2026-09-01 12:00:00"
      )
    ).toBe("Jesus/Angels full arm");
    expect(invoke.mock.calls[0][0].messages[1].content).toContain(
      "Jesus and the archangels"
    );
  });
});
