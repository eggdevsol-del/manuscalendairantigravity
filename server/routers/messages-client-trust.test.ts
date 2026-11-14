// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  message: vi.fn(),
  create: vi.fn(),
  appointment: vi.fn(),
  update: vi.fn(),
  locked: vi.fn(),
}));
// The receipt path re-reads the proposal under a row lock; `locked` is what
// that read sees, and its write is recorded like updateMessageMetadata.
vi.mock("../services/core", () => ({
  withDatabaseTransaction: async (fn: any) =>
    fn({
      select: () => ({
        from: () => ({ where: () => ({ for: async () => m.locked() }) }),
      }),
      update: () => ({
        set: (values: any) => ({
          where: async () => m.update(7, values.metadata),
        }),
      }),
    }),
}));
vi.mock("../db", () => ({
  getConversationById: async () => ({ artistId: "artist", clientId: "client" }),
  getMessageById: m.message,
  getArtistSettings: async () => null,
  getArtistCalendar: async () => [],
  createAppointment: m.appointment,
  createMessage: m.create,
  updateMessageMetadata: m.update,
  getDb: async () => ({ insert: () => ({ values: async () => [] }) }),
  getConsultationsForUser: async () => [],
}));
import { messagesRouter } from "./messages";

const as = (user: string) =>
  messagesRouter.createCaller({
    user: { id: user, role: user, name: "Person" },
  } as any);
const date = "2027-02-08T01:00:00.000Z";
const proposal = {
  type: "project_proposal",
  status: "pending",
  serviceName: "Sleeve",
  price: 900,
  depositAmount: 300,
  sittings: 1,
  dates: [date],
  appointmentIds: [3],
};
const proposalMessage = (metadata: object = proposal) => ({
  id: 7,
  conversationId: 9,
  senderId: "artist",
  messageType: "appointment_request",
  metadata: JSON.stringify(metadata),
});
beforeEach(() => {
  vi.clearAllMocks();
  m.create.mockResolvedValue({ id: 1 });
  m.appointment.mockResolvedValue({ id: 3 });
  m.message.mockResolvedValue(proposalMessage());
  m.locked.mockImplementation(async () => [await m.message()]);
});

for (const messageType of [
  "system",
  "appointment_confirmed",
  "appointment_request",
] as const)
  it(`stops a client sending a ${messageType} message`, async () => {
    await expect(
      as("client").send({
        conversationId: 9,
        content: "Payment received",
        messageType,
        metadata: JSON.stringify({
          status: "pending",
          dates: [date],
          price: 900,
          depositAmount: 1,
        }),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.appointment).not.toHaveBeenCalled();
    expect(m.create).not.toHaveBeenCalled();
  });

it("stops a client attaching payment metadata to a text message", async () => {
  await expect(
    as("client").send({
      conversationId: 9,
      content: "Pay here",
      metadata: JSON.stringify({ type: "payment_request", amountCents: 1 }),
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(m.create).not.toHaveBeenCalled();
});

it("takes the price of a client's date confirmation from the artist's proposal", async () => {
  await as("client").send({
    conversationId: 9,
    content: "I confirm",
    metadata: JSON.stringify({
      type: "project_client_confirmation",
      confirmedDates: [date],
      originalMessageId: 7,
      serviceName: "Sleeve",
      price: 1,
      depositAmount: 1,
    }),
  });
  expect(JSON.parse(m.create.mock.calls[0][0].metadata)).toEqual({
    type: "project_client_confirmation",
    confirmedDates: [date],
    originalMessageId: 7,
    serviceName: "Sleeve",
    price: 900,
  });
});

it("refuses a confirmation of dates the artist did not offer", async () => {
  await expect(
    as("client").send({
      conversationId: 9,
      content: "I confirm",
      metadata: JSON.stringify({
        type: "project_client_confirmation",
        confirmedDates: ["2027-03-01T01:00:00.000Z"],
        originalMessageId: 7,
      }),
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

for (const [why, original] of [
  ["a revoked proposal", { ...proposal, status: "revoked" }],
  ["a declined proposal", { ...proposal, status: "declined" }],
  ["a confirmed proposal", { ...proposal, status: "confirmed" }],
] as const)
  it(`refuses a confirmation of dates from ${why}`, async () => {
    m.message.mockResolvedValue(proposalMessage(original));
    await expect(
      as("client").send({
        conversationId: 9,
        content: "I confirm",
        metadata: JSON.stringify({
          type: "project_client_confirmation",
          confirmedDates: [date],
          originalMessageId: 7,
        }),
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(m.create).not.toHaveBeenCalled();
  });

it("refuses a confirmation that points at a message that is not a proposal", async () => {
  m.message.mockResolvedValue({ ...proposalMessage(), messageType: "text" });
  await expect(
    as("client").send({
      conversationId: 9,
      content: "I confirm",
      metadata: JSON.stringify({
        type: "project_client_confirmation",
        confirmedDates: [date],
        originalMessageId: 7,
      }),
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});

it("refuses a confirmation that repeats a date", async () => {
  await expect(
    as("client").send({
      conversationId: 9,
      content: "I confirm",
      metadata: JSON.stringify({
        type: "project_client_confirmation",
        confirmedDates: [date, date, date],
        originalMessageId: 7,
      }),
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(m.create).not.toHaveBeenCalled();
});

it("stops a client turning their own text message into a confirmation card", async () => {
  const own = (metadata: string | null) => ({
    id: 8,
    conversationId: 9,
    senderId: "client",
    messageType: "text",
    metadata,
  });
  const confirmation = JSON.stringify({
    type: "project_client_confirmation",
    confirmedDates: [date],
    originalMessageId: 7,
  });
  // The first read is the client's message, the second the artist's proposal.
  m.message.mockResolvedValueOnce(own(null));
  await expect(
    as("client").updateMetadata({ messageId: 8, metadata: confirmation })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(m.update).not.toHaveBeenCalled();

  m.message.mockResolvedValueOnce(own(confirmation));
  await as("client").updateMetadata({ messageId: 8, metadata: confirmation });
  expect(JSON.parse(m.update.mock.calls[0][1])).toMatchObject({
    type: "project_client_confirmation",
    price: 900,
  });
});

it("does not put a proposal back to unpaid when the deposit is confirmed during a receipt upload", async () => {
  // The first read still shows it pending; the locked read sees the payment.
  m.locked.mockResolvedValue([
    proposalMessage({ ...proposal, status: "confirmed" }),
  ]);
  await expect(
    as("client").updateMetadata({
      messageId: 7,
      metadata: JSON.stringify({
        status: "remittance_uploaded",
        receiptUrl: "https://cdn.example.com/receipt.webp",
      }),
    })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(m.update).not.toHaveBeenCalled();
});

it("still lets a client send text and images, and an artist send a proposal", async () => {
  await as("client").send({ conversationId: 9, content: "Hello" });
  await as("client").send({
    conversationId: 9,
    content: "https://example.com/a.webp",
    messageType: "image",
  });
  await as("artist").send({
    conversationId: 9,
    content: "Proposal",
    messageType: "appointment_request",
    metadata: JSON.stringify(proposal),
  });
  expect(m.create).toHaveBeenCalledTimes(3);
  expect(m.appointment).toHaveBeenCalledOnce();
});

it("ignores a client's changes to the money and sittings of a proposal", async () => {
  await as("client").updateMetadata({
    messageId: 7,
    metadata: JSON.stringify({
      ...proposal,
      depositAmount: 1,
      price: 1,
      sittings: 9,
      status: "confirmed",
      discountApplied: true,
      finalAmount: 1,
    }),
  });
  expect(m.update).not.toHaveBeenCalled();
});

it("lets a client attach a deposit receipt and nothing else", async () => {
  await as("client").updateMetadata({
    messageId: 7,
    metadata: JSON.stringify({
      ...proposal,
      depositAmount: 1,
      appointmentIds: [99],
      status: "remittance_uploaded",
      receiptUrl: "https://cdn.example.com/receipt.webp",
    }),
  });
  expect(m.update).toHaveBeenCalledOnce();
  expect(JSON.parse(m.update.mock.calls[0][1])).toEqual({
    ...proposal,
    status: "remittance_uploaded",
    receiptUrl: "https://cdn.example.com/receipt.webp",
  });
});

it("refuses a receipt on a confirmed proposal or with an unsafe link", async () => {
  const receipt = (receiptUrl: string) =>
    as("client").updateMetadata({
      messageId: 7,
      metadata: JSON.stringify({ status: "remittance_uploaded", receiptUrl }),
    });
  await expect(receipt("javascript:alert(1)")).rejects.toMatchObject({
    code: "BAD_REQUEST",
  });
  m.message.mockResolvedValue(
    proposalMessage({ ...proposal, status: "confirmed" })
  );
  await expect(
    receipt("https://cdn.example.com/receipt.webp")
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(m.update).not.toHaveBeenCalled();
});

it("stops a client editing the artist's payment request", async () => {
  m.message.mockResolvedValue({
    ...proposalMessage({ type: "payment_request", amountCents: 50000 }),
    messageType: "system",
  });
  await expect(
    as("client").updateMetadata({
      messageId: 7,
      metadata: JSON.stringify({ type: "payment_request", amountCents: 1 }),
    })
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(m.update).not.toHaveBeenCalled();
});

it("lets the artist confirm a deposit on their proposal", async () => {
  const metadata = JSON.stringify({ ...proposal, status: "confirmed" });
  await as("artist").updateMetadata({ messageId: 7, metadata });
  expect(m.update).toHaveBeenCalledWith(7, metadata);
});
