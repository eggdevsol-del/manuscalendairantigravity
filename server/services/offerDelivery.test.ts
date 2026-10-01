// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./core", () => ({ getDb: vi.fn(), withDatabaseTransaction: vi.fn() }));
import {
  sendOfferSms,
  UncertainSmsError,
  queueOfferDelivery,
  deliveryAvailability,
} from "./offerDelivery";
beforeEach(() => {
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_test");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "test-only");
  vi.stubEnv("TWILIO_MESSAGING_SERVICE_SID", "MG_test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("promotional SMS delivery", () => {
  it("does not call a provider when configuration is missing", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(deliveryAvailability().smsAvailable).toBe(false);
    await expect(sendOfferSms("+61400000000", "test")).rejects.toThrow(
      "not configured"
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("returns provider acceptance, not an invented delivered status", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ sid: "SM_accepted", status: "queued" }), {
          status: 201,
        })
      );
    vi.stubGlobal("fetch", fetch);
    expect(await sendOfferSms("+61400000000", "test")).toBe("SM_accepted");
    expect(String(fetch.mock.calls[0][1].body)).toContain(
      "MessagingServiceSid=MG_test"
    );
  });
  it.each([500, 503])(
    "treats provider %s as uncertain so it will not be blindly replayed",
    async status => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("error", { status }))
      );
      await expect(sendOfferSms("+61400000000", "test")).rejects.toBeInstanceOf(
        UncertainSmsError
      );
    }
  );
  it("does not retry an accepted response with unreadable JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("broken", { status: 201 }))
    );
    await expect(sendOfferSms("+61400000000", "test")).rejects.toBeInstanceOf(
      UncertainSmsError
    );
  });
  it("treats a network timeout as uncertain", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(sendOfferSms("+61400000000", "test")).rejects.toBeInstanceOf(
      UncertainSmsError
    );
  });
  it("records explicit rejections as failed and eligible for a deliberate retry", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("rejected", { status: 400 }))
    );
    await expect(
      sendOfferSms("+61400000000", "test")
    ).rejects.not.toBeInstanceOf(UncertainSmsError);
  });
  it("requires channel consent and a verified mobile before queuing SMS", async () => {
    const values: any[] = [];
    const db = {
      query: {
        offerPreferences: {
          findFirst: async () => ({ sms: 0, push: 1, verifiedPhone: null }),
        },
      },
      insert: () => ({
        values: (v: any) => ({
          onDuplicateKeyUpdate: async () => values.push(v),
        }),
      }),
    };
    await queueOfferDelivery(db, 1, "client", { sms: true, push: true });
    expect(values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "sms", status: "skipped" }),
        expect.objectContaining({ channel: "push", status: "pending" }),
      ])
    );
  });
});
