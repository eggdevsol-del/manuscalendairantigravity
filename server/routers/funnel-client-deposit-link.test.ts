// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  message: vi.fn(),
  appointment: vi.fn(),
  appointments: vi.fn(),
  rescheduleLog: vi.fn(),
  lead: vi.fn(),
  set: vi.fn(),
  intent: vi.fn(),
}));
// The mock applies no filters: `appointments` answers both the "sittings of
// this proposal" and the "pending sittings in this conversation" reads.
vi.mock("../db", () => ({
  getDb: async () => ({
    query: {
      conversations: {
        findFirst: async () => ({
          id: 9,
          artistId: "artist",
          clientId: "client",
          leadId: 5,
        }),
      },
      leads: { findFirst: m.lead },
      messages: { findFirst: m.message },
      appointments: { findFirst: m.appointment, findMany: m.appointments },
      appointmentLogs: { findFirst: m.rescheduleLog },
      artistSettings: {
        findFirst: async () => ({ stripeConnectAccountId: "acct_1" }),
      },
      users: { findFirst: async () => ({ id: "artist", name: "Artist" }) },
    },
    update: () => ({
      set: (values: any) => {
        m.set(values);
        return { where: async () => [] };
      },
    }),
  }),
}));
vi.mock("../services/depositToken", () => ({
  createDepositToken: () => "token",
  verifyDepositToken: () => ({ valid: true, leadId: 5 }),
}));
vi.mock("../services/paymentEntitlements", () => ({
  effectivePaymentTier: async () => "free",
}));
vi.mock("../services/artistPaymentReadiness", () => ({
  artistCanAcceptPayments: async () => true,
}));
vi.mock("../services/paymentIntents", () => ({
  createDepositPaymentIntent: m.intent,
}));
import { funnelRouter } from "./funnel";

const link = (input: { messageId?: number; appointmentId?: number }) =>
  funnelRouter
    .createCaller({ user: { id: "client", role: "client" } } as any)
    .getClientDepositLink({ conversationId: 9, ...input });
const checkout = (messageId?: number) =>
  funnelRouter
    .createCaller({ user: null } as any)
    .createDepositCheckout({ token: "token", messageId });
const proposal = (over: object = {}) => ({
  type: "project_proposal",
  status: "pending",
  depositAmount: 300,
  appointmentIds: [3, 4],
  ...over,
});
const message = (metadata: object = proposal(), over: object = {}) => ({
  id: 7,
  conversationId: 9,
  senderId: "artist",
  messageType: "appointment_request",
  metadata: JSON.stringify(metadata),
  ...over,
});
const sitting = (over: object = {}) => ({
  id: 3,
  conversationId: 9,
  artistId: "artist",
  clientId: "client",
  status: "pending",
  paymentStatus: "pending_deposit",
  depositPaid: 0,
  depositAmount: 150,
  ...over,
});
const lead = (depositAmount: number | null) => ({
  id: 5,
  artistId: "artist",
  conversationId: 9,
  clientEmail: "client@example.com",
  depositAmount,
  depositVerifiedAt: null,
});
const charged = () => m.set.mock.calls.map(([values]) => values.depositAmount);

beforeEach(() => {
  vi.clearAllMocks();
  m.message.mockResolvedValue(message());
  m.appointment.mockResolvedValue(undefined);
  m.appointments.mockResolvedValue([sitting(), sitting({ id: 4 })]);
  m.rescheduleLog.mockResolvedValue(undefined);
  m.lead.mockResolvedValue(lead(null));
  m.intent.mockResolvedValue({ clientSecret: "secret" });
});

it("refuses a message the client wrote themselves", async () => {
  m.message.mockResolvedValue(
    message({ status: "pending", depositAmount: 1 }, { senderId: "client" })
  );
  await expect(link({ messageId: 7 })).rejects.toThrow("Not authorized");
  expect(m.set).not.toHaveBeenCalled();
});

it("refuses a message from another conversation", async () => {
  m.message.mockResolvedValue(message(proposal(), { conversationId: 10 }));
  await expect(link({ messageId: 7 })).rejects.toThrow("Not authorized");
  expect(m.set).not.toHaveBeenCalled();
});

it("refuses an artist message that is not a proposal", async () => {
  m.message.mockResolvedValue(
    message({ status: "pending", depositAmount: 1 }, { messageType: "text" })
  );
  await expect(link({ messageId: 7 })).rejects.toThrow("Not authorized");
  expect(m.set).not.toHaveBeenCalled();
});

it("refuses an appointment that is not the caller's in this conversation", async () => {
  m.appointment.mockResolvedValue(
    sitting({ conversationId: 10, clientId: "someone", depositAmount: 1 })
  );
  await expect(link({ appointmentId: 3 })).rejects.toThrow("Not authorized");
  expect(m.set).not.toHaveBeenCalled();
});

it("charges the deposit held on the sittings, not a lower figure in the message", async () => {
  m.message.mockResolvedValue(message(proposal({ depositAmount: 1 })));
  const { url } = await link({ messageId: 7 });
  expect(url).toContain("/deposit/");
  expect(charged()).toEqual([30000]);
});

it("charges the artist's full figure when whole-dollar sittings fall short of it", async () => {
  m.message.mockResolvedValue(message(proposal({ depositAmount: 100 })));
  m.appointments.mockResolvedValue([
    sitting({ depositAmount: 33 }),
    sitting({ id: 4, depositAmount: 33 }),
  ]);
  await link({ messageId: 7 });
  expect(charged()).toEqual([10000]);
});

it("falls back to the artist's message for a proposal with no sittings", async () => {
  m.message.mockResolvedValue(message(proposal({ appointmentIds: undefined })));
  m.appointments.mockResolvedValue([]);
  await link({ messageId: 7 });
  expect(charged()).toEqual([30000]);
});

it("charges the whole proposal when one of its own sittings is sent with it", async () => {
  m.appointment.mockResolvedValue(sitting());
  await link({ messageId: 7, appointmentId: 3 });
  expect(charged()).toEqual([30000]);
});

it("does not let a caller-owned appointment with a small deposit lower a proposal", async () => {
  // A row the client booked for themselves, sitting in the same conversation.
  const own = sitting({ id: 50, depositAmount: 0.5 });
  m.message.mockResolvedValue(
    message(proposal({ depositAmount: 200, appointmentIds: [3] }))
  );
  m.appointment.mockResolvedValue(own);
  // First read: the proposal's own sitting. Second: all that is pending.
  m.appointments
    .mockResolvedValueOnce([sitting({ depositAmount: 200 })])
    .mockResolvedValue([sitting({ depositAmount: 200 }), own]);
  await expect(link({ messageId: 7, appointmentId: 50 })).rejects.toThrow(
    "other dates on hold"
  );
  await expect(link({ appointmentId: 50 })).rejects.toThrow(
    "not awaiting a deposit"
  );
  expect(m.set).not.toHaveBeenCalled();
});

it("does not charge a single pending sitting of a proposal on its own", async () => {
  m.appointment.mockResolvedValue(sitting());
  await expect(link({ appointmentId: 3 })).rejects.toThrow(
    "not awaiting a deposit"
  );
  expect(m.set).not.toHaveBeenCalled();
});

for (const status of ["revoked", "declined", "confirmed"])
  it(`refuses a ${status} proposal`, async () => {
    m.message.mockResolvedValue(message(proposal({ status })));
    m.appointments.mockResolvedValue([]);
    await expect(link({ messageId: 7 })).rejects.toThrow(
      "no longer awaiting a deposit"
    );
    expect(m.set).not.toHaveBeenCalled();
  });

it("refuses a proposal whose sittings were all cancelled", async () => {
  m.appointments.mockResolvedValue([
    sitting({ status: "cancelled" }),
    sitting({ id: 4, status: "cancelled" }),
  ]);
  await expect(link({ messageId: 7 })).rejects.toThrow(
    "no longer awaiting a deposit"
  );
});

it("refuses to price one proposal while another's dates are still held", async () => {
  m.appointments
    .mockResolvedValueOnce([sitting(), sitting({ id: 4 })])
    .mockResolvedValue([
      sitting(),
      sitting({ id: 4 }),
      sitting({ id: 20, depositAmount: 900 }),
    ]);
  await expect(link({ messageId: 7 })).rejects.toThrow("other dates on hold");
  expect(m.set).not.toHaveBeenCalled();
});

it("refuses a link with no proposal while dates are held", async () => {
  await expect(link({})).rejects.toThrow("Open the proposal");
  expect(m.set).not.toHaveBeenCalled();
});

it("charges a single sitting only when the artist moved it and it awaits a new deposit", async () => {
  const moved = sitting({ depositAmount: 75 });
  m.message.mockResolvedValue(message(proposal({ status: "confirmed" })));
  m.appointment.mockResolvedValue(moved);
  m.appointments.mockResolvedValue([
    moved,
    sitting({ id: 4, status: "confirmed" }),
  ]);
  await expect(link({ messageId: 7, appointmentId: 3 })).rejects.toThrow(
    "not awaiting a deposit"
  );
  m.rescheduleLog.mockResolvedValue({ id: 1 });
  // Only the moved sitting is still pending in the conversation.
  m.appointments.mockImplementation(async () => [moved]);
  await link({ messageId: 7, appointmentId: 3 });
  expect(charged()).toEqual([7500]);
});

it("refuses a checkout that names a proposal dearer than the priced deposit", async () => {
  // Priced on a cheap proposal, then the expensive one is named at checkout.
  m.lead.mockResolvedValue(lead(5000));
  await expect(checkout(7)).rejects.toThrow("out of date");
  expect(m.intent).not.toHaveBeenCalled();
});

it("refuses a checkout that would confirm held dates for less than their deposits", async () => {
  m.lead.mockResolvedValue(lead(5000));
  await expect(checkout()).rejects.toThrow("out of date");
  expect(m.intent).not.toHaveBeenCalled();
});

it("refuses a checkout that names a revoked proposal or a non-proposal message", async () => {
  m.lead.mockResolvedValue(lead(30000));
  m.message.mockResolvedValue(message(proposal({ status: "revoked" })));
  m.appointments.mockResolvedValue([]);
  await expect(checkout(7)).rejects.toThrow("out of date");
  m.message.mockResolvedValue(message(proposal(), { messageType: "text" }));
  await expect(checkout(7)).rejects.toThrow("does not belong");
  m.message.mockResolvedValue(message(proposal(), { senderId: "client" }));
  await expect(checkout(7)).rejects.toThrow("does not belong");
  expect(m.intent).not.toHaveBeenCalled();
});

it("starts a checkout for the proposal the deposit was priced on", async () => {
  m.lead.mockResolvedValue(lead(30000));
  await checkout(7);
  expect(m.intent).toHaveBeenCalledWith(
    expect.objectContaining({ depositAmountCents: 30000, messageId: 7 })
  );
});
