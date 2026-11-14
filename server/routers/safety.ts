import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { getDb } from "../services/core";
import { sendEmail } from "../services/email";
import * as safety from "../services/safety";
import {
  MESSAGING_BLOCKED,
  REPORT_DETAILS_MAX,
  REPORT_REASONS,
  REPORT_REASON_LABELS,
  REPORTS_PER_DAY,
  SAFETY_CONTACT,
} from "../../shared/safety";

async function database() {
  const instance = await getDb();
  if (!instance)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "We couldn’t reach the database. Please try again.",
    });
  return instance;
}

/** Logged when the alert did not go out: the report is stored but nobody has been told. */
const alertFailed = (id: number) =>
  `[Safety] ACTION NEEDED: the alert email for report #${id} was not sent. The report is in user_reports with status "open" and is due for review within 24 hours. Check RESEND_API_KEY, EMAIL_FROM and SUPPORT_EMAIL.`;

const notParticipant = () =>
  new TRPCError({
    code: "FORBIDDEN",
    message: "You can only report a conversation you are part of.",
  });

/** The conversation, once the reporter is known to be one of its two people. */
async function participantConversation(conversationId: number, userId: string) {
  const conversation = await db.getConversationById(conversationId);
  if (
    !conversation ||
    (conversation.artistId !== userId && conversation.clientId !== userId)
  )
    throw notParticipant();
  return conversation;
}

export const safetyRouter = router({
  /** Report a person, a conversation, a message or an artist's public profile. */
  report: protectedProcedure
    .input(
      z.object({
        reportedUserId: z.string().min(1).max(64).optional(),
        conversationId: z.number().int().positive().optional(),
        messageId: z.number().int().positive().optional(),
        artistSlug: z.string().trim().min(1).max(100).optional(),
        reason: z.enum(REPORT_REASONS),
        details: z.string().trim().max(REPORT_DETAILS_MAX).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const me = ctx.user.id;
      let conversationId = input.conversationId;
      let reportedUserId = input.reportedUserId;

      if (input.messageId) {
        const message = await db.getMessageById(input.messageId);
        if (
          !message ||
          (conversationId && message.conversationId !== conversationId)
        )
          throw notParticipant();
        conversationId = message.conversationId;
      }
      if (conversationId) {
        // The reported person is whoever else is in the conversation, never what the caller says.
        const conversation = await participantConversation(conversationId, me);
        reportedUserId =
          (conversation.artistId === me
            ? conversation.clientId
            : conversation.artistId) || undefined;
      }
      if (!reportedUserId && !conversationId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose what you are reporting.",
        });
      if (reportedUserId === me)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can’t report yourself.",
        });

      const instance = await database();
      if ((await safety.reportsInLastDay(instance, me)) >= REPORTS_PER_DAY)
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `You have sent ${REPORTS_PER_DAY} reports in the last 24 hours. Please try again tomorrow, or email ${SAFETY_CONTACT}.`,
        });

      // The answer is the same whether or not the named person exists, so this
      // cannot be used to test which user ids are real. Nothing is stored for
      // an id that is not a person.
      if (
        reportedUserId &&
        !(await safety.userExists(instance, reportedUserId))
      )
        return { received: true };

      const id = await safety.createReport(instance, {
        reporterId: me,
        reportedUserId: reportedUserId ?? null,
        conversationId: conversationId ?? null,
        messageId: input.messageId ?? null,
        artistSlug: input.artistSlug ?? null,
        reason: input.reason,
        details: input.details || null,
      });

      // The report is already stored; a failed alert must never fail the report.
      try {
        void sendEmail(
          {
            to: process.env.SUPPORT_EMAIL || SAFETY_CONTACT,
            subject: `Tattoi report #${id}: ${REPORT_REASON_LABELS[input.reason]}`,
            body: [
              `Report #${id} needs review within 24 hours.`,
              `Reason: ${REPORT_REASON_LABELS[input.reason]}`,
              `Reporter: ${me}`,
              `Reported user: ${reportedUserId || "not given"}`,
              `Conversation: ${conversationId || "none"}`,
              `Message: ${input.messageId || "none"}`,
              `Artist profile: ${input.artistSlug || "none"}`,
              `Details: ${input.details || "none given"}`,
            ].join("\n"),
          },
          `user-report-${id}`
        ).catch(() => console.error(alertFailed(id)));
      } catch {
        console.error(alertFailed(id));
      }

      return { received: true };
    }),

  /** Stop someone messaging you. Bookings and payments with them are left exactly as they are. */
  block: protectedProcedure
    .input(z.object({ userId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.user.id)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You can’t block yourself.",
        });
      const instance = await database();
      // Same answer for an id that is not a person, so this cannot be used to
      // test which user ids are real; nothing is stored for it.
      if (await safety.userExists(instance, input.userId))
        await safety.addBlock(instance, ctx.user.id, input.userId);
      return { blocked: true };
    }),

  unblock: protectedProcedure
    .input(z.object({ userId: z.string().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      await safety.removeBlock(await database(), ctx.user.id, input.userId);
      return { blocked: false };
    }),

  /** The people the signed-in person has blocked. Never who has blocked them. */
  myBlocks: protectedProcedure.query(async ({ ctx }) =>
    safety.listBlocks(await database(), ctx.user.id)
  ),

  /** What the message thread needs: whether messaging is off, and whether the viewer can turn it back on. */
  conversationStatus: protectedProcedure
    .input(z.object({ conversationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const conversation = await db.getConversationById(input.conversationId);
      if (
        !conversation ||
        (conversation.artistId !== ctx.user.id &&
          conversation.clientId !== ctx.user.id)
      )
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have access to this conversation.",
        });
      const otherUserId =
        conversation.artistId === ctx.user.id
          ? conversation.clientId
          : conversation.artistId;
      if (!otherUserId)
        return {
          otherUserId: null,
          blockedByMe: false,
          messagingBlocked: false,
        };
      const instance = await database();
      const blocked = await safety.messagingBlocked(
        instance,
        ctx.user.id,
        otherUserId
      );
      return {
        otherUserId,
        blockedByMe:
          blocked &&
          (await safety.hasBlocked(instance, ctx.user.id, otherUserId)),
        messagingBlocked: blocked,
        message: blocked ? MESSAGING_BLOCKED : undefined,
      };
    }),
});
