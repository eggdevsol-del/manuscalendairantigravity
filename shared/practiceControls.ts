import {
  PRACTICE_ARTIST,
  PRACTICE_CLIENT,
  PRACTICE_CLIENTS,
  PRACTICE_SETTINGS as defaultSettings,
  PRACTICE_ARTIST_PROFILE as artist,
} from "./practiceFixtures";
export {
  PRACTICE_ARTIST,
  PRACTICE_CLIENT,
  PRACTICE_CLIENTS,
} from "./practiceFixtures";
import {
  BUSINESS_QUERIES,
  BUSINESS_MUTATIONS,
  queryBusinessControl,
  mutateBusinessControl,
} from "./practiceBusinessControls";
import {
  calculateProjectDates,
  parseWorkSchedule,
  validateAppointmentForWorkHours,
} from "./bookingAvailability";
import { PRACTICE_CHAPTERS } from "./practice";
/** Adapter for real artist controls. All operations terminate in the private practice record. */
import { z } from "zod";
import {
  offerRulesSchema,
  audienceSchema,
  quoteOffer,
  offerEligibility,
} from "./offerRules";
import { type PracticeState } from "./practice";
import { PRACTICE_REFERENCE } from "./practiceMedia";
export { PRACTICE_REFERENCE } from "./practiceMedia";
const splitCents = (total: number, count: number, index: number) =>
  Math.floor(total / count) + (index < total % count ? 1 : 0);
export const CONTROL_QUERIES = [
  ...BUSINESS_QUERIES,
  "artistSettings.getStripeConnectStatus",
  "artistSettings.getStripeOnboardingConfig",
  "artistSettings.getPayoutSchedule",
  "auth.me",
  "artistSettings.get",
  "artistSettings.getPublicByArtistId",
  "conversations.getClients",
  "conversations.getById",
  "conversations.list",
  "messages.list",
  "quickActions.list",
  "consultations.list",
  "offers.conversation",
  "offers.list",
  "offers.audience",
  "offers.audienceClients",
  "offers.deliveryActivity",
  "projects.summary",
  "projects.clientWorkspace",
  "booking.checkAvailability",
  "forms.getTemplates",
  "forms.getProcedureLogs",
  "forms.getPendingForms",
  "forms.getByAppointment",
  "sessionPlans.getByConversation",
  "sessionPlans.getById",
  "designBrief.get",
  "designBrief.generate",
  "reschedules.get",
] as const;
export const CONTROL_MUTATIONS = [
  ...BUSINESS_MUTATIONS,
  "conversations.getOrCreate",
  "conversations.createClient",
  "conversations.markAsRead",
  "conversations.pinConsultation",
  "messages.send",
  "messages.markRead",
  "messages.updateMetadata",
  "messages.delete",
  "messages.declineProposal",
  "sessionPlans.create",
  "sessionPlans.decline",
  "artistSettings.connectStripe",
  "artistSettings.submitStripeOnboarding",
  "artistSettings.updatePayoutSchedule",
  "artistSettings.disconnectStripe",
  "artistSettings.upsert",
  "offers.save",
  "offers.archive",
  "offers.issue",
  "offers.declineConversation",
  "clientProfile.addClientNote",
  "projects.rename",
  "projects.nameProject",
  "forms.updateTemplates",
  "appointments.update",
  "appointments.reschedule",
  "appointments.cancelSession",
  "appointments.cancelProjectSessions",
  "dashboard.requestPayment",
  "designBrief.generate",
  "designBrief.regenerate",
] as const;
export function practiceSessions(s: PracticeState) {
  const count = s.booking.dates.length;
  const items = s.sandbox?.plans?.[0]?.items ?? [];
  const preservePrices =
    items.length === count &&
    items.reduce((sum: number, item: any) => sum + item.estimateCents, 0) ===
      s.booking.price;
  const preserveDeposits =
    items.length === count &&
    items.reduce((sum: number, item: any) => sum + item.depositCents, 0) ===
      s.booking.deposit;
  return s.booking.dates.map((date, i) => ({
    id: i + 1,
    artistId: PRACTICE_ARTIST,
    clientId: PRACTICE_CLIENT,
    conversationId: 1,
    sessionPlanId: 1,
    sessionIndex: i + 1,
    sessionTotal: count,
    projectName: s.sandbox?.projectName ?? "Botanical forearm",
    title: s.sandbox?.projectName ?? "Full-day tattoo",
    startsAt:
      s.sandbox?.plans?.[0]?.items?.[i]?.startsAt ?? `${date}T09:00:00+10:00`,
    endsAt:
      s.sandbox?.plans?.[0]?.items?.[i]?.endsAt ?? `${date}T17:00:00+10:00`,
    startTime:
      s.sandbox?.plans?.[0]?.items?.[i]?.startsAt ?? `${date}T09:00:00+10:00`,
    endTime:
      s.sandbox?.plans?.[0]?.items?.[i]?.endsAt ?? `${date}T17:00:00+10:00`,
    timeZone: "Australia/Brisbane",
    status: [
      "arrived",
      "in progress",
      "awaiting final payment",
      "change awaiting client approval",
    ].includes(s.booking.status)
      ? "confirmed"
      : s.booking.status === "completed"
        ? "completed"
        : s.booking.status === "cancelled" || s.booking.status === "declined"
          ? "cancelled"
          : "confirmed",
    estimateCents: preservePrices
      ? items[i].estimateCents
      : splitCents(s.booking.price, count, i),
    expectedCents: preservePrices
      ? items[i].estimateCents
      : splitCents(s.booking.price, count, i),
    paidCents: splitCents(s.booking.paid, count, i),
    remainingCents:
      (preservePrices
        ? items[i].estimateCents
        : splitCents(s.booking.price, count, i)) -
      splitCents(s.booking.paid, count, i),
    depositCents: preserveDeposits
      ? items[i].depositCents
      : splitCents(s.booking.deposit, count, i),
    durationMinutes: s.sandbox?.plans?.[0]?.items?.[i]?.durationMinutes ?? 480,
    formsStatus: s.booking.forms,
    pendingRequest:
      s.booking.status === "awaiting final payment"
        ? {
            id: 1,
            amountCents: s.booking.price - s.booking.paid,
            expiresAt: null,
          }
        : null,
  }));
}
const conversation = (s: PracticeState) => ({
  id: 1,
  artistId: PRACTICE_ARTIST,
  clientId: PRACTICE_CLIENT,
  otherUser: { ...PRACTICE_CLIENTS[0], name: s.client.name },
  artist,
  client: PRACTICE_CLIENTS[0],
  unreadCount: 1,
  lastMessage: null,
  pinnedConsultationId: null,
});
const encodeMetadata = (value: unknown) =>
  value == null
    ? null
    : typeof value === "string"
      ? value
      : JSON.stringify(value);
const messages = (s: PracticeState) =>
  s.messages.map((m, i) => ({
    id: i + 1,
    conversationId: 1,
    senderId: m.from === "Artist" ? PRACTICE_ARTIST : PRACTICE_CLIENT,
    content:
      s.client.reference && /reference|fixture/i.test(m.text)
        ? PRACTICE_REFERENCE
        : m.text,
    messageType:
      s.sandbox?.messageDetails?.[i]?.messageType ??
      (s.client.reference && /reference|fixture/i.test(m.text)
        ? "image"
        : "text"),
    createdAt: new Date(
      Date.now() - (s.messages.length - i) * 60000
    ).toISOString(),
    metadata: encodeMetadata(
      s.sandbox?.messageDetails?.[i]?.metadata ??
        (s.client.reference && /reference|fixture/i.test(m.text)
          ? { imageUrl: PRACTICE_REFERENCE }
          : null)
    ),
    readBy: JSON.stringify([PRACTICE_CLIENT, PRACTICE_ARTIST]),
    sender: m.from === "Artist" ? artist : PRACTICE_CLIENTS[0],
  }));
const people = (s: PracticeState) =>
  (s.sandbox?.clients ?? PRACTICE_CLIENTS).map((p: any) =>
    p.id === PRACTICE_CLIENT
      ? {
          ...p,
          name: s.client.name,
          city: s.client.city,
          ...s.sandbox?.clientProfile,
        }
      : p
  );
const audience = (s: PracticeState, raw: unknown) => {
  const f = audienceSchema.parse(raw ?? {});
  return people(s).filter(
    (c: any) =>
      (!f.clientIds || f.clientIds.includes(c.id)) &&
      (!f.clientId || f.clientId === c.id) &&
      c.lifetimePaid >= f.minSpendCents &&
      c.bookings >= f.minBookings &&
      c.inactiveDays >= f.inactiveDays &&
      (!f.city || c.city === f.city) &&
      (!f.birthdayMonth || c.birthdayMonth === f.birthdayMonth)
  );
};
export function queryPracticeControl(
  s: PracticeState,
  path: string,
  input: any
): any {
  if (!CONTROL_QUERIES.includes(path as any))
    throw new Error(
      `This control is not connected to practice: ${path}. No live request was made.`
    );
  const box = s.sandbox ?? {};
  if (BUSINESS_QUERIES.includes(path as any))
    return queryBusinessControl(s, path, input, {
      artist: { ...artist, ...box.artist },
      clients: people(s),
      sessions: practiceSessions(s),
      messages: messages(s),
      settings: { ...defaultSettings, ...box.settings },
    });
  switch (path) {
    case "artistSettings.getStripeConnectStatus":
      return {
        connected: !!box.bankConnected,
        accountType: "custom",
        statusAvailable: true,
        pendingVerification: !!box.bankConnected && !box.bankVerified,
        chargesEnabled: !!box.bankVerified,
        payoutsEnabled: !!box.bankVerified,
      };
    case "artistSettings.getStripeOnboardingConfig":
      return { publishableKey: null };
    case "artistSettings.getPayoutSchedule":
      return {
        interval: "daily",
        weeklyAnchor: "monday",
        monthlyAnchor: 1,
        delayDays: 2,
        availableBalance: s.booking.paid,
        pendingBalance: 0,
        currency: "aud",
        bankLast4: "0000",
        bankName: "Mock bank",
        ...box.payoutSchedule,
      };
    case "auth.me":
      return { ...artist, ...box.artist };
    case "artistSettings.get":
    case "artistSettings.getPublicByArtistId":
      return { ...defaultSettings, ...box.settings };
    case "conversations.getClients":
      return people(s);
    case "conversations.getById":
      return conversation(s);
    case "conversations.list":
      return [conversation(s)];
    case "messages.list":
      return messages(s);
    case "quickActions.list":
      return box.quickActions ?? [];
    case "consultations.list":
      return (
        box.consultations ?? [
          {
            id: 1,
            clientName: s.client.name,
            clientId: PRACTICE_CLIENT,
            status: "pending",
            conversationId: 1,
            projectDescription: s.client.brief,
          },
        ]
      );
    case "offers.list":
      return { enabled: true, campaigns: box.campaigns ?? [] };
    case "offers.audienceClients":
      return people(s);
    case "offers.audience": {
      const list = audience(s, input);
      return {
        count: list.length,
        pushCount: list.length,
        smsCount: list.length,
        pushAvailable: true,
        smsAvailable: true,
      };
    }
    case "offers.deliveryActivity":
      return [];
    case "offers.conversation":
      return { enabled: true, offers: box.issued ?? [] };
    case "projects.summary":
      return {
        conversationId: 1,
        artist,
        client: { ...PRACTICE_CLIENTS[0], name: s.client.name },
        location: "Practice studio",
        sessions: ["proposal sent", "declined", "draft"].includes(
          s.booking.status
        )
          ? []
          : practiceSessions(s),
        plans: box.plans ?? [],
        payments: s.booking.paid
          ? [
              {
                id: 1,
                appointmentId: 1,
                amountCents: s.booking.paid,
                type: "deposit",
                method: "simulated",
                createdAt: new Date().toISOString(),
              },
            ]
          : [],
        forms:
          s.booking.forms === "signed"
            ? [
                {
                  id: 1,
                  appointmentId: 1,
                  status: "signed",
                  formType: "medical",
                  content: "Fictional signed medical form",
                },
              ]
            : [],
        briefs: [{ id: 1, content: s.client.brief }],
        media: s.client.reference
          ? [{ id: 1, url: PRACTICE_REFERENCE, messageId: 1, type: "image" }]
          : [],
        references: s.client.reference
          ? [{ id: 1, url: PRACTICE_REFERENCE, messageId: 1, type: "image" }]
          : [],
        reschedules: [],
        messages: messages(s),
      };
    case "projects.clientWorkspace":
      return {
        client: PRACTICE_CLIENTS[0],
        conversationId: 1,
        sessions: practiceSessions(s),
        notes: box.notes ?? [],
        forms: [],
      };
    case "forms.getTemplates":
      return (
        box.templates ?? {
          medicalTemplate: "Practice medical form. All details are fictional.",
          consentTemplate: "Practice consent form. This has no legal effect.",
        }
      );
    case "forms.getProcedureLogs":
      return [
        {
          id: 1,
          appointmentId: 1,
          clientName: "Alex Taylor",
          artistLicenceNumber: "DEMO",
          date: s.booking.dates[0],
          amountPaid: s.booking.paid,
          paymentMethod: "Simulated card",
          procedureDetails:
            s.booking.procedure || "Fictional botanical forearm procedure",
        },
      ];
    case "forms.getPendingForms":
    case "forms.getByAppointment":
      return s.booking.forms === "not issued"
        ? []
        : [
            {
              id: 1,
              appointmentId: 1,
              clientId: PRACTICE_CLIENT,
              formType: "medical_release",
              content:
                box.templates?.medicalTemplate ?? "Fictional medical release",
              status: s.booking.forms,
              signature: s.booking.forms === "signed" ? "Mock signature" : null,
            },
          ];
    case "sessionPlans.getByConversation":
      return (box.plans ?? []).map((plan: any) => ({
        ...plan,
        totalEstimateCents: s.booking.price,
        depositTotalCents: s.booking.deposit,
        status:
          s.booking.status === "proposal sent"
            ? "pending"
            : s.booking.status === "cancelled"
              ? "cancelled"
              : "accepted",
      }));
    case "sessionPlans.getById":
      return box.plans?.[0]
        ? {
            ...box.plans[0],
            totalEstimateCents: s.booking.price,
            depositTotalCents: s.booking.deposit,
            status:
              s.booking.status === "proposal sent"
                ? "pending"
                : s.booking.status === "cancelled"
                  ? "cancelled"
                  : "accepted",
          }
        : null;
    case "designBrief.get":
    case "designBrief.generate":
      return {
        brief:
          s.client.brief ||
          "Fictional black-and-grey botanical forearm design.",
        references: [],
      };
    case "reschedules.get":
      return {
        id: 1,
        status: "pending",
        oldStart: s.booking.dates[0],
        newStart: s.booking.proposedDate,
      };
    case "booking.checkAvailability": {
      const v = z
        .object({
          startDate: z.coerce.date(),
          serviceDuration: z.number().int().min(1).max(480),
          sittings: z.number().int().min(1).max(52),
          frequency: z.enum([
            "single",
            "weekly",
            "biweekly",
            "monthly",
            "consecutive",
          ]),
          completedBy: z.coerce.date().optional(),
        })
        .parse(input);
      const schedule = parseWorkSchedule(
        box.settings?.workSchedule ?? defaultSettings.workSchedule
      );
      const rules = box.issued?.find((o: any) => o.id === input.offerId)?.rules;
      const dates = calculateProjectDates({
        serviceDuration: v.serviceDuration,
        sittings: v.sittings,
        frequency: v.frequency,
        startDate: v.startDate,
        completedBy: v.completedBy,
        sittingMonths: rules?.sittingMonths,
        workSchedule: schedule,
        existingAppointments: practiceSessions(s).map(a => ({
          startTime: new Date(a.startsAt),
          endTime: new Date(a.endsAt),
        })),
        timeZone: input.timeZone ?? "Australia/Brisbane",
      });
      return { dates: dates.map(d => d.toISOString()) };
    }
  }
}
export function mutatePracticeControl(
  original: PracticeState,
  path: string,
  raw: any
): { state: PracticeState; data: any } {
  if (!CONTROL_MUTATIONS.includes(path as any))
    throw new Error(
      `This action is not connected to practice: ${path}. No live request was made.`
    );
  if (
    [
      "conversations.markAsRead",
      "messages.markRead",
      "conversations.pinConsultation",
    ].includes(path)
  )
    return { state: original, data: { success: true } };
  const s = structuredClone(original);
  s.sandbox ??= {};
  const b = s.sandbox;
  let data: any = { success: true };
  switch (path) {
    default:
      data = mutateBusinessControl(s, path, raw, {
        artist: { ...artist, ...b.artist },
        clients: people(s),
        sessions: practiceSessions(s),
        messages: messages(s),
        settings: { ...defaultSettings, ...b.settings },
      });
      break;
    case "artistSettings.connectStripe":
      b.bankConnected = true;
      data = { accountType: "custom" };
      break;
    case "artistSettings.submitStripeOnboarding":
      b.bankVerified = true;
      break;
    case "artistSettings.disconnectStripe":
      b.bankConnected = false;
      b.bankVerified = false;
      break;
    case "artistSettings.updatePayoutSchedule":
      b.payoutSchedule = z
        .object({
          interval: z.enum(["daily", "weekly", "monthly", "manual"]),
          weeklyAnchor: z.string().optional(),
          monthlyAnchor: z.number().int().min(1).max(31).optional(),
        })
        .parse(raw);
      break;
    case "artistSettings.upsert":
      b.settings = { ...b.settings, ...raw };
      break;
    case "conversations.getOrCreate":
      data = conversation(s);
      break;
    case "conversations.createClient": {
      const v = z
        .object({
          name: z.string().min(1),
          email: z.string().email(),
          phone: z.string().optional(),
        })
        .parse(raw);
      const client = {
        ...PRACTICE_CLIENTS[0],
        ...v,
        id: `practice-client-${people(s).length}`,
      };
      b.clients = [...people(s), client];
      data = client;
      break;
    }
    case "messages.send": {
      const v = z
        .object({ content: z.string().trim().min(1).max(4000) })
        .parse(raw);
      s.messages.push({ from: "Artist", text: v.content });
      b.messageDetails ??= {};
      b.messageDetails[s.messages.length - 1] = {
        messageType: raw.messageType ?? "text",
        metadata:
          raw.messageType === "image"
            ? { imageUrl: PRACTICE_REFERENCE }
            : (raw.metadata ?? null),
      };
      if (raw.messageType === "image") s.client.reference = true;
      data = messages(s).at(-1);
      s.notifications.push(
        "Push preview · Artist sent a practice message. No notification sent."
      );
      break;
    }
    case "messages.delete":
      s.messages = s.messages.filter((_, i) => i + 1 !== raw.messageId);
      break;
    case "messages.updateMetadata":
      b.metadata = raw.metadata;
      break;
    case "messages.declineProposal":
    case "sessionPlans.decline":
      s.booking.status = "declined";
      break;
    case "sessionPlans.create": {
      const v = z
        .object({
          serviceName: z.string().min(1),
          sessions: z
            .array(
              z.object({
                startsAt: z.string().datetime(),
                durationMinutes: z.number().int().min(1).max(480),
                estimateCents: z.number().int().nonnegative(),
                depositCents: z.number().int().nonnegative(),
              })
            )
            .min(1)
            .max(52),
        })
        .parse(raw);
      for (let i = 0; i < v.sessions.length; i++) {
        const a = v.sessions[i];
        const hours = validateAppointmentForWorkHours(
          new Date(a.startsAt),
          a.durationMinutes,
          parseWorkSchedule(
            b.settings?.workSchedule ?? defaultSettings.workSchedule
          ),
          "Australia/Brisbane"
        );
        if (!hours.valid) throw new Error(hours.reason);
        if (a.depositCents > a.estimateCents)
          throw new Error("Deposit cannot exceed estimate.");
        if (+new Date(a.startsAt) <= Date.now())
          throw new Error("Choose future dates.");
        if (
          v.sessions.some(
            (other, j) =>
              j !== i &&
              +new Date(other.startsAt) <
                +new Date(a.startsAt) + a.durationMinutes * 60000 &&
              +new Date(other.startsAt) + other.durationMinutes * 60000 >
                +new Date(a.startsAt)
          )
        )
          throw new Error("Sittings overlap.");
      }
      s.booking.dates = v.sessions.map(a =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: "Australia/Brisbane",
        }).format(new Date(a.startsAt))
      );
      s.booking.price = v.sessions.reduce((sum, a) => sum + a.estimateCents, 0);
      s.booking.deposit = v.sessions.reduce(
        (sum, a) => sum + a.depositCents,
        0
      );
      s.booking.paid = 0;
      s.booking.status = "proposal sent";
      b.originalPrices = v.sessions.map(a => a.estimateCents);
      b.originalDeposits = v.sessions.map(a => a.depositCents);
      const offer = b.issued?.find((o: any) => o.id === raw.offerId);
      if (offer) {
        const reason = offerEligibility(
          offer.rules,
          offer.issuedAt,
          new Date().toISOString(),
          v.sessions.map(a => a.startsAt),
          Date.now(),
          "Australia/Brisbane"
        );
        if (reason) throw new Error(reason);
        const q = quoteOffer(
          offer.rules,
          offer.remainingValue,
          v.sessions.map((a, i) => ({ ...a, id: i + 1, sessionIndex: i + 1 }))
        );
        s.booking.price = q.items.reduce((sum, a) => sum + a.estimateCents, 0);
        s.booking.deposit = q.items.reduce((sum, a) => sum + a.depositCents, 0);
        v.sessions = v.sessions.map((a, i) => ({ ...a, ...q.items[i] }));
      }
      const plan = {
        id: 1,
        artist,
        client: PRACTICE_CLIENTS[0],
        conversationId: 1,
        projectName: v.serviceName,
        status: "pending",
        totalEstimateCents: s.booking.price,
        depositTotalCents: s.booking.deposit,
        items: v.sessions.map((a, i) => ({
          ...a,
          endsAt: new Date(
            +new Date(a.startsAt) + a.durationMinutes * 60000
          ).toISOString(),
          id: i + 1,
          sessionIndex: i + 1,
        })),
        requiresDeposit: true,
      };
      b.projectName = v.serviceName;
      b.plans = [plan];
      b.messageDetails ??= {};
      b.messageDetails[s.messages.length] = {
        messageType: "session_plan",
        metadata: { sessionPlanId: 1 },
      };
      s.messages.push({
        from: "Artist",
        text: `Practice proposal sent: ${v.sessions.length} sittings · $${s.booking.price / 100}`,
      });
      data = { sessionPlanId: 1, messageId: s.messages.length };
      break;
    }
    case "offers.save": {
      const rules = offerRulesSchema.parse(raw.rules);
      const campaign = { id: raw.id ?? (b.campaigns?.length ?? 0) + 1, rules };
      b.campaigns = [
        ...(b.campaigns ?? []).filter((c: any) => c.id !== campaign.id),
        campaign,
      ];
      data = campaign;
      break;
    }
    case "offers.archive":
      b.campaigns = (b.campaigns ?? []).filter((c: any) => c.id !== raw.id);
      break;
    case "offers.issue": {
      const c = b.campaigns?.find((c: any) => c.id === raw.id);
      if (!c) throw new Error("Create the practice campaign first.");
      const list = audience(s, raw.filters);
      if (list.length !== raw.expectedCount)
        throw new Error("Audience changed. Review recipients again.");
      b.issued = list.map((person: any, i: number) => ({
        id: i + 1,
        rules: c.rules,
        remainingValue: c.rules.value,
        issuedAt: new Date().toISOString(),
        status: "available",
        clientId: person.id,
        purchaseRequired: c.rules.funding === "sale",
      }));
      s.notifications.push(
        `Preview only · ${list.length} offers issued · Push ${!!raw.channels?.push} · SMS ${!!raw.channels?.sms}`
      );
      data = { issued: list.length, skipped: 0 };
      break;
    }
    case "offers.declineConversation":
      b.issued = [];
      break;
    case "clientProfile.addClientNote":
      b.notes = [
        ...(b.notes ?? []),
        {
          id: (b.notes?.length ?? 0) + 1,
          note: raw.note ?? raw.content,
          createdAt: new Date().toISOString(),
        },
      ];
      break;
    case "projects.rename":
    case "projects.nameProject":
      b.projectName = raw.name;
      data = { projectName: raw.name };
      break;
    case "forms.updateTemplates":
      b.templates = { ...b.templates, ...raw };
      break;
    case "appointments.update":
      if (raw.status) s.booking.status = raw.status;
      if (raw.clientArrived) s.booking.status = "arrived";
      break;
    case "appointments.cancelSession":
    case "appointments.cancelProjectSessions":
      s.booking.status = "cancelled";
      break;
    case "dashboard.requestPayment":
      s.booking.status = "awaiting final payment";
      data = { id: 1, success: true };
      break;
    case "appointments.reschedule": {
      const start = z.coerce.date().parse(raw.newStartTime);
      if (start <= new Date()) throw new Error("Choose a future time.");
      const sessions = practiceSessions(s);
      const selected = sessions.find(
        a => a.id === (raw.appointmentId ?? raw.id)
      );
      if (!selected) throw new Error("Practice sitting not found.");
      const hours = validateAppointmentForWorkHours(
        start,
        selected.durationMinutes,
        parseWorkSchedule(
          b.settings?.workSchedule ?? defaultSettings.workSchedule
        ),
        "Australia/Brisbane"
      );
      if (!hours.valid) throw new Error(hours.reason);
      const end = +start + selected.durationMinutes * 60000;
      if (
        sessions.some(
          a =>
            a.id !== selected.id &&
            +new Date(a.startsAt) < end &&
            +new Date(a.endsAt) > +start
        )
      )
        throw new Error("That slot is already booked.");
      b.rescheduleIndex = selected.sessionIndex - 1;
      b.rescheduleStart = start.toISOString();
      const repriced =
        s.booking.price -
        selected.estimateCents +
        (b.originalPrices?.[selected.sessionIndex - 1] ??
          Math.round(selected.estimateCents / 0.8));
      s.booking.proposedDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Australia/Brisbane",
      }).format(start);
      const promo = b.issued?.[0];
      if (
        promo &&
        offerEligibility(
          promo.rules,
          promo.issuedAt,
          new Date().toISOString(),
          [start.toISOString()],
          Date.now(),
          "Australia/Brisbane"
        ) &&
        !raw.allowOutsideOfferDates
      ) {
        if (!raw.requestApproval) {
          data = {
            requiresApproval: true,
            terms: {
              oldEstimateCents: s.booking.price,
              estimateCents: repriced,
              paidCents: s.booking.paid,
              remainingCents: repriced - s.booking.paid,
            },
          };
          break;
        }
        s.booking.proposedPrice = repriced;
      }
      s.booking.status = "change awaiting client approval";
      data = { requiresApproval: false, requestId: 1 };
      break;
    }
    case "designBrief.generate":
    case "designBrief.regenerate":
      s.client.brief =
        "Practice brief: black-and-grey botanical forearm design, reference discussed in Messages.";
      data = { brief: s.client.brief };
      break;
  }
  const chapter = PRACTICE_CHAPTERS.find(c => c.id === s.chapterId);
  const current = chapter?.steps[s.cursor];
  if (path === "sessionPlans.create" && chapter) {
    const accept = chapter.steps.findIndex(step => step.id === "accept");
    if (accept >= 0) s.cursor = accept;
  } else if (path === "messages.send" && current?.id === "message") s.cursor++;
  else if (path === "offers.save" && current?.id === "create") s.cursor++;
  else if (
    path === "offers.issue" &&
    ["send", "recipient"].includes(current?.id ?? "")
  )
    s.cursor++;
  else if (
    path === "dashboard.requestPayment" &&
    ["finish", "balance-request"].includes(current?.id ?? "")
  )
    s.cursor++;
  else if (
    path === "appointments.reschedule" &&
    current?.id === "date" &&
    !data.requiresApproval
  )
    s.cursor++;
  if (
    chapter &&
    s.cursor >= chapter.steps.length &&
    !s.completed.includes(chapter.id)
  )
    s.completed.push(chapter.id);
  if (
    !path.startsWith("practice.recordAction") &&
    !path.startsWith("practice.saveCart")
  )
    s.checkpoints = [
      ...(original.checkpoints ?? []),
      { ...structuredClone(original), checkpoints: [] },
    ].slice(-30);
  b.lastAction = path;
  b.actions = [...(b.actions ?? []), path].slice(-200);
  s.revision++;
  return { state: s, data };
}
