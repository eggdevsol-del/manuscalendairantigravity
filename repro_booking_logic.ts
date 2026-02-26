import {
  calculateProjectDates,
  WorkDay,
  AppointmentInterval,
  ProjectAvailabilityInput,
} from "./server/services/booking.service";

// Mock Work Schedule: Mon-Fri 09:00 - 17:00
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

console.log("--- Starting Test 1: Simple Consecutive ---");
try {
  const input: ProjectAvailabilityInput = {
    serviceDuration: 60, // 1 hour
    sittings: 3,
    frequency: "consecutive",
    startDate: new Date(), // Today
    workSchedule: mockSchedule,
    existingAppointments: mockAppointments,
  };
  const dates = calculateProjectDates(input);
  console.log("Test 1 Result:", dates);
} catch (e) {
  console.error("Test 1 Failed:", e);
}

console.log("\n--- Starting Test 2: Weekly with Collision ---");
try {
  // Add collision for next week same time
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(10, 0, 0, 0);

  const collisionAppt = {
    startTime: nextWeek,
    endTime: new Date(nextWeek.getTime() + 60 * 60000),
  };

  const input2: ProjectAvailabilityInput = {
    serviceDuration: 120, // 2 hours
    sittings: 2,
    frequency: "weekly",
    startDate: new Date(),
    workSchedule: mockSchedule,
    existingAppointments: [collisionAppt],
  };
  const dates2 = calculateProjectDates(input2);
  console.log("Test 2 Result:", dates2);
} catch (e) {
  console.error("Test 2 Failed:", e);
}

console.log("\n--- Starting Test 3: Past Start Date ---");
try {
  const dates3 = calculateProjectDates({
    serviceDuration: 60,
    sittings: 1,
    frequency: "consecutive",
    startDate: new Date("2020-01-01"), // Past
    workSchedule: mockSchedule,
    existingAppointments: [],
  });
  console.log("Test 3 Result:", dates3);
} catch (e) {
  console.error("Test 3 Failed:", e);
}

console.log("\n--- Done ---");
