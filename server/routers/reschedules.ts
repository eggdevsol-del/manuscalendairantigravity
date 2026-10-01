import { protectedProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm";
import * as s from "../../drizzle/schema";
import { getDb } from "../services/core";
import { TRPCError } from "@trpc/server";
import { resolveReschedule, utc } from "../services/rescheduleApproval";
export const reschedulesRouter = router({
  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      const r = await db.query.rescheduleRequests.findFirst({
        where: eq(s.rescheduleRequests.id, input.id),
      });
      if (!r || (r.artistId !== ctx.user.id && r.clientId !== ctx.user.id))
        throw new TRPCError({ code: "FORBIDDEN" });
      return {
        id: r.id,
        status:
          r.status === "pending" && +utc(r.expiresAt) <= Date.now()
            ? "expired"
            : r.status,
        expiresAt: utc(r.expiresAt).toISOString(),
        isClient: r.clientId === ctx.user.id,
        terms: JSON.parse(r.termsJson),
      };
    }),
  resolve: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        action: z.enum(["accept", "decline", "withdraw"]),
      })
    )
    .mutation(({ input, ctx }) =>
      resolveReschedule(input.id, ctx.user.id, input.action)
    ),
});
