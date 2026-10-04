/** Artist page to tutorial mapping; public/client/supplier-only pages are deliberately absent. */
export const PRACTICE_ROUTES: Record<string, string> = {
  "/dashboard": "today",
  "/calendar": "enquiry",
  "/conversations": "messages",
  "/chat": "enquiry",
  "/projects": "session",
  "/clients": "clients",
  "/work-hours": "availability",
  "/waitlist": "waitlist",
  "/money": "money",
  "/payout-history": "money",
  "/bank-payouts": "bank",
  "/artist-profile": "profile",
  "/supplies": "supplies",
  "/supply-orders": "supplies",
  "/purchases": "supplies",
  "/shopfront": "shopfront",
  "/products": "shopfront",
  "/artist-events": "shopfront",
  "/store-orders": "shopfront",
  "/studio": "studio",
  "/subscriptions": "settings",
  "/settings": "settings",
  "/notifications-management": "settings",
  "/lead": "enquiry",
};
export function practiceChapterForRoute(path: string, search = "") {
  const section = new URLSearchParams(search).get("section");
  if (section === "regulation") return "forms";
  if (section === "data-import" || section === "instagram") return "imports";
  if (section === "booking-link" || section === "portfolio") return "profile";
  return PRACTICE_ROUTES["/" + path.split("/").filter(Boolean)[0]] ?? "today";
}
