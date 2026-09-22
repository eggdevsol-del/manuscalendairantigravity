import { and, asc, eq, gt, isNull, lt, lte, or } from "drizzle-orm";
import * as schema from "../../drizzle/schema";
import { designProjectName } from "../../shared/projectNames";
import { withDatabaseTransaction } from "./core";
import { generateProjectName } from "./llmEnrichment";

type DB = Parameters<Parameters<typeof withDatabaseTransaction>[0]>[0];
const mysql = (date: Date) => date.toISOString().slice(0, 19).replace("T", " ");
export function savedProjectName(
  canonical: unknown,
  appointment: unknown,
  metadata: unknown
) {
  return typeof canonical === "string" && canonical.trim()
    ? canonical
    : designProjectName(appointment) || designProjectName(metadata);
}
/** Caller locks the plan: canonical name and compatibility mirrors commit together. */
export async function persistProjectName(
  db: DB,
  plan: typeof schema.sessionPlans.$inferSelect,
  name: string
) {
  await db
    .update(schema.sessionPlans)
    .set({ projectName: name, projectNameRetryAt: null })
    .where(eq(schema.sessionPlans.id, plan.id));
  await db
    .update(schema.appointments)
    .set({ projectName: name })
    .where(eq(schema.appointments.sessionPlanId, plan.id));
  if (plan.messageId) {
    const message = await db.query.messages.findFirst({
      where: eq(schema.messages.id, plan.messageId),
    });
    if (message) {
      let metadata: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(message.metadata || "{}");
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
          metadata = parsed;
      } catch {}
      await db
        .update(schema.messages)
        .set({ metadata: JSON.stringify({ ...metadata, projectName: name }) })
        .where(eq(schema.messages.id, message.id));
    }
  }
}
let running = false;
let timer: ReturnType<typeof setInterval> | undefined;
export function startProjectNamingWorker() {
  if (timer) return;
  timer = setInterval(() => void processProjectName(), 15000);
  timer.unref();
}
/** One bounded job per tick. Row locks prevent multiple hosts/manual edits racing. */
export async function processProjectName() {
  if (running || !process.env.DATABASE_URL) return;
  running = true;
  try {
    await withDatabaseTransaction(async db => {
      const [plan] = await db
        .select()
        .from(schema.sessionPlans)
        .where(
          and(
            isNull(schema.sessionPlans.projectName),
            lt(schema.sessionPlans.projectNameAttempts, 3),
            or(
              isNull(schema.sessionPlans.projectNameRetryAt),
              lte(schema.sessionPlans.projectNameRetryAt, mysql(new Date()))
            )
          )
        )
        .orderBy(asc(schema.sessionPlans.id))
        .limit(1)
        .for("update", { skipLocked: true });
      if (!plan) return;
      const appointments = await db.query.appointments.findMany({
        where: eq(schema.appointments.sessionPlanId, plan.id),
      });
      const message = plan.messageId
        ? await db.query.messages.findFirst({
            where: eq(schema.messages.id, plan.messageId),
          })
        : null;
      let legacy: unknown;
      try {
        legacy = JSON.parse(message?.metadata || "{}").projectName;
      } catch {}
      let name = savedProjectName(
        plan.projectName,
        appointments.find(a => designProjectName(a.projectName))?.projectName,
        legacy
      );
      if (!name && plan.conversationId) {
        const later = plan.createdAt
          ? await db.query.sessionPlans.findFirst({
              where: and(
                eq(schema.sessionPlans.conversationId, plan.conversationId),
                gt(schema.sessionPlans.createdAt, plan.createdAt)
              ),
              orderBy: [asc(schema.sessionPlans.createdAt)],
            })
          : null;
        name = designProjectName(
          await generateProjectName(
            db,
            plan.conversationId,
            undefined,
            later ? plan.createdAt || undefined : undefined
          )
        );
      }
      if (name) await persistProjectName(db, plan, name);
      else
        await db
          .update(schema.sessionPlans)
          .set({
            projectNameAttempts: plan.projectNameAttempts + 1,
            projectNameRetryAt: mysql(
              new Date(Date.now() + 300000 * (plan.projectNameAttempts + 1))
            ),
          })
          .where(eq(schema.sessionPlans.id, plan.id));
    });
  } catch (error) {
    console.error("[Project naming] Background repair failed", error);
  } finally {
    running = false;
  }
}
