import {
  findNextAvailableSlot,
  parseTime,
  WorkDay,
  AppointmentInterval,
} from "./server/services/booking.service";

const mockSchedule: WorkDay[] = [
  { day: "Monday", enabled: true, start: "09:00", end: "17:00" },
  { day: "Tuesday", enabled: true, start: "09:00", end: "17:00" },
  { day: "Wednesday", enabled: true, start: "09:00", end: "17:00" },
  { day: "Thursday", enabled: true, start: "09:00", end: "17:00" },
  { day: "Friday", enabled: true, start: "09:00", end: "17:00" },
  { day: "Saturday", enabled: false },
  { day: "Sunday", enabled: false },
];

const mockAppointments: AppointmentInterval[] = [];

// Test Case 1: Simple search in Sydney
// We simulate a search starting "Now" (UTC) which might be night in Sydney.
// Goal: Find 9am next day.

const now = new Date();
const timeZone = "Australia/Sydney";

console.log(`[Repro] Testing findNextAvailableSlot`);
console.log(`[Repro] Start (Local Node): ${now.toString()}`);
console.log(`[Repro] Timezone: ${timeZone}`);

try {
  const slot = findNextAvailableSlot(
    now,
    60, // 60 mins
    mockSchedule,
    mockAppointments,
    timeZone
  );

  if (slot) {
    console.log(`[Repro] SUCCESS. Found slot: ${slot.toISOString()}`);
    console.log(
      `[Repro] In target TZ: ${slot.toLocaleString("en-US", { timeZone })}`
    );
  } else {
    console.error(`[Repro] FAILED. No slot found.`);
  }
} catch (e) {
  console.error(`[Repro] CRASHED:`, e);
}

// Test Case 2: Specific Date in Future
console.log("\n[Repro] Testing future date 2026-06-01 (Monday)");
const futureStart = new Date("2026-06-01T00:00:00Z");
const slot2 = findNextAvailableSlot(
  futureStart,
  60,
  mockSchedule,
  mockAppointments,
  timeZone
);

if (slot2) {
  console.log(`[Repro] SUCCESS. Found slot: ${slot2.toISOString()}`);
  console.log(
    `[Repro] In target TZ: ${slot2.toLocaleString("en-US", { timeZone })}`
  );
} else {
  console.error(`[Repro] FAILED. No slot found.`);
}
