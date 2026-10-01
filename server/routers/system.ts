import { createHash } from "node:crypto";
import { eq, or } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { withDatabaseTransaction } from "../services/core";
import { z } from "zod";
import { systemRouter as coreSystemRouter } from "../_core/systemRouter";
import { protectedProcedure, router } from "../_core/trpc";
import { createLog } from "../services/systemLogService";

export const systemRouter = router({
  ...coreSystemRouter._def.procedures,
  workspaceRevision: protectedProcedure.query(({ ctx }) => withDatabaseTransaction(async db => {
    const userId = ctx.user.id;
    const appointments = await db.select({ id: schema.appointments.id, status: schema.appointments.status, paid: schema.appointments.totalPaidAmountCents, balance: schema.appointments.remainingBalanceCents, updated: schema.appointments.updatedAt }).from(schema.appointments).where(or(eq(schema.appointments.artistId, userId), eq(schema.appointments.clientId, userId)));
    const plans = await db.select({ id: schema.sessionPlans.id, status: schema.sessionPlans.status, payment: schema.sessionPlans.stripeSessionId, deposit: schema.sessionPlans.depositTotalCents }).from(schema.sessionPlans).where(or(eq(schema.sessionPlans.artistId, userId), eq(schema.sessionPlans.clientId, userId)));
    const requests = await db.select({ id: schema.paymentRequests.id, status: schema.paymentRequests.status }).from(schema.paymentRequests).where(or(eq(schema.paymentRequests.artistId,userId),eq(schema.paymentRequests.clientId,userId)));
    const conversations = await db.select({ id: schema.conversations.id, updated: schema.conversations.lastMessageAt }).from(schema.conversations).where(or(eq(schema.conversations.artistId,userId),eq(schema.conversations.clientId,userId)));
    const ledger = await db.select({ id: schema.paymentLedger.id, amount: schema.paymentLedger.amountCents }).from(schema.paymentLedger).where(or(eq(schema.paymentLedger.artistId,userId),eq(schema.paymentLedger.clientId,userId)));
    const snapshot = [appointments, plans, requests, conversations, ledger].map(rows => rows.sort((a,b)=>a.id-b.id));
    return { revision: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex") };
  })),
  addLog: protectedProcedure
    .input(
      z.object({
        level: z.enum(["debug", "info", "warn", "error"]),
        category: z.string().refine(value => !value.startsWith("usage:") && !value.startsWith("master_dev:"), "Reserved category"),
        message: z.string(),
        metadata: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userAgent = ctx.req.headers["user-agent"];
      const ipAddress =
        (ctx.req.headers["x-forwarded-for"] as string) ||
        ctx.req.socket.remoteAddress;

      await createLog({
        ...input,
        userId: ctx.user?.id,
        ipAddress,
        userAgent,
      });
      return { success: true };
    }),
});
