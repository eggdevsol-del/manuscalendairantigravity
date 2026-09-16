import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { withDatabaseTransaction } from "./core";

/** Declining an unpaid legacy proposal releases its pending dates atomically. */
export async function declineLegacyProposal(
  messageId: number,
  clientId: string
) {
  return withDatabaseTransaction(async database => {
    const [message] = await database
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, messageId))
      .for("update");
    if (!message)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Proposal not found.",
      });
    const conversation = await database.query.conversations.findFirst({
      where: eq(schema.conversations.id, message.conversationId),
    });
    if (conversation?.clientId !== clientId)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only this client can decline the proposal.",
      });
    let metadata: any;
    try {
      metadata = JSON.parse(message.metadata || "{}");
    } catch {
      metadata = {};
    }
    if (metadata.type !== "project_proposal")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This message is not a booking proposal.",
      });
    if (metadata.status === "declined") return { success: true };
    if (metadata.status !== "pending")
      throw new TRPCError({
        code: "CONFLICT",
        message: "This proposal has changed. Refresh before continuing.",
      });
    const ids = (
      Array.isArray(metadata.appointmentIds)
        ? metadata.appointmentIds
        : [metadata.appointmentId || metadata.id]
    ).filter(
      (id: unknown): id is number =>
        typeof id === "number" && Number.isSafeInteger(id) && id > 0
    );
    if (ids.length) {
      const appointments = await database
        .select()
        .from(schema.appointments)
        .where(inArray(schema.appointments.id, ids))
        .for("update");
      if (
        appointments.some(
          a =>
            a.conversationId !== message.conversationId ||
            a.clientId !== clientId ||
            a.artistId !== conversation.artistId
        )
      )
        throw new TRPCError({ code: "FORBIDDEN" });
      if (
        appointments.some(
          a =>
            a.status !== "pending" ||
            a.depositPaid ||
            (a.totalPaidAmountCents || 0) > 0 ||
            a.depositPaymentId
        )
      )
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "A session has already progressed. Request a cancellation in Messages.",
        });
      await database
        .update(schema.appointments)
        .set({ status: "cancelled" })
        .where(
          and(
            inArray(schema.appointments.id, ids),
            eq(schema.appointments.conversationId, message.conversationId)
          )
        );
    }
    await database
      .update(schema.messages)
      .set({ metadata: JSON.stringify({ ...metadata, status: "declined" }) })
      .where(eq(schema.messages.id, messageId));
    return { success: true };
  });
}
