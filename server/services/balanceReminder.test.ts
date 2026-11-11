// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  due: [] as any[],
  client: null as any,
  email: vi.fn(),
  sms: vi.fn(),
  push: vi.fn(),
  update: vi.fn(),
  smsAvailable: true,
}));
vi.mock("./core", () => ({
  getDb: async () => ({
    query: {
      appointments: { findMany: async () => mocks.due },
      users: { findFirst: async () => mocks.client },
      artistSettings: {
        findFirst: async () => ({ businessName: "Rory Vale Tattoo" }),
      },
    },
    update: () => ({ set: (v: any) => ({ where: () => mocks.update(v) }) }),
  }),
}));
vi.mock("./depositToken", () => ({ createBalanceToken: () => "tok" }));
vi.mock("./email", () => ({ sendEmail: mocks.email }));
vi.mock("./offerDelivery", () => ({
  deliveryAvailability: () => ({ smsAvailable: mocks.smsAvailable }),
  sendOfferSms: mocks.sms,
}));
vi.mock("./pushService", () => ({ sendPushNotification: mocks.push }));
import {
  balanceReminderMessage,
  sendMorningBalanceReminders,
} from "./balanceReminder";

const booking = {
  id: 9,
  clientId: "c1",
  artistId: "a1",
  startTime: "2026-12-01 00:00:00",
  timeZone: "Australia/Brisbane",
  remainingBalanceCents: 150000,
};
beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "k";
  process.env.EMAIL_FROM = "hello@example.test";
  process.env.APP_URL = "https://app.example.test/";
  mocks.due = [booking];
  mocks.client = {
    id: "c1",
    name: "Mia Chen",
    email: "mia@example.test",
    phone: "+61412345678",
  };
  mocks.smsAvailable = true;
  mocks.email.mockResolvedValue(undefined);
  mocks.sms.mockResolvedValue(undefined);
  mocks.push.mockResolvedValue({ success: true, results: [] });
});

describe("balance reminders", () => {
  it("sends the payment link by email, SMS and push, then records it", async () => {
    const [r] = await sendMorningBalanceReminders(
      new Date("2026-11-30T21:00:00Z")
    );
    expect(r).toMatchObject({ sent: true, channels: ["email", "sms", "push"] });
    const mail = mocks.email.mock.calls[0][0];
    expect(mail.to).toBe("mia@example.test");
    expect(mail.body).toContain("https://app.example.test/balance/9?token=tok");
    expect(mail.body).toContain("$1,500.00");
    expect(mail.body).toContain("10:00 AM");
    expect(mocks.email.mock.calls[0][1]).toBe("balance-reminder-9");
    expect(mocks.update).toHaveBeenCalledWith({ reminderSent: 1 });
  });
  it("still counts as sent when one channel fails", async () => {
    mocks.email.mockRejectedValue(new Error("down"));
    mocks.push.mockResolvedValue({ success: false, results: [] });
    const [r] = await sendMorningBalanceReminders(
      new Date("2026-11-30T21:00:00Z")
    );
    expect(r).toMatchObject({ sent: true, channels: ["sms"] });
  });
  it("reports failure and leaves the booking unmarked when nothing gets through", async () => {
    mocks.client = { id: "c1", name: "Mia Chen", email: null, phone: null };
    mocks.push.mockResolvedValue({ success: false, results: [] });
    const [r] = await sendMorningBalanceReminders(
      new Date("2026-11-30T21:00:00Z")
    );
    expect(r.sent).toBe(false);
    expect(r.error).toBeTruthy();
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("words the message with the first name, amount and link", () => {
    const m = balanceReminderMessage({
      clientName: "Mia Chen",
      artistName: "Rory",
      when: "today at 10:00 AM",
      remainingCents: 5000,
      link: "https://x.test/b",
    });
    expect(m.short).toBe(
      "Hi Mia, your sitting with Rory is today at 10:00 AM. $50.00 is due on the day. Pay securely: https://x.test/b"
    );
  });
});
