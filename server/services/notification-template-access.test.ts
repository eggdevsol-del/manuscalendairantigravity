// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../db", () => ({
  getNotificationTemplates: mocks.list,
  updateNotificationTemplate: mocks.update,
  deleteNotificationTemplate: mocks.remove,
}));
import { notificationTemplatesRouter } from "../routers/notificationTemplates";
const caller = () =>
  notificationTemplatesRouter.createCaller({
    user: { id: "artist", role: "artist" },
    req: {},
    res: {},
  } as any);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([{ id: 7, userId: "artist" }]);
});
describe("notification template ownership", () => {
  it("rejects editing another artist's template", async () => {
    await expect(
      caller().update({ id: 8, title: "Changed" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("rejects deleting another artist's template", async () => {
    await expect(caller().delete(8)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it("allows the owner to edit their template", async () => {
    await caller().update({ id: 7, title: "Reminder", enabled: false });
    expect(mocks.list).toHaveBeenCalledWith("artist");
    expect(mocks.update).toHaveBeenCalledWith(7, {
      title: "Reminder",
      enabled: 0,
    });
  });
});
