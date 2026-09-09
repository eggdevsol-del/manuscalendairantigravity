// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";
import {
  createPasswordRecoveryToken,
  readPasswordRecoveryToken,
  recoveryMatchesUser,
} from "./passwordRecovery";
import {
  createDepositToken,
  verifyDepositToken,
  createBalanceToken,
  verifyBalanceToken,
} from "./depositToken";
import {
  requireArtist,
  requireConversationAccess,
  publicUserColumns,
} from "./access";
import { getAuthSecret } from "../_core/auth-secret";
import { webhookProcessingKey } from "./webhookProcessing";
import type Stripe from "stripe";
const user = {
  id: "client-a",
  email: "client@example.test",
  password: "old-hash",
};
afterEach(() => vi.useRealTimers());
describe("account recovery", () => {
  it("requires the current account, email and password revision", () => {
    const token = createPasswordRecoveryToken(user);
    expect(recoveryMatchesUser(token, user)).toBe(true);
    expect(recoveryMatchesUser(token, { ...user, id: "client-b" })).toBe(false);
    expect(
      recoveryMatchesUser(token, { ...user, email: "other@example.test" })
    ).toBe(false);
    expect(recoveryMatchesUser(token, { ...user, password: "new-hash" })).toBe(
      false
    );
  });
  it("allows first-password setup only while the password remains unset", () => {
    const token = createPasswordRecoveryToken({ ...user, password: null });
    expect(recoveryMatchesUser(token, { ...user, password: null })).toBe(true);
    expect(recoveryMatchesUser(token, user)).toBe(false);
  });
  it("rejects expired, tampered and ordinary login tokens", () => {
    vi.useFakeTimers();
    const token = createPasswordRecoveryToken(user);
    vi.advanceTimersByTime(16 * 60000);
    expect(readPasswordRecoveryToken(token)).toBeNull();
    expect(readPasswordRecoveryToken(token + "x")).toBeNull();
    expect(
      readPasswordRecoveryToken(
        jwt.sign({ userId: user.id, email: user.email }, getAuthSecret())
      )
    ).toBeNull();
  });
});
describe("payment-link isolation", () => {
  it("does not let a lead token authorize a booking with the same numeric ID", () => {
    expect(verifyBalanceToken(createDepositToken(42)).valid).toBe(false);
    expect(verifyDepositToken(createBalanceToken(42)).valid).toBe(false);
    expect(verifyBalanceToken(createBalanceToken(42))).toEqual({
      valid: true,
      bookingId: 42,
    });
  });
  it("rejects modified IDs, malformed signatures, and expired links without throwing", () => {
    vi.useFakeTimers();
    const token = createBalanceToken(42);
    expect(
      verifyBalanceToken(token.replace("balance.42.", "balance.43.")).valid
    ).toBe(false);
    expect(verifyDepositToken("42.9999999999999.aa").valid).toBe(false);
    vi.advanceTimersByTime(49 * 60 * 60000);
    expect(verifyBalanceToken(token).valid).toBe(false);
  });
});
describe("conversation access", () => {
  const database = {
    query: {
      conversations: {
        findFirst: vi.fn(async () => ({
          artistId: "artist-a",
          clientId: "client-a",
        })),
      },
    },
  };
  it("allows participants and denies outsiders or client attempts at artist-only actions", async () => {
    await expect(
      requireConversationAccess(database, 1, "artist-a", true)
    ).resolves.toBeDefined();
    await expect(
      requireConversationAccess(database, 1, "client-a")
    ).resolves.toBeDefined();
    await expect(
      requireConversationAccess(database, 1, "client-a", true)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      requireConversationAccess(database, 1, "outsider")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects client and merchant artist actions and limits public identity fields", () => {
    expect(() => requireArtist({ role: "client" })).toThrow();
    expect(() => requireArtist({ role: "merchant" })).toThrow();
    expect(Object.keys(publicUserColumns)).not.toContain("password");
    expect(Object.keys(publicUserColumns)).not.toContain("signature");
    expect(Object.keys(publicUserColumns)).not.toContain("email");
  });
});
describe("webhook identity", () => {
  it("deduplicates Checkout and PaymentIntent notifications for one payment", () => {
    const pi = {
      id: "evt_pi",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_one", metadata: { type: "balance" } } },
    } as unknown as Stripe.Event;
    const checkout = {
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_intent: "pi_one",
          payment_status: "paid",
          metadata: { type: "balance" },
        },
      },
    } as unknown as Stripe.Event;
    expect(webhookProcessingKey(pi)).toBe(webhookProcessingKey(checkout));
  });
  it("does not consume the payment key for an unpaid checkout notification", () => {
    const event = {
      id: "evt_waiting",
      type: "checkout.session.completed",
      data: {
        object: {
          payment_intent: "pi_one",
          payment_status: "unpaid",
          metadata: { type: "balance" },
        },
      },
    } as unknown as Stripe.Event;
    expect(webhookProcessingKey(event)).toBe("event:evt_waiting");
  });
});
