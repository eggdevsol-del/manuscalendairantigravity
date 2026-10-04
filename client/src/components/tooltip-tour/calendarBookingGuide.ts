import type { TourDefinition } from "./TooltipTourProvider";

export const CALENDAR_BOOKING_GUIDE: TourDefinition = {
  id: "calendar-first-booking",
  steps: [
    {
      targetId: "css:[data-calendar-booking-entry]",
      title: "Start with a client conversation",
      body: "Bookings are agreed through Messages. Discuss the tattoo, share references and confirm the scope with your client before proposing dates and a price.",
    },
    {
      targetId: 'css:#bottom-nav a[href="/conversations"]',
      title: "Open Messages, then choose your client",
      body: "Open the client’s conversation, tap the three-dot Conversation tools button, then select Book in. If they want to use a promotion, choose Book with this offer so its rules carry into the booking.",
    },
    {
      targetId: 'css:#bottom-nav a[href="/conversations"]',
      title: "Review, send and secure the booking",
      body: "Choose a service and suitable dates, then review the sittings, project total and deposit before sending the proposal. Your client reviews it in the same conversation. The booking is confirmed after the required deposit is paid—not simply when the proposal is sent.",
    },
  ],
};

export function firstCalendarBookingVisit(userId: string) {
  const key = `tattoi:calendar-booking-guide:v1:${encodeURIComponent(userId)}`;
  try {
    if (localStorage.getItem(key) === "shown") return false;
    localStorage.setItem(key, "shown");
  } catch {
    /* The component also tracks this visit in memory. */
  }
  return true;
}
