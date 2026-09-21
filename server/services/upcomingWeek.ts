import { addDays, format } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { sittingFinancials } from "./sittingFinancials";

export function upcomingWeekWindow(now: Date, timeZone: string) {
  const first = formatInTimeZone(now, timeZone, "yyyy-MM-dd");
  const localDate = (offset: number) =>
    format(addDays(new Date(first + "T12:00:00"), offset), "yyyy-MM-dd");
  const sqlDate = (date: string) =>
    fromZonedTime(date + "T00:00:00", timeZone)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
  return {
    dates: Array.from({ length: 7 }, (_, i) => localDate(i)),
    start: sqlDate(first),
    end: sqlDate(localDate(7)),
  };
}
export function appointmentInstant(value: string) {
  const iso = value.replace(" ", "T");
  return new Date(/[Zz]$|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z");
}
export function upcomingSittings<
  T extends Parameters<typeof sittingFinancials>[0] & {
    status: string;
    startTime: string;
    endTime: string;
  },
>(rows: T[], now: Date, timeZone: string) {
  const window = upcomingWeekWindow(now, timeZone);
  return rows
    .filter(
      a =>
        a.status === "confirmed" &&
        appointmentInstant(a.endTime) > now &&
        appointmentInstant(a.startTime) >= appointmentInstant(window.start) &&
        appointmentInstant(a.startTime) < appointmentInstant(window.end)
    )
    .map(a => ({
      ...a,
      startTime: appointmentInstant(a.startTime).toISOString(),
      endTime: appointmentInstant(a.endTime).toISOString(),
      date: formatInTimeZone(
        appointmentInstant(a.startTime),
        timeZone,
        "yyyy-MM-dd"
      ),
      ...sittingFinancials(a),
    }));
}
