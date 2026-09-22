import { masterDevLoginAttempt, createMasterDevToken } from "../services/masterDevAccess";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, like, ne, or, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { comparePassword, hashPassword } from "../_core/auth-new";
import { getDb, withDatabaseTransaction } from "../services/core";
import {
  masterDevIdentity,
  masterDevSession,
} from "../services/masterDevAccess";
import {
  users,
  appointments,
  paymentLedger,
  artistSettings,
  suppliers,
  supplierOrders,
  orders,
  merchants,
  studios,
  studioMembers,
  systemLogs,
} from "../../drizzle/schema";

const dev = protectedProcedure.use(({ ctx, next }) => {
  if (!masterDevSession(ctx.user, ctx.req.headers.authorization))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Private developer session required. Sign in again.",
    });
  return next({ ctx });
});
const roles = z.enum(["artist", "client", "merchant", "studio"]);
const count = sql<number>`count(*)`.mapWith(Number);
async function database() {
  const db = await getDb();
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database unavailable",
    });
  return db;
}
async function audit(
  db: Awaited<ReturnType<typeof database>>,
  userId: string,
  action: string,
  target: string
) {
  await db.insert(systemLogs).values({
    level: "info",
    category: "master_dev:audit",
    message: action,
    userId,
    metadata: JSON.stringify({ target }),
  });
}
const personFields = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  city: users.city,
  country: users.country,
  createdAt: users.createdAt,
  lastSignedIn: users.lastSignedIn,
};
const editable = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(320),
  city: z.string().max(100).default(""),
  country: z.string().max(100).default(""),
});
export const masterDevRouter = router({
  login: publicProcedure
    .input(
      z
        .object({
          username: z.string().max(100),
          password: z.string().min(1).max(128),
        })
        .strict()
    )
    .mutation(async ({ ctx, input }) => {
      masterDevLoginAttempt(ctx.req.ip || ctx.req.socket?.remoteAddress || "unknown");
      const db = await database();
      const [user] = process.env.MASTER_DEV_USER_ID
        ? await db
            .select()
            .from(users)
            .where(eq(users.id, process.env.MASTER_DEV_USER_ID))
            .limit(1)
        : [];
      const valid = await comparePassword(
        input.password,
        user?.password ||
          "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
      );
      if (
        !user ||
        !masterDevIdentity(user) ||
        input.username !== (process.env.MASTER_DEV_USERNAME || "MasterDevP") ||
        !valid
      )
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid credentials",
        });
      await audit(db, user.id, "Developer sign-in", user.id);
      const token = createMasterDevToken(user);
      return { token, user: { id: user.id, name: user.name, role: user.role } };
    }),
  overview: dev.query(async ({ ctx }) => {
    const db = await database();
    const since = new Date(Date.now() - 30 * 86400_000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    const [people, bookings, money, locations, styles, activity, active] =
      await Promise.all([
        db
          .select({ role: users.role, count })
          .from(users)
          .where(ne(users.role, "master_dev"))
          .groupBy(users.role),
        db
          .select({ status: appointments.status, count })
          .from(appointments)
          .where(gte(appointments.createdAt, since))
          .groupBy(appointments.status),
        db
          .select({
            country: artistSettings.businessCountry,
            amountCents:
              sql<number>`coalesce(sum(case when ${paymentLedger.transactionType} in ('deposit','balance','store_order','refund') then ${paymentLedger.amountCents}-${paymentLedger.artistFeeCents} else 0 end),0)`.mapWith(
                Number
              ),
            artists:
              sql<number>`count(distinct ${paymentLedger.artistId})`.mapWith(
                Number
              ),
          })
          .from(paymentLedger)
          .leftJoin(
            artistSettings,
            eq(artistSettings.userId, paymentLedger.artistId)
          )
          .where(gte(paymentLedger.createdAt, since))
          .groupBy(artistSettings.businessCountry),
        db
          .select({
            city: users.city,
            country: users.country,
            role: users.role,
            count,
          })
          .from(users)
          .where(or(eq(users.role, "artist"), eq(users.role, "client")))
          .groupBy(users.city, users.country, users.role),
        db
          .select({ styles: artistSettings.styleOptions })
          .from(artistSettings)
          .innerJoin(users, eq(users.id, artistSettings.userId))
          .where(eq(users.role, "artist")),
        db
          .select({ task: systemLogs.message, count })
          .from(systemLogs)
          .where(
            and(
              eq(systemLogs.category, "usage:action"),
              gte(systemLogs.createdAt, since)
            )
          )
          .groupBy(systemLogs.message)
          .orderBy(desc(count))
          .limit(20),
        db
          .select({
            role: users.role,
            count: sql<number>`count(distinct ${systemLogs.userId})`.mapWith(
              Number
            ),
          })
          .from(systemLogs)
          .innerJoin(users, eq(users.id, systemLogs.userId))
          .where(
            and(
              eq(systemLogs.category, "usage:action"),
              gte(systemLogs.createdAt, since)
            )
          )
          .groupBy(users.role),
      ]);
    const byLocation = async (side: "artist" | "client") =>
      db
        .select({ city: users.city, country: users.country, count })
        .from(appointments)
        .innerJoin(
          users,
          eq(
            users.id,
            side === "artist" ? appointments.artistId : appointments.clientId
          )
        )
        .where(
          and(
            gte(appointments.createdAt, since),
            ne(appointments.status, "cancelled")
          )
        )
        .groupBy(users.city, users.country);
    const [artistBookings, clientBookings, locationActivity] =
      await Promise.all([
        byLocation("artist"),
        byLocation("client"),
        db
          .select({
            city: users.city,
            country: users.country,
            role: users.role,
            count: sql<number>`count(distinct ${systemLogs.userId})`.mapWith(
              Number
            ),
          })
          .from(systemLogs)
          .innerJoin(users, eq(users.id, systemLogs.userId))
          .where(
            and(
              eq(systemLogs.category, "usage:action"),
              gte(systemLogs.createdAt, since)
            )
          )
          .groupBy(users.city, users.country, users.role),
      ]);
    const styleCounts = new Map<string, number>();
    for (const row of styles) {
      try {
        const values = JSON.parse(row.styles || "[]");
        if (Array.isArray(values))
          for (const s of new Set(
            values.filter((v): v is string => typeof v === "string")
          ))
            styleCounts.set(s, (styleCounts.get(s) || 0) + 1);
      } catch {}
    }
    await audit(db, ctx.user.id, "Viewed aggregate dashboard", "overview");
    const totalPeople = people.reduce((n, r) => n + r.count, 0);
    return {
      people,
      averageActionsPerAccount: totalPeople
        ? activity.reduce((n, a) => n + a.count, 0) / totalPeople
        : 0,
      bookings,
      money,
      locations: locations
        .filter(r => r.count >= 5)
        .map(r => ({
          ...r,
          bookings:
            (r.role === "artist" ? artistBookings : clientBookings).find(
              b => b.city === r.city && b.country === r.country
            )?.count || 0,
          active:
            locationActivity.find(
              a =>
                a.city === r.city &&
                a.country === r.country &&
                a.role === r.role
            )?.count || 0,
        })),
      suppressedLocations: locations
        .filter(r => r.count < 5)
        .reduce((n, r) => n + r.count, 0),
      styles: [...styleCounts]
        .map(([style, artists]) => ({ style, artists }))
        .sort((a, b) => b.artists - a.artists),
      activity,
      active,
      averageBookingsPerAccount: totalPeople
        ? bookings
            .filter(r => r.status !== "cancelled")
            .reduce((n, r) => n + r.count, 0) / totalPeople
        : 0,
      since,
    };
  }),
  people: dev
    .input(
      z.object({
        search: z.string().max(100).default(""),
        role: z.string().max(20).default("all"),
        page: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await database();
      const filter = and(
        ne(users.role, "master_dev"),
        input.role !== "all" ? eq(users.role, input.role) : undefined,
        input.search
          ? or(
              like(users.name, `%${input.search}%`),
              like(users.email, `%${input.search}%`)
            )
          : undefined
      );
      const [rows, total] = await Promise.all([
        db
          .select(personFields)
          .from(users)
          .where(filter)
          .orderBy(desc(users.createdAt), users.id)
          .limit(30)
          .offset(input.page * 30),
        db.select({ count }).from(users).where(filter),
      ]);
      return { rows, total: total[0].count };
    }),
  person: dev
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await database();
      const [person] = await db
        .select(personFields)
        .from(users)
        .where(and(eq(users.id, input.id), ne(users.role, "master_dev")))
        .limit(1);
      if (!person) throw new TRPCError({ code: "NOT_FOUND" });
      const [bookings, ledger, activity, commerce] = await Promise.all([
        db
          .select({ status: appointments.status, count })
          .from(appointments)
          .where(
            or(
              eq(appointments.artistId, input.id),
              eq(appointments.clientId, input.id)
            )
          )
          .groupBy(appointments.status),
        db
          .select({
            type: paymentLedger.transactionType,
            country: artistSettings.businessCountry,
            amountCents: sql<number>`sum(${paymentLedger.amountCents})`.mapWith(
              Number
            ),
            feeCents: sql<number>`sum(${paymentLedger.artistFeeCents})`.mapWith(
              Number
            ),
          })
          .from(paymentLedger)
          .leftJoin(
            artistSettings,
            eq(artistSettings.userId, paymentLedger.artistId)
          )
          .where(
            person.role.replace("disabled_", "") === "client"
              ? eq(paymentLedger.clientId, input.id)
              : eq(paymentLedger.artistId, input.id)
          )
          .groupBy(
            paymentLedger.transactionType,
            artistSettings.businessCountry
          ),
        db
          .select({ task: systemLogs.message, count })
          .from(systemLogs)
          .where(
            and(
              eq(systemLogs.userId, input.id),
              eq(systemLogs.category, "usage:action")
            )
          )
          .groupBy(systemLogs.message)
          .limit(30),
        db
          .select({
            currency: orders.currency,
            count,
            amountCents: sql<number>`sum(${orders.totalAmountCents})`.mapWith(
              Number
            ),
          })
          .from(orders)
          .where(
            and(
              or(eq(orders.artistId, input.id), eq(orders.clientId, input.id)),
              or(eq(orders.status, "paid"), eq(orders.status, "fulfilled"))
            )
          )
          .groupBy(orders.currency),
      ]);
      const [settings] = await db
        .select({ country: artistSettings.businessCountry })
        .from(artistSettings)
        .where(eq(artistSettings.userId, input.id))
        .limit(1);
      await audit(db, ctx.user.id, "Viewed account metrics", input.id);
      return {
        person,
        bookings,
        ledger,
        commerce,
        country: settings?.country,
        activity,
      };
    }),
  savePerson: dev
    .input(
      editable.extend({ id: z.string().optional(), role: roles.optional() })
    )
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        const id = input.id || `user_${randomBytes(16).toString("hex")}`;
        const [existing] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, id))
          .limit(1);
        if (
          input.id &&
          (!existing ||
            existing.role === "master_dev" ||
            existing.role === "admin")
        )
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Account cannot be edited here",
          });
        const [duplicate] = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.email, input.email), ne(users.id, id)))
          .limit(1);
        if (duplicate)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email already belongs to an account",
          });
        const fields = {
          name: input.name,
          email: input.email,
          city: input.city,
          country: input.country,
        };
        if (existing)
          await db.update(users).set(fields).where(eq(users.id, id));
        else {
          const role = input.role || "client";
          await db.insert(users).values({
            ...fields,
            id,
            role,
            loginMethod: "email",
            hasCompletedOnboarding: 0,
            password: await hashPassword(randomBytes(32).toString("hex")),
          });
          if (role === "studio") {
            const studioId = `studio_${randomBytes(16).toString("hex")}`;
            await db
              .insert(studios)
              .values({ id: studioId, name: input.name, ownerId: id });
            await db
              .insert(studioMembers)
              .values({
                studioId,
                userId: id,
                role: "owner",
                status: "active",
              });
          }
          if (role === "merchant")
            await db.insert(merchants).values({
              userId: id,
              businessName: input.name,
              status: "pending",
            });
        }
        await audit(
          db,
          ctx.user.id,
          existing ? "Edited account" : "Created account",
          id
        );
        return { id };
      })
    ),
  setAccountEnabled: dev
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        const [person] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, input.id))
          .limit(1)
          .for("update");
        if (
          !person ||
          !["artist", "client", "merchant", "studio"].includes(
            person.role.replace("disabled_", "")
          )
        )
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This account cannot be deactivated",
          });
        const role = person.role.replace("disabled_", "");
        await db
          .update(users)
          .set({ role: input.enabled ? role : `disabled_${role}` })
          .where(eq(users.id, input.id));
        await audit(
          db,
          ctx.user.id,
          input.enabled ? "Restored account" : "Deactivated account",
          input.id
        );
        return { success: true };
      })
    ),
  suppliers: dev.query(async () => {
    const db = await database();
    const rows = await db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        isActive: suppliers.isActive,
        websiteUrl: suppliers.websiteUrl,
        contactEmail: suppliers.contactEmail,
        currency: suppliers.currency,
        merchantId: suppliers.merchantId,
      })
      .from(suppliers)
      .orderBy(suppliers.name);
    const metrics = await db
      .select({
        supplierId: supplierOrders.supplierId,
        currency: supplierOrders.currency,
        orders: count,
        salesCents: sql<number>`sum(${supplierOrders.subtotalCents})`.mapWith(
          Number
        ),
      })
      .from(supplierOrders)
      .where(eq(supplierOrders.status, "paid"))
      .groupBy(supplierOrders.supplierId, supplierOrders.currency);
    return rows.map(r => ({
      ...r,
      metrics: metrics.filter(m => m.supplierId === r.id),
    }));
  }),
  saveSupplier: dev
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().trim().min(1).max(255),
        websiteUrl: z
          .string()
          .url()
          .refine(v => /^https?:\/\//.test(v)),
        contactEmail: z.string().email().or(z.literal("")),
      })
    )
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        const { id, ...fields } = input;
        if (id) {
          const [existing] = await db
            .select({ id: suppliers.id })
            .from(suppliers)
            .where(eq(suppliers.id, id))
            .limit(1);
          if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
          await db.update(suppliers).set(fields).where(eq(suppliers.id, id));
        } else await db.insert(suppliers).values(fields);
        await audit(
          db,
          ctx.user.id,
          id ? "Edited supplier" : "Added supplier",
          String(id || input.name)
        );
        return { success: true };
      })
    ),
  setSupplierVisible: dev
    .input(z.object({ id: z.number().int().positive(), visible: z.boolean() }))
    .mutation(async ({ ctx, input }) =>
      withDatabaseTransaction(async db => {
        const [supplier] = await db
          .select({ id: suppliers.id })
          .from(suppliers)
          .where(eq(suppliers.id, input.id))
          .limit(1)
          .for("update");
        if (!supplier) throw new TRPCError({ code: "NOT_FOUND" });
        await db
          .update(suppliers)
          .set({ isActive: input.visible ? 1 : 0 })
          .where(eq(suppliers.id, input.id));
        await audit(
          db,
          ctx.user.id,
          input.visible
            ? "Restored supplier to directory"
            : "Removed supplier from directory",
          String(input.id)
        );
        return { success: true };
      })
    ),
});
