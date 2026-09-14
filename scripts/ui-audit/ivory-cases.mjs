const c = [];
const add = (role, path, title) =>
  c.push({
    id:
      role +
      "-" +
      (title || path)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, ""),
    role,
    path,
    title,
  });
for (const [path, title] of [
  ["/login", "Sign in"],
  ["/signup", "Client sign up"],
  ["/signup?role=artist", "Artist sign up"],
  ["/signup?role=merchant", "Supplier sign up"],
  ["/forgot-password", "Password recovery"],
  ["/set-password?token=preview", "Set password"],
  ["/auth/magic?token=preview", "Magic link"],
  ["/ella-morgan", "Public artist"],
  ["/start/ella-morgan", "Booking intake"],
  ["/book/ella-morgan", "Booking link"],
  ["/studio/northside", "Public studio"],
  ["/shop/ella-morgan", "Public shop"],
  ["/events/ella-morgan", "Public events"],
  ["/deposit/preview", "Deposit link"],
  ["/balance/101", "Balance link"],
  ["/pay/preview", "Payment request"],
])
  add("public", path, title);
for (const [path, title] of [
  ["/discover", "Discover"],
  ["/bookings", "Bookings"],
  ["/projects/12", "Booking overview"],
  ["/projects/12?view=Messages", "Booking messages"],
  ["/projects/12?view=Files", "Booking files"],
  ["/projects/12?view=Payments", "Booking payments"],
  ["/conversations", "Inbox"],
  ["/chat/12", "Conversation"],
  ["/profile", "Client profile"],
  ["/profile?tab=forms", "Client documents"],
  ["/waitlist", "Earlier appointments"],
  ["/purchases", "Purchases"],
  ["/complete-profile", "Complete profile"],
])
  add("client", path, title);
for (const [path, title] of [
  ["/dashboard", "Today"],
  ["/business", "Business"],
  ["/products", "Artist products"],
  ["/artist-events", "Artist events"],
  ["/store-orders", "Store orders"],
  ["/money", "Money"],
  ["/calendar", "Calendar"],
  ["/conversations", "Inbox"],
  ["/chat/12", "Conversation"],
  ["/projects/12", "Project overview"],
  ["/projects/12?view=Files", "Project files"],
  ["/projects/12?view=Payments", "Project payments"],
  ["/clients", "Clients"],
  ["/lead/1", "Booking request"],
  ["/waitlist", "Cancellation waitlist"],
  ["/artist-profile", "Artist profile"],
  ["/artist-profile?view=Portfolio", "Artist portfolio"],
  ["/work-hours", "Working hours"],
  ["/supplies", "Supplies"],
  ["/supply-orders", "Supply orders"],
  ["/purchases", "Purchases"],
  ["/bank-payouts", "Bank payouts"],
  ["/payout-history", "Payout history"],
  ["/notifications-management", "Notifications"],
  ["/subscriptions", "Plans"],
  ["/studio", "Studio schedule"],
  ["/studio?view=Team", "Studio team"],
  ["/studio?view=Billing", "Studio billing"],
  ["/studio?view=invitations", "Studio invitations"],
])
  add("artist", path, title);
for (const role of ["client", "artist", "merchant"]) {
  const prefix = role === "merchant" ? "/account-settings" : "/settings";
  add(role, prefix, "Settings");
  for (const section of ["profile", "notifications", "how-tos", "danger-zone"])
    add(role, prefix + "?section=" + section, "Settings " + section);
}
for (const section of [
  "business",
  "booking-link",
  "regulation",
  "travel",
  "data-import",
  "instagram",
  "consultations",
])
  add("artist", "/settings?section=" + section, "Settings " + section);
for (const [path, title] of [
  ["/dashboard", "Supplier home"],
  ["/merchant/orders", "Supplier orders"],
  ["/merchant/products", "Supplier products"],
  ["/settings", "Store settings"],
  ["/conversations", "Supplier inbox"],
  ["/chat/12", "Supplier conversation"],
  ["/purchases", "Supplier purchases"],
])
  add("merchant", path, title);
add("admin", "/admin/operations", "Operations");
add("admin", "/admin/errors", "Error reports");
add("client", "/not/a/route", "Not found");
export const cases = c;
