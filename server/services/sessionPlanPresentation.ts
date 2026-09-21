import { isDesignProjectName } from "../../shared/projectNames";
import { inArray } from "drizzle-orm";
import * as schema from "../../drizzle/schema";

type Plan = {
  message?: { metadata: string | null } | null;
  id: number;
  artistId: string;
  clientId: string;
  status: string;
  stripeSessionId?: string | null;
  depositTotalCents: number;
  totalEstimateCents: number;
  items?: {
    startsAt: string;
    durationMinutes: number;
    estimateCents: number;
    depositCents: number;
  }[];
};
type Evidence = {
  sessionPlanId: number | null;
  depositPaid: number | null;
  paymentStatus: string | null;
};
export const sessionPlanSignature = (p: Plan) =>
  p.items?.length
    ? JSON.stringify([
        p.artistId,
        p.clientId,
        p.depositTotalCents,
        p.totalEstimateCents,
        p.items
          .map(i => [
            i.startsAt.replace("T", " ").replace(/\.\d{3}Z$|Z$/g, ""),
            i.durationMinutes,
            i.estimateCents,
            i.depositCents,
          ])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ])
    : `plan:${p.id}`;
/** Exact schedule/payment identities only: never collapse different tattoos by client or amount. */
export function presentSessionPlans<T extends Plan>(
  plans: T[],
  evidence: Evidence[]
) {
  const paid = new Set(
    evidence
      .filter(
        a =>
          a.depositPaid === 1 ||
          ["deposit_paid", "fully_paid"].includes(a.paymentStatus || "")
      )
      .map(a => a.sessionPlanId)
  );
  const signature = sessionPlanSignature;
  const settled = plans.filter(p => p.status === "accepted" || paid.has(p.id));
  const seen = new Set<string>();
  return [...plans]
    .sort(
      (a, b) =>
        Number(!!b.stripeSessionId) - Number(!!a.stripeSessionId) || b.id - a.id
    )
    .map(p => {
      const recorded = paid.has(p.id);
      const duplicatePaid = settled.some(
        other =>
          other.id !== p.id &&
          ((!!p.stripeSessionId &&
            p.stripeSessionId === other.stripeSessionId) ||
            signature(p) === signature(other))
      );
      const key = p.stripeSessionId
        ? `payment:${p.stripeSessionId}`
        : signature(p);
      const duplicate =
        p.status === "pending" && (seen.has(key) || seen.has(signature(p)));
      if (p.status === "pending") {
        seen.add(key);
        seen.add(signature(p));
      }
      let projectName: string | null = null;
      try {
        const meta = JSON.parse(p.message?.metadata || "{}");
        if (isDesignProjectName(meta.projectName))
          projectName = meta.projectName;
      } catch {}
      return {
        ...p,
        projectName,
        depositRecorded: recorded || p.status === "accepted" || duplicatePaid,
        requiresDeposit:
          p.status === "pending" && !recorded && !duplicatePaid && !duplicate,
      };
    });
}
const paymentCache = new Map<string, { until: number; state: string }>();
async function paymentState(id: string) {
  const cached = paymentCache.get(id);
  if (cached && cached.until > Date.now()) return cached.state;
  try {
    const { stripe } = await import("./stripe");
    const payment = await stripe.paymentIntents.retrieve(
      id,
      {},
      { timeout: 5000, maxNetworkRetries: 0 }
    );
    if (paymentCache.size >= 512)
      paymentCache.delete(paymentCache.keys().next().value!);
    paymentCache.set(id, { until: Date.now() + 15000, state: payment.status });
    return payment.status;
  } catch {
    return "unverified";
  }
}
export async function readPresentedPlans<T extends Plan>(db: any, plans: T[]) {
  if (!plans.length) return [];
  const evidence = await db
    .select({
      sessionPlanId: schema.appointments.sessionPlanId,
      depositPaid: schema.appointments.depositPaid,
      paymentStatus: schema.appointments.paymentStatus,
    })
    .from(schema.appointments)
    .where(
      inArray(
        schema.appointments.sessionPlanId,
        plans.map(p => p.id)
      )
    );
  const presented = presentSessionPlans(plans, evidence);
  const result = [];
  // Only pending, otherwise-payable intents need provider verification; accepted plans use database evidence.
  for (const plan of presented) {
    const state =
      plan.requiresDeposit && plan.stripeSessionId
        ? await paymentState(plan.stripeSessionId)
        : null;
    const paymentPending =
      state === "succeeded" || state === "processing" || state === "unverified";
    result.push({
      ...plan,
      paymentState: paymentPending ? state : null,
      requiresDeposit: plan.requiresDeposit && !paymentPending,
    });
  }
  return result;
}
