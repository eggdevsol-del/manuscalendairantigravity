// @vitest-environment node
import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ push: vi.fn(), email: vi.fn() }));
vi.mock("../services/pushService", () => ({
  sendPushNotification: mocks.push,
}));
vi.mock("../services/email", () => ({ sendEmail: mocks.email }));
import { deliverOutboxItem } from "./outboxProcessor";
const item = (eventType: string, payload: unknown) =>
  ({ id: 42, eventType, payloadJson: JSON.stringify(payload) }) as any;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.push.mockResolvedValue({ success: true });
  mocks.email.mockResolvedValue(undefined);
});
describe("outbox delivery", () => {
  it("rejects unsupported jobs instead of claiming they were sent", async () => {
    await expect(deliverOutboxItem(item("unknown", {}), {})).rejects.toThrow(
      "Unsupported"
    );
  });
  it("does not silently deliver malformed pushes or missing booking emails", async () => {
    await expect(
      deliverOutboxItem(item("push_message", {}), {})
    ).rejects.toThrow();
    await expect(
      deliverOutboxItem(item("email_confirmation", {}), {})
    ).rejects.toThrow();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });
  it("uses the durable job ID as the email retry identity", async () => {
    const job = item("email", {
      to: "client@example.test",
      subject: "Booking",
      body: "Confirmed",
    });
    await deliverOutboxItem(job, {});
    await deliverOutboxItem(job, {});
    expect(mocks.email).toHaveBeenNthCalledWith(
      1,
      JSON.parse(job.payloadJson),
      "outbox-42"
    );
    expect(mocks.email).toHaveBeenNthCalledWith(
      2,
      JSON.parse(job.payloadJson),
      "outbox-42"
    );
  });
  it("propagates provider failure for retry", async () => {
    mocks.push.mockResolvedValue({ success: false });
    await expect(
      deliverOutboxItem(
        item("push_message", { targetUserId: "user", body: "Notification" }),
        {}
      )
    ).rejects.toThrow("did not succeed");
  });
});
