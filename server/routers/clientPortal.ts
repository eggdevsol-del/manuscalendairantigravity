import { formsRouter } from "./forms";
import { promotionsRouter } from "./promotions";
import { consentForms } from "../../drizzle/schema";
import { projectsRouter } from "./projects";
import { sessionPlansRouter } from "./sessionPlans";
import { aftercareRouter } from "./aftercare";
import { sessionPlans } from "../../drizzle/schema";
import { messagesRouter } from "./messages";
import { accountEnabled } from "../services/masterDevAccess";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, asc } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { getDb } from "../services/core";
import {
  appointments,
  conversations,
  paymentRequests,
  users,
} from "../../drizzle/schema";
import {
  issuePortalToken,
  verifyPortalToken,
} from "../services/clientPortalToken";
const access = z.object({ token: z.string().min(20).max(2048) });
async function resolve(token: string) {
  let identity;
  try {
    identity = await verifyPortalToken(token);
  } catch {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message:
        "This link has expired or is invalid. Ask your artist for a fresh link.",
    });
  }
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
  const conversation = await db.query.conversations.findFirst({
    where: and(
      eq(conversations.id, identity.conversationId),
      eq(conversations.clientId, identity.clientId)
    ),
  });
  if (!conversation) throw new TRPCError({ code: "UNAUTHORIZED" });
  const client = await db.query.users.findFirst({
    where: eq(users.id, identity.clientId),
  });
  const artist = await db.query.users.findFirst({
    where: eq(users.id, conversation.artistId),
  });
  if (
    !accountEnabled(client || null) ||
    !accountEnabled(artist || null) ||
    client?.role !== "client" ||
    artist?.role !== "artist"
  )
    throw new TRPCError({ code: "UNAUTHORIZED" });
  return { db, conversation, clientId: identity.clientId, client: client! };
}

async function resolvePlan(token: string, planId: number) {
  const access = await resolve(token);
  const plan = await access.db.query.sessionPlans.findFirst({
    where: and(
      eq(sessionPlans.id, planId),
      eq(sessionPlans.conversationId, access.conversation.id),
      eq(sessionPlans.clientId, access.clientId),
      eq(sessionPlans.artistId, access.conversation.artistId)
    ),
  });
  if (!plan)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This proposal is not available through this link.",
    });
  return access;
}
export const clientPortalRouter = router({
  createLink: protectedProcedure
    .input(z.object({ clientId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "artist")
        throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const conversation = await db.query.conversations.findFirst({
        where: and(
          eq(conversations.artistId, ctx.user.id),
          eq(conversations.clientId, input.clientId)
        ),
      });
      if (!conversation) throw new TRPCError({ code: "FORBIDDEN" });
      return {
        token: await issuePortalToken(conversation.id, input.clientId),
        expiresInHours: 24,
      };
    }),
  workspace: publicProcedure.input(access).mutation(async ({ input, ctx }) => {
    ctx.res.setHeader("Cache-Control", "no-store");
    const { conversation, client } = await resolve(input.token);
    const summary = await projectsRouter
      .createCaller({ ...ctx, user: client })
      .summary({ conversationId: conversation.id });
    // Explicit client-facing projection: no artist briefs, internal notes or medical answers.
    return {
      artist: summary.artist,
      client: summary.client,
      location: summary.location,
      sessions: summary.sessions,
      plans: summary.plans,
      history: summary.history,
      forms: summary.forms,
    };
  }),
  plan: publicProcedure
    .input(access.extend({ planId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      ctx.res.setHeader("Cache-Control", "no-store");
      const { client } = await resolvePlan(input.token, input.planId);
      return sessionPlansRouter
        .createCaller({ ...ctx, user: client })
        .getById({ sessionPlanId: input.planId });
    }),
  acceptPlan: publicProcedure
    .input(access.extend({ planId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const { client } = await resolvePlan(input.token, input.planId);
      return sessionPlansRouter
        .createCaller({ ...ctx, user: client })
        .accept({ sessionPlanId: input.planId });
    }),
  pendingForms: publicProcedure
    .input(access)
    .mutation(async ({ input, ctx }) => {
      const { db, conversation, clientId } = await resolve(input.token);
      ctx.res.setHeader("Cache-Control", "no-store");
      return db
        .select({
          id: consentForms.id,
          title: consentForms.title,
          content: consentForms.content,
          formType: consentForms.formType,
          status: consentForms.status,
        })
        .from(consentForms)
        .innerJoin(
          appointments,
          eq(appointments.id, consentForms.appointmentId)
        )
        .where(
          and(
            eq(consentForms.clientId, clientId),
            eq(consentForms.artistId, conversation.artistId),
            eq(appointments.conversationId, conversation.id),
            eq(consentForms.status, "pending")
          )
        );
    }),
  signForm: publicProcedure
    .input(
      access.extend({
        formId: z.number().int().positive(),
        signature: z.string().max(500000),
        photoPermission: z.boolean().optional(),
        answers: z.record(z.string(), z.enum(["yes", "no"])).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { db, conversation, client } = await resolve(input.token);
      const [form] = await db
        .select({ id: consentForms.id })
        .from(consentForms)
        .innerJoin(
          appointments,
          eq(appointments.id, consentForms.appointmentId)
        )
        .where(
          and(
            eq(consentForms.id, input.formId),
            eq(consentForms.clientId, client.id),
            eq(consentForms.artistId, conversation.artistId),
            eq(appointments.conversationId, conversation.id)
          )
        );
      if (!form) throw new TRPCError({ code: "FORBIDDEN" });
      const { token, ...payload } = input;
      return formsRouter
        .createCaller({ ...ctx, user: client })
        .signForm(payload);
    }),
  offers: publicProcedure.input(access).mutation(async ({ input, ctx }) => {
    const { conversation, client } = await resolve(input.token);
    return promotionsRouter
      .createCaller({ ...ctx, user: client })
      .getAvailableForBooking({ artistId: conversation.artistId });
  }),
  aftercare: publicProcedure.input(access).mutation(async ({ input, ctx }) => {
    const { conversation, client } = await resolve(input.token);
    return aftercareRouter
      .createCaller({ ...ctx, user: client })
      .getTemplate({ artistId: conversation.artistId });
  }),
  view: publicProcedure.input(access).mutation(async ({ input, ctx }) => {
    ctx.res.setHeader("Cache-Control", "no-store");
    const { db, conversation, clientId } = await resolve(input.token);
    const artist = await db.query.users.findFirst({
      where: eq(users.id, conversation.artistId),
      columns: { name: true, avatar: true },
    });
    const sittings = await db
      .select({
        id: appointments.id,
        title: appointments.title,
        projectName: appointments.projectName,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        timeZone: appointments.timeZone,
        status: appointments.status,
        paymentStatus: appointments.paymentStatus,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.artistId, conversation.artistId),
          eq(appointments.clientId, clientId)
        )
      )
      .orderBy(asc(appointments.startTime));
    const payments = await db
      .select({
        id: paymentRequests.id,
        appointmentId: paymentRequests.appointmentId,
        amountCents: paymentRequests.amountCents,
        status: paymentRequests.status,
        token: paymentRequests.token,
        expiresAt: paymentRequests.expiresAt,
      })
      .from(paymentRequests)
      .where(
        and(
          eq(paymentRequests.artistId, conversation.artistId),
          eq(paymentRequests.clientId, clientId)
        )
      );
    return {
      artist,
      sittings,
      payments: payments.filter(
        p =>
          p.status === "pending" &&
          (!p.expiresAt || new Date(p.expiresAt).getTime() > Date.now())
      ),
    };
  }),
  messages: publicProcedure
    .input(
      access.extend({
        before: z
          .object({
            id: z.number().int().positive(),
            createdAt: z.string().nullable(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      ctx.res.setHeader("Cache-Control", "no-store");
      const { conversation, client } = await resolve(input.token);
      const rows = await messagesRouter
        .createCaller({ ...ctx, user: client })
        .list({
          conversationId: conversation.id,
          limit: 100,
          before: input.before,
        });
      return rows.map(m => ({
        id: m.id,
        text: m.content,
        type: m.messageType,
        createdAt: m.createdAt,
        mine: m.senderId === client.id,
      }));
    }),
  reply: publicProcedure
    .input(access.extend({ text: z.string().trim().min(1).max(4000) }))
    .mutation(async ({ input, ctx }) => {
      const { conversation, client } = await resolve(input.token);
      await messagesRouter
        .createCaller({ ...ctx, user: client })
        .send({
          conversationId: conversation.id,
          content: input.text,
          messageType: "text",
        });
      return { sent: true };
    }),
});
