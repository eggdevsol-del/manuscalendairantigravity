import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import {
  moodboards,
  moodboardItems,
  users,
  consentForms,
  appointments,
  orders,
  clientNotes,
} from "../../drizzle/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { z } from "zod";

export const clientProfileRouter = router({
  getProfile: protectedProcedure
    .input(z.object({ clientId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const targetId =
        (ctx.user.role === "artist" || ctx.user.role === "admin") &&
          input?.clientId
          ? input.clientId
          : ctx.user.id;

      const user = await db.getUser(targetId);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }
      return user;
    }),

  updateBio: protectedProcedure
    .input(z.object({ bio: z.string().max(500) }))
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB not available",
        });

      await database
        .update(users)
        .set({ bio: input.bio })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  updateAvatar: protectedProcedure
    .input(z.object({ avatarUrl: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "DB not available",
        });

      await database
        .update(users)
        .set({ avatar: input.avatarUrl })
        .where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  getSpendSummary: protectedProcedure
    .input(z.object({ clientId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const targetId =
        (ctx.user.role === "artist" || ctx.user.role === "admin") &&
          input?.clientId
          ? input.clientId
          : ctx.user.id;

      const appointments = await db.getClientCalendar(targetId);

      const validAppointments = appointments.filter(
        a => a.status === "completed" || a.status === "confirmed"
      );

      let totalSpend = 0;
      let maxSingleSpend = 0;

      validAppointments.forEach(appt => {
        const price = Number(appt.price || 0);
        totalSpend += price;
        if (price > maxSingleSpend) {
          maxSingleSpend = price;
        }
      });

      return {
        totalSpend,
        maxSingleSpend,
        appointmentCount: validAppointments.length,
      };
    }),

  getHistory: protectedProcedure
    .input(z.object({ clientId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const targetId =
        (ctx.user.role === "artist" || ctx.user.role === "admin") &&
          input?.clientId
          ? input.clientId
          : ctx.user.id;

      const database = await db.getDb();
      if (!database) return [];

      // Fetch both appointments and their logs
      const clientAppointments = await database.query.appointments.findMany({
        where: eq(appointments.clientId, targetId),
        with: {
          logs: true,
        },
        orderBy: desc(appointments.startTime),
      });

      const historyItems: any[] = [];

      clientAppointments.forEach(appt => {
        // Add the appointment itself (as a "completed" or "milestone" event if needed)
        if (appt.status === "completed" || appt.status === "confirmed") {
          historyItems.push({
            id: `appt-${appt.id}`,
            type: "appointment",
            date: appt.startTime,
            title: appt.title,
            description: appt.serviceName,
            status: appt.status,
            price: appt.price,
            depositAmount: appt.depositAmount,
            clientPaid: appt.clientPaid,
            paymentMethod: appt.paymentMethod,
            actualStartTime: appt.actualStartTime,
            actualEndTime: appt.actualEndTime,
            appointmentId: appt.id,
          });
        }

        // Add lifecycle events from logs (Consolidate to most recent only)
        if (appt.logs && appt.logs.length > 0) {
          // Sort logs by createdAt descending to get the most recent one
          const sortedLogs = [...appt.logs].sort(
            (a, b) =>
              new Date(b.createdAt || new Date()).getTime() -
              new Date(a.createdAt || new Date()).getTime()
          );
          const latestLog = sortedLogs[0];

          historyItems.push({
            id: `log-${latestLog.id}`,
            type: "log",
            date: latestLog.createdAt,
            action: latestLog.action,
            title: getActionTitle(latestLog.action),
            description: getActionDescription(latestLog.action, appt),
            performedBy: latestLog.performedBy,
            appointmentId: appt.id,
          });
        }
      });

      const signedForms = await database.query.consentForms.findMany({
        where: and(
          eq(consentForms.clientId, targetId),
          eq(consentForms.status, "signed")
        ),
      });

      signedForms.forEach(form => {
        if (form.signedAt) {
          historyItems.push({
            id: `form-${form.id}`,
            type: "form",
            date: form.signedAt,
            title: "Form Signed",
            description: `Signed ${form.title}`,
            appointmentId: form.appointmentId,
          });
        }
      });

      const clientOrders = await database.query.orders.findMany({
        where: eq(orders.clientId, targetId),
        with: {
          items: {
            with: { product: true }
          }
        },
        orderBy: desc(orders.createdAt),
      });

      clientOrders.forEach(order => {
        historyItems.push({
          id: `order-${order.id}`,
          type: "store_order",
          date: order.createdAt,
          title: "Storefront Purchase",
          description: `Ordered ${order.items.length} item(s)`,
          price: order.totalAmountCents / 100,
          status: order.status,
          shippingMethod: order.fulfillmentMethod,
          items: order.items.map((i: any) => ({
            name: i.product?.title || "Deleted Product",
            quantity: i.quantity,
            price: i.priceAtPurchaseCents / 100
          }))
        });
      });

      return historyItems.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
    }),

  getUpcoming: protectedProcedure
    .input(z.object({ clientId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const targetId =
        (ctx.user.role === "artist" || ctx.user.role === "admin") &&
          input?.clientId
          ? input.clientId
          : ctx.user.id;

      const allAppointments = await db.getClientCalendar(
        targetId
      );
      const now = new Date();
      return allAppointments
        .filter(
          a =>
            (a.status === "pending" || a.status === "confirmed") &&
            new Date(a.startTime) > now
        )
        .map(a => ({
          id: a.id,
          date: a.startTime,
          endDate: a.endTime,
          title: a.title,
          serviceName: a.serviceName,
          status: a.status,
          price: a.price,
          depositAmount: a.depositAmount,
          sessionNumber: a.sessionNumber,
          totalSessions: a.totalSessions,
        }))
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
    }),

  getConsentForms: protectedProcedure
    .input(z.object({ clientId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const targetId =
        (ctx.user.role === "artist" || ctx.user.role === "admin") &&
          input?.clientId
          ? input.clientId
          : ctx.user.id;

      const database = await db.getDb();
      if (!database) return [];

      return database
        .select()
        .from(consentForms)
        .where(eq(consentForms.clientId, targetId))
        .orderBy(desc(consentForms.createdAt));
    }),

  getBoards: protectedProcedure
    .input(z.object({ clientId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const targetId =
        (ctx.user.role === "artist" || ctx.user.role === "admin") &&
          input?.clientId
          ? input.clientId
          : ctx.user.id;

      const database = await db.getDb();
      if (!database) return [];

      const userBoards = await database
        .select()
        .from(moodboards)
        .where(eq(moodboards.clientId, targetId))
        .orderBy(desc(moodboards.createdAt));

      const boardsWithItems = await Promise.all(
        userBoards.map(async board => {
          const items = await database
            .select()
            .from(moodboardItems)
            .where(eq(moodboardItems.moodboardId, board.id))
            .orderBy(desc(moodboardItems.createdAt))
            .limit(4);

          return {
            ...board,
            previewImages: items.map(i => i.imageUrl),
            itemCount: items.length,
          };
        })
      );

      return boardsWithItems;
    }),

  createMoodboard: protectedProcedure
    .input(z.object({ title: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await database.insert(moodboards).values({
        clientId: ctx.user.id,
        title: input.title,
      });
      return { success: true };
    }),

  deleteMoodboard: protectedProcedure
    .input(z.object({ boardId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const board = await database.query.moodboards.findFirst({
        where: and(
          eq(moodboards.id, input.boardId),
          eq(moodboards.clientId, ctx.user.id)
        ),
      });
      if (!board) throw new TRPCError({ code: "FORBIDDEN" });

      await database.delete(moodboards).where(eq(moodboards.id, input.boardId));
      return { success: true };
    }),

  addMoodboardImage: protectedProcedure
    .input(z.object({ boardId: z.number(), imageUrl: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const board = await database.query.moodboards.findFirst({
        where: and(
          eq(moodboards.id, input.boardId),
          eq(moodboards.clientId, ctx.user.id)
        ),
      });
      if (!board) throw new TRPCError({ code: "FORBIDDEN" });

      await database.insert(moodboardItems).values({
        moodboardId: input.boardId,
        imageUrl: input.imageUrl,
      });

      return { success: true };
    }),

  getPhotos: protectedProcedure
    .input(z.object({ clientId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const targetId =
        (ctx.user.role === "artist" || ctx.user.role === "admin") &&
          input?.clientId
          ? input.clientId
          : ctx.user.id;

      const conversations = await db.getConversationsForUser(
        targetId,
        "client"
      );

      const allPhotos: { id: number; url: string; createdAt: Date }[] = [];

      for (const conv of conversations) {
        const msgs = await db.getMessages(conv.id, 50);
        msgs.forEach(m => {
          if (m.senderId === ctx.user.id && m.messageType === "image") {
            allPhotos.push({
              id: m.id,
              url: m.content,
              createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            });
          }
        });
      }

      return allPhotos.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }),

  updateClientProfile: protectedProcedure
    .input(z.object({
      clientId: z.string(),
      name: z.string().min(1),
      phone: z.string().optional().or(z.literal(""))
    }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "artist" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only artists can update client profiles." });
      }

      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify relationship
      const { conversations } = await import("../../drizzle/schema");
      const conv = await database.query.conversations.findFirst({
        where: and(
          eq(conversations.artistId, ctx.user.id),
          eq(conversations.clientId, input.clientId)
        )
      });

      if (!conv && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to modify this client." });
      }

      await database.update(users)
        .set({
          name: input.name,
          phone: input.phone || null
        })
        .where(eq(users.id, input.clientId));

      return { success: true };
    }),

  getClientNotes: protectedProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) return [];
      return database
        .select()
        .from(clientNotes)
        .where(
          and(
            eq(clientNotes.clientId, input.clientId),
            eq(clientNotes.artistId, ctx.user.id)
          )
        )
        .orderBy(desc(clientNotes.createdAt));
    }),

  addClientNote: protectedProcedure
    .input(z.object({ clientId: z.string(), note: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const newNote = {
        id: crypto.randomUUID(),
        artistId: ctx.user.id,
        clientId: input.clientId,
        note: input.note,
      };

      await database.insert(clientNotes).values(newNote);
      return newNote;
    }),

  deleteClientNote: protectedProcedure
    .input(z.object({ noteId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await database
        .delete(clientNotes)
        .where(
          and(
            eq(clientNotes.id, input.noteId),
            eq(clientNotes.artistId, ctx.user.id)
          )
        );
      return { success: true };
    }),
});

function getActionTitle(action: string) {
  switch (action) {
    case "created":
      return "Appointment Requested";
    case "rescheduled":
      return "Appointment Rescheduled";
    case "cancelled":
      return "Appointment Cancelled";
    case "completed":
      return "Appointment Completed";
    case "confirmed":
      return "Appointment Confirmed";
    case "proposal_revoked":
      return "Proposal Revoked";
    default:
      return "Appointment Update";
  }
}

function getActionDescription(action: string, appt: any) {
  switch (action) {
    case "created":
      return `Request sent for ${appt.serviceName}`;
    case "rescheduled":
      return `Time updated to ${new Date(appt.startTime).toLocaleString()}`;
    case "cancelled":
      return `Appointment for ${appt.serviceName} was cancelled`;
    case "completed":
      return appt.paymentMethod && appt.paymentMethod !== "none"
        ? `Service finalized and paid with ${appt.paymentMethod}`
        : `Service finalized and paid`;
    case "confirmed":
      return `Deposit confirmed for ${appt.serviceName}`;
    case "proposal_revoked":
      return `The artist revoked the project proposal`;
    default:
      return `Action: ${action} on ${appt.serviceName}`;
  }
}
