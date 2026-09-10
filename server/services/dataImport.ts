import { randomUUID } from "node:crypto";
import { and, eq, or, sql, lt, gt, ne } from "drizzle-orm";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { getDb, withDatabaseTransaction } from "./core";
import { generateRequiredForms } from "./appointmentService";
import {
  importLocalTime,
  normalEmail,
  normalPhone,
  type ImportInput,
  type ImportResult,
} from "../../shared/importData";
import { localToUTC, getBusinessTimezone } from "../../shared/utils/timezone";
const mysql = (value: string | Date) =>
  new Date(value).toISOString().slice(0, 19).replace("T", " ");
export async function processImport(
  artistId: string,
  input: ImportInput,
  commit: boolean
): Promise<ImportResult[]> {
  const database = await getDb();
  if (!database) throw new Error("Database unavailable");
  const settings = await database.query.artistSettings.findFirst({
    where: eq(schema.artistSettings.userId, artistId),
  });
  let services: Array<{
    id?: string;
    name: string;
    duration?: number;
    price?: number;
  }> = [];
  try {
    services = JSON.parse(settings?.services || "[]");
  } catch {}
  const intervals: { start: string; end: string }[] = [];
  const seen = new Set<string>();
  const result: ImportResult[] = [];
  for (const [index, row] of input.rows.entries()) {
    const base = { index, sourceRow: row.sourceRow, name: row.name };
    try {
      const email = normalEmail(row.email),
        phone = normalPhone(row.phone);
      if (
        !row.name.trim() ||
        (!email && !phone) ||
        (email && !z.string().email().safeParse(email).success) ||
        (phone && !/^\+?\d{7,15}$/.test(phone))
      ) {
        result.push({
          ...base,
          status: "invalid",
          detail:
            "Provide a valid email or phone. No account will be created without contact information.",
        });
        continue;
      }
      const mappedKey = input.serviceMap[row.serviceName];
      const mapped = mappedKey
        ? services.find(s => String(s.id || s.name) === mappedKey)
        : undefined;
      let start = "",
        end = "";
      if (input.mode === "appointments") {
        const timezone = getBusinessTimezone();
        start = mysql(
          localToUTC(importLocalTime(row.date, row.startTime), timezone)
        );
        end =
          mapped?.duration || !row.endTime
            ? mysql(
                new Date(
                  +new Date(start.replace(" ", "T") + "Z") +
                    (mapped?.duration || 60) * 60000
                )
              )
            : mysql(
                localToUTC(importLocalTime(row.date, row.endTime), timezone)
              );
        if (end <= start) throw new Error("End time must be after start time.");
      }
      const keys = [
        email && `email:${email}:${start}`,
        phone && `phone:${phone}:${start}`,
      ].filter(Boolean) as string[];
      if (keys.some(k => seen.has(k))) {
        result.push({
          ...base,
          status: "duplicate",
          detail: "Repeated contact/session in this file.",
        });
        continue;
      }
      if (
        input.mode === "appointments" &&
        intervals.some(slot => start < slot.end && end > slot.start)
      ) {
        result.push({
          ...base,
          status: "conflict",
          detail: "Overlaps another ready appointment in this file.",
        });
        continue;
      }
      const inspect = async (
        db: NonNullable<Awaited<ReturnType<typeof getDb>>>
      ): Promise<ImportResult> => {
        if (commit)
          await db
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(eq(schema.users.id, artistId))
            .for("update");
        const conditions = [
          ...(email
            ? [sql`lower(trim(${schema.users.email})) = ${email}`]
            : []),
          ...(phone
            ? [
                eq(schema.users.phone, phone),
                eq(schema.users.phone, row.phone.trim()),
              ]
            : []),
        ];
        const candidates = await db
          .select({ id: schema.users.id, role: schema.users.role })
          .from(schema.users)
          .where(or(...conditions))
          .limit(3);
        if (candidates.length > 1)
          return {
            ...base,
            status: "conflict",
            detail:
              "Email and phone match multiple accounts. Resolve the contact before importing.",
          };
        const existing = candidates[0];
        if (existing && existing.role !== "client")
          return {
            ...base,
            status: "conflict",
            detail: "This contact cannot be imported as a client.",
          };
        const conversation = existing
          ? await db.query.conversations.findFirst({
              where: and(
                eq(schema.conversations.artistId, artistId),
                eq(schema.conversations.clientId, existing.id)
              ),
            })
          : null;
        if (input.mode === "clients" && conversation)
          return {
            ...base,
            status: "duplicate",
            detail: "Already in your client list.",
          };
        if (input.mode === "appointments") {
          const same = existing
            ? await db.query.appointments.findFirst({
                where: and(
                  eq(schema.appointments.artistId, artistId),
                  eq(schema.appointments.clientId, existing.id),
                  eq(schema.appointments.startTime, start)
                ),
              })
            : null;
          if (same)
            return {
              ...base,
              status: "duplicate",
              detail: "This client/session already exists.",
            };
          const overlap = await db
            .select({ id: schema.appointments.id })
            .from(schema.appointments)
            .where(
              and(
                eq(schema.appointments.artistId, artistId),
                ne(schema.appointments.status, "cancelled"),
                lt(schema.appointments.startTime, end),
                gt(schema.appointments.endTime, start)
              )
            )
            .limit(1);
          if (overlap.length)
            return {
              ...base,
              status: "conflict",
              detail:
                "Overlaps another appointment. Change the time before importing.",
            };
        }
        if (!commit)
          return {
            ...base,
            status: existing ? "matched" : "new",
            detail: existing
              ? "Existing client account matched; profile will not be overwritten."
              : "New client will be created.",
          };
        const clientId = existing?.id || `usr_imp_${randomUUID()}`;
        if (!existing)
          await db.insert(schema.users).values({
            id: clientId,
            name: row.name,
            email: email || null,
            phone: phone || null,
            role: "client",
            loginMethod: "imported",
          });
        let conversationId = conversation?.id;
        if (!conversationId) {
          const [created] = await db
            .insert(schema.conversations)
            .values({ artistId, clientId });
          conversationId = created.insertId;
        }
        if (input.mode === "appointments") {
          const cents = Math.round((row.price ?? mapped?.price ?? 0) * 100);
          const [created] = await db.insert(schema.appointments).values({
            artistId,
            clientId,
            conversationId,
            title: mapped?.name || row.serviceName || "Imported appointment",
            serviceName:
              mapped?.name || row.serviceName || "Imported appointment",
            startTime: start,
            endTime: end,
            timeZone: getBusinessTimezone(),
            status: "confirmed",
            price: Math.round(cents / 100),
            totalExpectedAmountCents: cents,
            totalPaidAmountCents: 0,
            remainingBalanceCents: cents,
          });
          await generateRequiredForms(created.insertId, db);
        }
        return {
          ...base,
          status: "imported",
          detail: "Imported successfully.",
        };
      };
      const rowResult = commit
        ? await withDatabaseTransaction(inspect)
        : await inspect(database);
      result.push(rowResult);
      if (
        ["new", "matched", "imported", "duplicate"].includes(rowResult.status)
      )
        keys.forEach(k => seen.add(k));
      if (
        input.mode === "appointments" &&
        ["new", "matched", "imported"].includes(rowResult.status)
      )
        intervals.push({ start, end });
    } catch (e) {
      result.push({
        ...base,
        status: commit ? "failed" : "invalid",
        detail:
          e instanceof Error &&
          [
            "Use YYYY-MM-DD or DD/MM/YYYY and HH:mm (optional AM/PM).",
            "Invalid time.",
            "Invalid calendar date.",
            "End time must be after start time.",
          ].includes(e.message)
            ? e.message
            : "This row could not be processed. Check its values and retry.",
      });
    }
  }
  return result;
}
