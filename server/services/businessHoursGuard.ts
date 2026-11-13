import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  OutsideHoursError,
  unconfirmedOutsideHours,
  type HoursSitting,
} from "../../shared/businessHours";
import {
  getBusinessTimezone,
  isValidTimezone,
} from "../../shared/utils/timezone";

/** Per-sitting confirmations from the artist; each key covers one exact start and end. */
export const confirmedOutsideHoursInput = z
  .array(z.string().max(64))
  .max(64)
  .optional();

/**
 * Refuses sittings outside the artist's business hours unless the artist confirmed each one. Only for
 * artist-initiated bookings and moves: clients accepting a proposed time, imports and jobs never call this.
 *
 * Hours are wall-clock times, read in the zone the sitting is booked in (the zone the booking screen and
 * the slot finder worked in), so the guard agrees with what the artist saw. The saved business zone is
 * the fallback when a booking carries no zone.
 */
export function requireHoursConfirmed(
  settings:
    | { workSchedule?: unknown; timeZone?: string | null }
    | null
    | undefined,
  sittings: HoursSitting[],
  confirmed?: readonly string[],
  bookedIn?: string | null
) {
  const issues = unconfirmedOutsideHours(
    settings?.workSchedule,
    bookedIn && isValidTimezone(bookedIn)
      ? bookedIn
      : getBusinessTimezone(settings?.timeZone || undefined),
    sittings,
    confirmed
  );
  if (!issues.length) return;
  const cause = new OutsideHoursError(issues);
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: cause.message,
    cause,
  });
}
