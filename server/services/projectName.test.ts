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
        designBriefs: { findFirst: vi.fn().mockResolvedValue(null) },
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

it("rejects operational output instead of saving activity as a tattoo title", async () => {
  invoke.mockResolvedValue({
    choices: [
      { message: { content: "Session rescheduling/pricing discussion" } },
    ],
  });
  const db = {
    query: {
      messages: {
        findMany: async () => [
          { content: "Can we change the date?", messageType: "text" },
        ],
      },
      designBriefs: { findFirst: async () => null },
    },
  };
  expect(await generateProjectName(db as any, 12, "Booking discussion")).toBe(
    "Tattoo project"
  );
});
it("uses design brief context and ignores system traffic", async () => {
  invoke.mockClear();
  invoke.mockResolvedValue({
    choices: [{ message: { content: "Botanical forearm sleeve" } }],
  });
  const db = {
    query: {
      messages: {
        findMany: async () => [
          { content: "Deposit paid", messageType: "system" },
        ],
      },
      designBriefs: {
        findFirst: async () => ({
          briefText: "Botanical forearm sleeve",
          conversationSummary: "Payment pending",
        }),
      },
    },
  };
  expect(await generateProjectName(db as any, 12)).toBe(
    "Botanical forearm sleeve"
  );
  const prompt = invoke.mock.calls[0][0].messages[1].content;
  expect(prompt).toContain("Botanical forearm sleeve");
  expect(prompt).not.toContain("Deposit paid");
});
it("does not invent a tattoo from a service name when context is absent", async () => {
  const db = {
    query: {
      messages: { findMany: async () => [] },
      designBriefs: { findFirst: async () => null },
    },
  };
  expect(await generateProjectName(db as any, 12, "Full day")).toBe(
    "Tattoo project"
  );
});
