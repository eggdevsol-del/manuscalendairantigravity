import { createHash, randomUUID } from "node:crypto";
import { and, eq, or, sql, lt, gt, ne, inArray } from "drizzle-orm";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { getDb, withDatabaseTransaction } from "./core";
import { generateRequiredForms } from "./appointmentService";
import { getClientRelationships } from "./userService";
import {
  importLocalTime,
  importedPayment,
  importedPaymentNote,
  importInputSchema,
  IMPORT_DATE_ERRORS,
  normalEmail,
  normalPhone,
  type ImportInput,
  type ImportResult,
} from "../../shared/importData";
import { localToUTC, getBusinessTimezone } from "../../shared/utils/timezone";
const mysql = (value: string | Date) =>
  new Date(value).toISOString().slice(0, 19).replace("T", " ");
/**
 * Id of the artist's note that keeps an imported email the client record
 * itself could not carry. One per artist and address, so it doubles as the
 * key for finding that record on a later import.
 */
export const importedEmailNoteId = (artistId: string, email: string) =>
  `imp_email_${createHash("sha256").update(`${artistId}\n${email}`).digest("hex")}`;
export async function processImport(
  artistId: string,
  raw: ImportInput,
  commit: boolean,
  now: Date = new Date()
): Promise<ImportResult[]> {
  const input = importInputSchema.parse(raw);
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
  // Future sittings default to the artist's standard deposit when the import doesn't set one.
  const depositPercent =
    input.depositPercent ?? settings?.depositPercentage ?? 25;
  const nowSql = mysql(now);
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
        const timezone = getBusinessTimezone(settings?.timeZone);
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
      const priceCents = Math.round((row.price ?? mapped?.price ?? 0) * 100);
      const past = input.mode === "appointments" && end <= nowSql;
      const timing =
        input.mode === "appointments"
          ? {
              timing: (past ? "past" : "future") as "past" | "future",
              priceCents,
            }
          : {};
      const payNote =
        input.mode === "appointments"
          ? " " +
            importedPaymentNote(
              priceCents,
              past,
              depositPercent,
              input.depositsPaid
            )
          : "";
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
        let replaced: number[] = [];
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
        // Email is not unique across accounts, so look at every match.
        const candidates = await db
          .select({ id: schema.users.id, email: schema.users.email })
          .from(schema.users)
          .where(or(...conditions))
          .limit(20);
        // Typing someone's email or phone into a file is not a relationship.
        // Only a record this artist already works with is reused; any other
        // match is treated exactly like a stranger, so the result never says
        // whether an account exists.
        const { related } = await getClientRelationships(
          db,
          artistId,
          candidates.map(c => c.id)
        );
        const known = candidates.filter(c => related.has(c.id));
        if (known.length > 1)
          return {
            ...base,
            status: "conflict",
            detail:
              "Email and phone match more than one of your clients. Resolve the contact before importing.",
          };
        let existing: { id: string } | undefined = known[0];
        // Sign-in, password reset and claiming a record all find a person by
        // users.email, so a new record must not repeat an address any other
        // record holds: a full account or another artist's unclaimed client.
        // The address is kept in this artist's own note on the new record
        // instead, under an id built from artist + email. That id is how a
        // later import finds the same person again, whatever name or phone
        // the row has by then.
        //
        // Known limit: the artist can still tell the two cases apart, because
        // the record's email field is empty when the address was already
        // held. That is no more than auth.checkEmailExists tells anyone.
        const emailTaken =
          !!email &&
          !existing &&
          candidates.some(c => normalEmail(c.email || "") === email);
        const emailNoteId = emailTaken
          ? importedEmailNoteId(artistId, email)
          : null;
        let moveNote = false;
        if (emailNoteId) {
          const [note] = await db
            .select({ clientId: schema.clientNotes.clientId })
            .from(schema.clientNotes)
            .where(
              and(
                eq(schema.clientNotes.id, emailNoteId),
                eq(schema.clientNotes.artistId, artistId)
              )
            )
            .limit(1);
          if (note) {
            const mine = await getClientRelationships(db, artistId, [
              note.clientId,
            ]);
            if (mine.related.has(note.clientId))
              existing = { id: note.clientId };
            else moveNote = true;
          }
        }
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
          if (same && !input.replaceExisting)
            return {
              ...base,
              ...timing,
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
            .limit(input.replaceExisting ? 50 : 1);
          if (overlap.length && !input.replaceExisting)
            return {
              ...base,
              ...timing,
              status: "conflict",
              detail:
                "Overlaps another appointment. Turn on “Replace overlapping bookings” or change the time.",
            };
          replaced = overlap.map(o => o.id);
        }
        const replaceNote = replaced.length
          ? ` Replaces ${replaced.length === 1 ? "an existing booking" : `${replaced.length} existing bookings`}.`
          : "";
        if (!commit)
          return {
            ...base,
            ...timing,
            ...(replaced.length ? { replaces: replaced.length } : {}),
            status: existing ? "matched" : "new",
            detail:
              (existing
                ? "Already one of your clients; their profile will not be overwritten."
                : "New client will be created.") +
              payNote +
              replaceNote,
          };
        if (replaced.length)
          await db
            .update(schema.appointments)
            .set({ status: "cancelled" })
            .where(
              and(
                eq(schema.appointments.artistId, artistId),
                inArray(schema.appointments.id, replaced)
              )
            );
        const clientId = existing?.id || `usr_imp_${randomUUID()}`;
        if (!existing)
          await db.insert(schema.users).values({
            id: clientId,
            name: row.name,
            email: emailTaken ? null : email || null,
            phone: phone || null,
            role: "client",
            loginMethod: "imported",
          });
        if (!existing && emailNoteId) {
          const note = `Email from import: ${email}`;
          if (moveNote)
            await db
              .update(schema.clientNotes)
              .set({ clientId, note })
              .where(
                and(
                  eq(schema.clientNotes.id, emailNoteId),
                  eq(schema.clientNotes.artistId, artistId)
                )
              );
          else
            await db
              .insert(schema.clientNotes)
              .values({ id: emailNoteId, artistId, clientId, note });
        }
        let conversationId = conversation?.id;
        if (!conversationId) {
          const [created] = await db
            .insert(schema.conversations)
            .values({ artistId, clientId });
          conversationId = created.insertId;
        }
        if (input.mode === "appointments") {
          const cents = priceCents;
          const pay = importedPayment(
            cents,
            past,
            depositPercent,
            input.depositsPaid
          );
          const [created] = await db.insert(schema.appointments).values({
            artistId,
            clientId,
            conversationId,
            title: mapped?.name || row.serviceName || "Imported appointment",
            serviceName:
              mapped?.name || row.serviceName || "Imported appointment",
            startTime: start,
            endTime: end,
            timeZone: getBusinessTimezone(settings?.timeZone),
            price: Math.round(cents / 100),
            totalExpectedAmountCents: cents,
            ...pay,
          });
          // Consent forms only matter for sittings still to come.
          if (!past) await generateRequiredForms(created.insertId, db);
        }
        return {
          ...base,
          ...timing,
          ...(replaced.length ? { replaces: replaced.length } : {}),
          status: "imported",
          detail: "Imported successfully." + payNote + replaceNote,
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
            ...IMPORT_DATE_ERRORS,
            "End time must be after start time.",
          ].includes(e.message)
            ? e.message
            : "This row could not be processed. Check its values and retry.",
      });
    }
  }
  return result;
}
