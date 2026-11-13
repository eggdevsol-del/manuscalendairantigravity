import { formatInTimeZone } from "date-fns-tz";
import { parseTime } from "./bookingAvailability";

/** Why one sitting falls outside the artist's business hours. Plain JSON so it can travel in an error. */
export interface OutsideHoursIssue {
  /** Confirmation token: covers exactly this start and end, nothing else. */
  key: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  /** Local weekday the sitting starts on, e.g. "Sunday". */
  day: string;
  reason: "closed" | "hours" | "break";
  /** For a closed day: a day off, or a day set aside for design or personal time. */
  dayType: "off" | "design" | "personal" | null;
  minutesBefore: number;
  minutesAfter: number;
  /** Local minutes from midnight; null on a closed day. */
  opensAt: number | null;
  closesAt: number | null;
  breakStart: number | null;
  breakEnd: number | null;
  /** The sitting runs past local midnight of the day it starts on. */
  pastMidnight: boolean;
  sessionIndex?: number;
}

export interface HoursSitting {
  start: Date | string;
  end: Date | string;
  sessionIndex?: number;
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

interface Day {
  enabled: boolean;
  type: string;
  open: number | null;
  close: number | null;
  breaks: { start: number; end: number }[];
}

const minutes = (value: unknown) => {
  const parsed = typeof value === "string" ? parseTime(value) : null;
  return parsed ? parsed.hour * 60 + parsed.minute : null;
};

/** Reads every stored shape: keyed object or array, start/end or startTime/endTime, full or short day names. */
function readDays(workSchedule: unknown): Map<string, Day> {
  const days = new Map<string, Day>();
  let raw = workSchedule;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return days;
    }
  }
  if (!raw || typeof raw !== "object") return days;
  const entries: [string, any][] = Array.isArray(raw)
    ? raw.map(item => ["", item])
    : Object.entries(raw);
  for (const [key, value] of entries) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const name = String(typeof value.day === "string" ? value.day : key)
      .trim()
      .toLowerCase();
    const weekday = WEEKDAYS.find(
      w => w === name || (name.length >= 3 && w.startsWith(name))
    );
    if (!weekday) continue;
    days.set(weekday, {
      // Truthiness and a blank type meaning "work" match the calendar and slot finder.
      enabled: !!value.enabled && value.enabled !== "false",
      type:
        typeof value.type === "string" && value.type.trim()
          ? value.type.trim().toLowerCase()
          : "work",
      open: minutes(value.start || value.startTime),
      close: minutes(value.end || value.endTime),
      breaks: (Array.isArray(value.breaks) ? value.breaks : []).flatMap(
        (pause: any) => {
          const start = minutes(pause?.start || pause?.startTime),
            end = minutes(pause?.end || pause?.endTime);
          return start !== null && end !== null && end > start
            ? [{ start, end }]
            : [];
        }
      ),
    });
  }
  return days;
}

const working = (day?: Day): day is Day & { open: number; close: number } =>
  !!day &&
  day.enabled &&
  day.type === "work" &&
  day.open !== null &&
  day.close !== null &&
  day.open !== day.close;

/** Closing in minutes from the day's own midnight; hours such as 18:00–02:00 close the next morning. */
const closing = (day: { open: number; close: number }) =>
  day.close > day.open ? day.close : day.close + 1440;

const instant = (value: Date | string) =>
  value instanceof Date ? value : new Date(value);

export function outsideHoursKey(start: Date | string, end: Date | string) {
  return `${instant(start).toISOString()}/${instant(end).toISOString()}`;
}

/**
 * Says whether a sitting falls outside business hours, and how. Returns null when it is inside, and also
 * when the schedule is missing or unreadable: hours that were never set up cannot be broken, so they
 * never ask for a confirmation. A schedule that closes every day was set up, and always asks.
 */
export function checkBusinessHours(
  workSchedule: unknown,
  timeZone: string,
  start: Date | string,
  end: Date | string
): OutsideHoursIssue | null {
  const from = instant(start),
    to = instant(end);
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || +to <= +from)
    return null;
  const days = readDays(workSchedule);
  // An open day with unreadable hours says nothing; a readable or deliberately closed day does.
  if (
    ![...days.values()].some(
      day => working(day) || !day.enabled || day.type !== "work"
    )
  )
    return null;
  let dayName: string, startsAt: number, endsAt: number;
  try {
    dayName = formatInTimeZone(from, timeZone, "EEEE");
    const [fromDate, fromClock] = formatInTimeZone(
      from,
      timeZone,
      "yyyy-MM-dd HH:mm"
    ).split(" ");
    const [toDate, toClock] = formatInTimeZone(
      to,
      timeZone,
      "yyyy-MM-dd HH:mm:ss"
    ).split(" ");
    const wall = (value: string) =>
      Number(value.slice(0, 2)) * 60 +
      Number(value.slice(3, 5)) +
      Number(value.slice(6, 8) || 0) / 60;
    startsAt = wall(fromClock);
    // Hours are wall-clock times, so the end is read from the clock too: elapsed minutes would be an
    // hour out for a sitting that crosses a daylight-saving change.
    endsAt = Math.max(
      startsAt + 1 / 60,
      wall(toClock) +
        Math.round((Date.parse(toDate) - Date.parse(fromDate)) / 86400000) *
          1440
    );
  } catch {
    return null;
  }
  const index = WEEKDAYS.indexOf(dayName.toLowerCase());
  const day = days.get(WEEKDAYS[index]);
  const issue = (
    part: Partial<OutsideHoursIssue> & Pick<OutsideHoursIssue, "reason">
  ): OutsideHoursIssue => ({
    key: outsideHoursKey(from, to),
    startsAt: from.toISOString(),
    endsAt: to.toISOString(),
    timeZone,
    day: dayName,
    dayType: null,
    minutesBefore: 0,
    minutesAfter: 0,
    opensAt: null,
    closesAt: null,
    breakStart: null,
    breakEnd: null,
    pastMidnight: false,
    ...part,
  });

  // Early-morning sittings can belong to the previous day's hours when those run past midnight.
  const previous = days.get(WEEKDAYS[(index + 6) % 7]);
  if (
    working(previous) &&
    previous.close < previous.open &&
    startsAt < previous.close
  ) {
    const pause = previous.breaks.find(
      b => b.start < endsAt + 1440 && b.end > startsAt + 1440
    );
    if (pause)
      return issue({
        reason: "break",
        opensAt: previous.open,
        closesAt: previous.close,
        breakStart: pause.start % 1440,
        breakEnd: pause.end % 1440,
      });
    if (endsAt <= previous.close) return null;
    // Today's own hours may pick up where last night's stopped; otherwise it overran last night's close.
    if (!working(day) || day.open > previous.close)
      return issue({
        reason: "hours",
        minutesAfter: endsAt - previous.close,
        opensAt: previous.open,
        closesAt: previous.close,
      });
  }

  if (!day || !day.enabled) return issue({ reason: "closed", dayType: "off" });
  if (day.type !== "work")
    return issue({
      reason: "closed",
      dayType:
        day.type === "design" || day.type === "personal" ? day.type : "off",
    });
  // An open day whose hours cannot be read gives nothing to measure against.
  if (!working(day)) return null;
  const close = closing(day);
  const minutesBefore = Math.max(0, day.open - startsAt);
  const minutesAfter = Math.max(0, endsAt - close);
  if (minutesBefore || minutesAfter)
    return issue({
      reason: "hours",
      minutesBefore,
      minutesAfter,
      opensAt: day.open,
      closesAt: close % 1440,
      pastMidnight: minutesAfter > 0 && endsAt > 1440,
    });
  const pause = day.breaks.find(b => b.start < endsAt && b.end > startsAt);
  if (pause)
    return issue({
      reason: "break",
      opensAt: day.open,
      closesAt: close % 1440,
      breakStart: pause.start,
      breakEnd: pause.end,
    });
  return null;
}

/** Sittings that are outside hours and not covered by a confirmation for that exact start and end. */
export function unconfirmedOutsideHours(
  workSchedule: unknown,
  timeZone: string,
  sittings: HoursSitting[],
  confirmed: readonly string[] = []
): OutsideHoursIssue[] {
  return sittings.flatMap(sitting => {
    const found = checkBusinessHours(
      workSchedule,
      timeZone,
      sitting.start,
      sitting.end
    );
    if (!found || confirmed.includes(found.key)) return [];
    return [
      sitting.sessionIndex === undefined
        ? found
        : { ...found, sessionIndex: sitting.sessionIndex },
    ];
  });
}

const clock = (value: number) => {
  const hour = Math.floor(value / 60) % 24,
    minute = Math.round(value % 60);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "am" : "pm"}`;
};

export const hoursSpan = (value: number) => {
  const total = Math.max(1, Math.round(value)),
    h = Math.floor(total / 60),
    m = total % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ");
};

/** The reason in plain words, e.g. "Ends 1 h 30 min after you close at 5:30 pm". */
export function describeOutsideHours(issue: OutsideHoursIssue): string {
  if (issue.reason === "closed")
    return issue.dayType === "design"
      ? `${issue.day} is a design day, not a tattooing day`
      : issue.dayType === "personal"
        ? `${issue.day} is a personal day, not a tattooing day`
        : `You’re closed on ${issue.day}s`;
  if (issue.reason === "break")
    return `Overlaps your break from ${clock(issue.breakStart ?? 0)} to ${clock(issue.breakEnd ?? 0)}`;
  const before =
    issue.minutesBefore > 0 &&
    `starts ${hoursSpan(issue.minutesBefore)} before you open at ${clock(issue.opensAt ?? 0)}`;
  const after =
    issue.minutesAfter > 0 &&
    `ends ${hoursSpan(issue.minutesAfter)} after you close at ${clock(issue.closesAt ?? 0)}${issue.pastMidnight ? ", running past midnight" : ""}`;
  const text = [before, after].filter(Boolean).join(" and ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** When the sitting is, in the zone its hours were judged in, e.g. "Sun 14 Mar, 10:00 am – 1:00 pm". */
export function outsideHoursWhen(issue: OutsideHoursIssue): string {
  const time = (value: string) =>
    formatInTimeZone(new Date(value), issue.timeZone, "h:mm a").toLowerCase();
  return `${formatInTimeZone(new Date(issue.startsAt), issue.timeZone, "EEE d MMM")}, ${time(issue.startsAt)} – ${time(issue.endsAt)}`;
}

/**
 * The refusal for sittings outside business hours that nobody confirmed. The server sends `issues` to the
 * client as `data.outsideHours`; practice mode throws this error as is.
 */
export class OutsideHoursError extends Error {
  readonly issues: OutsideHoursIssue[];
  constructor(issues: OutsideHoursIssue[]) {
    super(
      `${issues.length === 1 ? "This sitting is" : "These sittings are"} outside your business hours and ${issues.length === 1 ? "needs" : "each need"} your confirmation: ${issues
        .map(i => `${outsideHoursWhen(i)} (${describeOutsideHours(i)})`)
        .join("; ")}.`
    );
    this.name = "OutsideHoursError";
    this.issues = issues;
  }
}

const isIssue = (value: any): value is OutsideHoursIssue =>
  !!value &&
  typeof value.key === "string" &&
  typeof value.startsAt === "string" &&
  typeof value.endsAt === "string" &&
  typeof value.timeZone === "string" &&
  typeof value.day === "string" &&
  ["closed", "hours", "break"].includes(value.reason);

/** Recognises the refusal however it arrived: a tRPC error, a re-thrown practice error, or the error itself. */
export function outsideHoursFromError(
  error: unknown
): OutsideHoursIssue[] | null {
  const e = error as any;
  for (const found of [
    e?.data?.outsideHours,
    e?.issues,
    e?.cause?.issues,
    e?.cause?.data?.outsideHours,
    e?.shape?.data?.outsideHours,
  ])
    if (Array.isArray(found) && found.length && found.every(isIssue))
      return found;
  return null;
}
