export const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type WorkDay = {
  day: string;
  enabled: boolean;
  start: string;
  end: string;
  type: string;
  breaks?: { start: string; end: string; [key: string]: unknown }[];
  [key: string]: unknown;
};
/** Both historic formats remain readable; unknown per-day properties survive edits. */
export function readSchedule(raw: string | null | undefined): WorkDay[] {
  let parsed: any = {};
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {}
  return weekdays.map(day => {
    const entry = Array.isArray(parsed)
      ? parsed.find((s: any) => String(s.day || "").toLowerCase() === day)
      : parsed?.[day];
    return {
      ...entry,
      day,
      enabled: !!entry?.enabled,
      start: entry?.start || entry?.startTime || "09:00",
      end: entry?.end || entry?.endTime || "17:00",
      type: entry?.type || "work",
      ...(Array.isArray(entry?.breaks)
        ? {
            breaks: entry.breaks.map((pause: any) => ({
              ...pause,
              start: pause.start || pause.startTime || "",
              end: pause.end || pause.endTime || "",
            })),
          }
        : {}),
    };
  });
}
export function writeSchedule(days: WorkDay[]) {
  return JSON.stringify(
    Object.fromEntries(
      days.map(d => [d.day, { ...d, startTime: d.start, endTime: d.end }])
    )
  );
}
