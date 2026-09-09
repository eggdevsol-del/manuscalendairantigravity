// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  values: vi.fn(),
  write: vi.fn(),
}));
vi.mock("../db", () => ({
  getDb: async () => ({
    query: { consentForms: { findFirst: mocks.find } },
    update: () => ({
      set: (values: unknown) => {
        mocks.values(values);
        return { where: mocks.write };
      },
    }),
  }),
}));
import { formsRouter } from "./forms";
import type { TrpcContext } from "../_core/context";
const caller = (id: string | null = "client-a") =>
  formsRouter.createCaller({
    user: id ? { id, role: "client" } : null,
    req: {},
    res: {},
  } as TrpcContext);
const signature = "data:image/png;base64,aGVsbG8=";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue({
    id: 1,
    clientId: "client-a",
    status: "pending",
    formType: "medical_release",
    title: "Medical history",
    content: "1. First question\n2. Second question",
  });
  mocks.write.mockResolvedValue([{ affectedRows: 1 }]);
});
describe("medical signing", () => {
  it("requires authentication and a form belonging to the client", async () => {
    await expect(
      caller(null).signForm({ formId: 1, signature })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    mocks.find.mockResolvedValue(undefined);
    await expect(
      caller().signForm({ formId: 2, signature })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.write).not.toHaveBeenCalled();
  });
  it("rejects omitted answers and preserves yes as well as no", async () => {
    await expect(
      caller().signForm({ formId: 1, signature, answers: { "1": "yes" } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.write).not.toHaveBeenCalled();
    await caller().signForm({
      formId: 1,
      signature,
      answers: { "1": "yes", "2": "no" },
    });
    expect(JSON.parse(mocks.values.mock.calls[0][0].formData)).toMatchObject({
      answers: { "1": "yes", "2": "no" },
      content: "1. First question\n2. Second question",
      signedBy: "client-a",
      version: 1,
    });
  });
  it("refuses replacement of a signed form and detects concurrent signing", async () => {
    mocks.find.mockResolvedValueOnce({ id: 1, status: "signed" });
    await expect(
      caller().signForm({ formId: 1, signature })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    mocks.write.mockResolvedValue([{ affectedRows: 0 }]);
    await expect(
      caller().signForm({
        formId: 1,
        signature,
        answers: { "1": "no", "2": "no" },
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
