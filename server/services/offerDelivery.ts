import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import type { Express } from "express";
import rateLimit from "express-rate-limit";
import * as s from "../../drizzle/schema";
import { getDb, withDatabaseTransaction } from "./core";
import { offersEnabled } from "./offerAvailability";
import { getAuthSecret } from "../_core/auth-secret";
import { publicOrigin } from "../_core/publicOrigin";
import { sendPushNotification } from "./pushService";
import { offerRulesSchema } from "../../shared/offerRules";
const mysql = (d = new Date()) =>
  d.toISOString().slice(0, 19).replace("T", " ");
export const deliveryAvailability = () => ({
  smsAvailable: !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_MESSAGING_SERVICE_SID
  ),
  pushAvailable: !!(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  ),
});
const auth = () =>
  `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;
export class UncertainSmsError extends Error {}
export async function sendOfferSms(to: string, body: string) {
  if (!deliveryAvailability().smsAvailable)
    throw new Error("SMS provider is not configured.");
  let res: Response;
  try {
    res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: auth(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          Body: body,
          MessagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
  } catch {
    throw new UncertainSmsError(
      "SMS response was not received. Delivery is unknown; do not resend automatically."
    );
  }
  if (!res.ok) {
    if (res.status >= 500)
      throw new UncertainSmsError("SMS provider response is uncertain.");
    throw new Error(`SMS provider rejected the request (${res.status}).`);
  }
  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new UncertainSmsError("SMS acknowledgement could not be read.");
  }
  if (typeof data.sid !== "string")
    throw new UncertainSmsError("SMS acknowledgement was incomplete.");
  return data.sid as string;
}
const signature = (v: string) =>
  createHmac("sha256", getAuthSecret()).update(v).digest("hex");
function unsubscribeToken(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, purpose: "offer-unsubscribe" })
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
function unsubscribeUser(token: string) {
  const [data, sig] = token.split(".");
  if (
    !data ||
    !sig ||
    sig.length !== 64 ||
    !timingSafeEqual(Buffer.from(signature(data)), Buffer.from(sig))
  )
    throw new Error("Invalid link");
  const value = JSON.parse(Buffer.from(data, "base64url").toString());
  if (value.purpose !== "offer-unsubscribe" || typeof value.sub !== "string")
    throw new Error("Invalid link");
  return value.sub as string;
}
export function registerOfferUnsubscribe(app: Express) {
  const limiter = rateLimit({ windowMs: 60000, max: 30 });
  app.get("/api/offers/unsubscribe", limiter, (req, res) => {
    try {
      unsubscribeUser(String(req.query.token || ""));
      res
        .type("html")
        .send(
          '<!doctype html><meta name="viewport" content="width=device-width"><title>Tattoi preferences</title><main style="font:18px system-ui;max-width:450px;margin:10vh auto;padding:24px"><h1>Stop promotional messages?</h1><p>This stops promotional SMS and push messages. Booking updates remain available.</p><form method="post"><button style="font:inherit;padding:16px">Unsubscribe</button></form></main>'
        );
    } catch {
      res
        .status(400)
        .send(
          "This link is invalid. Manage notifications in your Tattoi account."
        );
    }
  });
  app.post("/api/offers/unsubscribe", limiter, async (req, res) => {
    try {
      const id = unsubscribeUser(String(req.query.token || ""));
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db
        .insert(s.offerPreferences)
        .values({ userId: id, sms: 0, push: 0, updatedAt: mysql() })
        .onDuplicateKeyUpdate({ set: { sms: 0, push: 0, updatedAt: mysql() } });
      res
        .type("text")
        .send(
          "You have unsubscribed from Tattoi promotions. Booking updates are unchanged."
        );
    } catch {
      res
        .status(400)
        .send(
          "Unable to update preferences. Use Notifications in your Tattoi account."
        );
    }
  });
}
export async function requestSmsCode(userId: string, phone: string) {
  if (!/^\+[1-9]\d{7,14}$/.test(phone))
    throw new Error(
      "Use an international mobile number, such as +61… or +64…."
    );
  const code = String(randomInt(100000, 1000000));
  await withDatabaseTransaction(async db => {
    await db
      .select({ id: s.users.id })
      .from(s.users)
      .where(eq(s.users.id, userId))
      .for("update");
    const old = await db.query.offerSmsChallenges.findFirst({
      where: eq(s.offerSmsChallenges.userId, userId),
    });
    if (old && Date.now() - +new Date(old.createdAt + "Z") < 60000)
      throw new Error("Wait a minute before requesting another code.");
    const recent =
      old && Date.now() - +new Date(old.windowStart + "Z") < 86400000;
    if (recent && old.sendCount >= 5)
      throw new Error("The daily verification limit has been reached.");
    const values = {
      phone,
      codeHash: signature(`${userId}:${phone}:${code}`),
      attempts: 0,
      createdAt: mysql(),
      expiresAt: mysql(new Date(Date.now() + 600000)),
      sendCount: recent ? old.sendCount + 1 : 1,
      windowStart: recent ? old.windowStart : mysql(),
    };
    await db
      .insert(s.offerSmsChallenges)
      .values({ userId, ...values })
      .onDuplicateKeyUpdate({ set: values });
  });
  await sendOfferSms(
    phone,
    `Your Tattoi verification code is ${code}. It expires in 10 minutes. Do not share it.`
  );
  return { success: true };
}
export async function verifySmsCode(userId: string, code: string) {
  const valid = await withDatabaseTransaction(async db => {
    const [c] = await db
      .select()
      .from(s.offerSmsChallenges)
      .where(eq(s.offerSmsChallenges.userId, userId))
      .for("update");
    if (!c || c.attempts >= 5 || +new Date(c.expiresAt + "Z") <= Date.now())
      return false;
    await db
      .update(s.offerSmsChallenges)
      .set({ attempts: c.attempts + 1 })
      .where(eq(s.offerSmsChallenges.userId, userId));
    const expected = signature(`${userId}:${c.phone}:${code}`);
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(c.codeHash)))
      return false;
    await db
      .insert(s.offerPreferences)
      .values({ userId, verifiedPhone: c.phone, updatedAt: mysql() })
      .onDuplicateKeyUpdate({
        set: { verifiedPhone: c.phone, sms: 0, updatedAt: mysql() },
      });
    await db
      .update(s.offerSmsChallenges)
      .set({ expiresAt: mysql(), attempts: 5 })
      .where(eq(s.offerSmsChallenges.userId, userId));
    return true;
  });
  if (!valid) throw new Error("This code is incorrect or expired.");
  return { success: true };
}
export async function queueOfferDelivery(
  db: any,
  offerId: number,
  clientId: string,
  channels: { sms: boolean; push: boolean }
) {
  const p = await db.query.offerPreferences.findFirst({
    where: eq(s.offerPreferences.userId, clientId),
  });
  for (const channel of ["sms", "push"] as const)
    if (channels[channel])
      await db
        .insert(s.offerDeliveries)
        .values({
          offerId,
          clientId,
          channel,
          status:
            p?.[channel] && (channel !== "sms" || p.verifiedPhone)
              ? "pending"
              : "skipped",
          error: p?.[channel]
            ? null
            : "Client has not consented to this channel.",
          updatedAt: mysql(),
        })
        .onDuplicateKeyUpdate({ set: { offerId } });
}
let running = false;
export async function processOfferDeliveries() {
  if (running || !offersEnabled()) return;
  running = true;
  try {
    const db = await getDb();
    if (!db) return;
    // A crashed sender is not automatically replayed: provider acceptance may have happened.
    await db
      .update(s.offerDeliveries)
      .set({
        status: "unknown",
        error: "Sender interrupted; verify provider delivery before retrying.",
      })
      .where(
        and(
          eq(s.offerDeliveries.status, "sending"),
          lt(s.offerDeliveries.updatedAt, mysql(new Date(Date.now() - 600000)))
        )
      );
    const accepted = await db
      .select()
      .from(s.offerDeliveries)
      .where(
        and(
          eq(s.offerDeliveries.channel, "sms"),
          eq(s.offerDeliveries.status, "accepted")
        )
      )
      .limit(20);
    for (const d of accepted) {
      if (!d.providerId || !deliveryAvailability().smsAvailable) continue;
      try {
        const r = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages/${encodeURIComponent(d.providerId)}.json`,
          {
            headers: { Authorization: auth() },
            signal: AbortSignal.timeout(5000),
          }
        );
        if (r.ok) {
          const data = await r.json();
          if (["delivered", "failed", "undelivered"].includes(data.status))
            await db
              .update(s.offerDeliveries)
              .set({
                status: data.status === "delivered" ? "delivered" : "failed",
                error: data.error_code
                  ? `Provider code ${data.error_code}`
                  : null,
                updatedAt: mysql(),
              })
              .where(eq(s.offerDeliveries.id, d.id));
        }
      } catch {}
    }
    for (let i = 0; i < 10; i++) {
      const d = await withDatabaseTransaction(async tx => {
        const [row] = await tx
          .select()
          .from(s.offerDeliveries)
          .where(eq(s.offerDeliveries.status, "pending"))
          .limit(1)
          .for("update", { skipLocked: true });
        if (!row) return null;
        await tx
          .update(s.offerDeliveries)
          .set({
            status: "sending",
            attempts: row.attempts + 1,
            updatedAt: mysql(),
          })
          .where(eq(s.offerDeliveries.id, row.id));
        return row;
      });
      if (!d) break;
      let providerAccepted = false;
      try {
        const p = await db.query.offerPreferences.findFirst({
            where: eq(s.offerPreferences.userId, d.clientId),
          }),
          o = await db.query.clientOffers.findFirst({
            where: eq(s.clientOffers.id, d.offerId),
          });
        if (!p?.[d.channel] || !o || o.clientId !== d.clientId) {
          await db
            .update(s.offerDeliveries)
            .set({
              status: "skipped",
              error: "Consent or offer ownership changed.",
              updatedAt: mysql(),
            })
            .where(eq(s.offerDeliveries.id, d.id));
          continue;
        }
        const rules = offerRulesSchema.parse(JSON.parse(o.rulesJson));
        if (rules.expiresAt && +new Date(rules.expiresAt) <= Date.now()) {
          await db
            .update(s.offerDeliveries)
            .set({
              status: "skipped",
              error: "Offer expired.",
              updatedAt: mysql(),
            })
            .where(eq(s.offerDeliveries.id, d.id));
          continue;
        }
        const artist = await db.query.users.findFirst({
          where: eq(s.users.id, o.artistId),
        });
        const body = `${artist?.name || "Your artist"}: ${rules.name}. See your offer in Tattoi.`;
        if (d.channel === "sms") {
          if (!p.verifiedPhone)
            throw new Error("Verify a mobile number before receiving SMS.");
          const origin = publicOrigin();
          const sid = await sendOfferSms(
            p.verifiedPhone,
            `${body} ${origin}/bookings Stop promotions: ${origin}/api/offers/unsubscribe?token=${unsubscribeToken(d.clientId)}`
          );
          providerAccepted = true;
          await db
            .update(s.offerDeliveries)
            .set({
              status: "accepted",
              providerId: sid,
              error: null,
              updatedAt: mysql(),
            })
            .where(eq(s.offerDeliveries.id, d.id));
        } else {
          const result = await sendPushNotification(d.clientId, {
            title: artist?.name || "Tattoi offer",
            body: rules.name,
            url: "/bookings",
            data: { tag: `offer-${d.offerId}` },
          });
          const sent = result.results.some(r => r.status === "sent");
          await db
            .update(s.offerDeliveries)
            .set({
              status: sent ? "accepted" : "failed",
              error: sent ? null : "No active device accepted the push.",
              updatedAt: mysql(),
            })
            .where(eq(s.offerDeliveries.id, d.id));
        }
      } catch (e) {
        await db
          .update(s.offerDeliveries)
          .set({
            status:
              providerAccepted || e instanceof UncertainSmsError
                ? "unknown"
                : "failed",
            error: e instanceof Error ? e.message : "Delivery failed",
            updatedAt: mysql(),
          })
          .where(eq(s.offerDeliveries.id, d.id));
      }
    }
  } finally {
    running = false;
  }
}
