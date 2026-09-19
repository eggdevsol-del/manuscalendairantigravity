/** Routes and contextual entry points for the entire shipped UI. */
export interface TourEntry {
  title: string;
  route: string;
  roles: string[];
  detail: string;
}
const artists = ["artist", "admin"],
  everyone = ["artist", "admin", "client", "merchant"];
const entry = (
  title: string,
  route: string,
  roles: string[],
  detail: string
): TourEntry => ({ title, route, roles, detail });
export const TOUR_CATALOGUE: TourEntry[] = [
  entry(
    "Home and appointment actions",
    "/dashboard",
    artists,
    "Attention, upcoming work, arrival and session actions."
  ),
  entry(
    "Calendar and booking planner",
    "/calendar",
    artists,
    "Dates, appointments, client, service, frequency, sittings and proposal review."
  ),
  entry(
    "Client records",
    "/clients",
    artists,
    "Search, add clients, contact details, sessions, notes and forms."
  ),
  entry(
    "Business workspace",
    "/business",
    artists,
    "Money, services, studio, marketing and business settings."
  ),
  entry(
    "Money and earnings",
    "/money",
    artists,
    "Recorded earnings, Stripe balances and payment history."
  ),
  entry(
    "Payments and refunds",
    "/payout-history",
    artists,
    "Payment records, refund preview and confirmation."
  ),
  entry(
    "Bank and payout setup",
    "/bank-payouts",
    artists,
    "Connect, verification, balance, payout schedule and disconnect confirmation."
  ),
  entry(
    "Working hours and services",
    "/work-hours",
    artists,
    "Work days, breaks, personal/design days and service pricing."
  ),
  entry(
    "Artist profile and portfolio",
    "/artist-profile",
    artists,
    "Public details, work gallery, upload and portfolio editing."
  ),
  entry(
    "Shopfront and products",
    "/products",
    artists,
    "Storefront settings, product details, variants, stock and availability."
  ),
  entry(
    "Events and seminars",
    "/artist-events",
    artists,
    "Create events, format, schedule, capacity, pricing and management."
  ),
  entry(
    "Store orders",
    "/store-orders",
    artists,
    "Orders, delivery details, items, payment and fulfilment handoff."
  ),
  entry(
    "Supplies and checkout",
    "/supplies",
    artists,
    "Supplier search, product variants, quantities, delivery and payment."
  ),
  entry(
    "Supply order history",
    "/supply-orders",
    artists,
    "Recorded orders, status and supplier handoff links."
  ),
  entry(
    "Studio workspace",
    "/studio",
    artists,
    "Schedule, team, invitations, billing and membership actions."
  ),
  entry(
    "Studio invitations",
    "/studio?view=invitations",
    artists,
    "Review invitations and accept or decline membership."
  ),
  entry(
    "Cancellation waitlist",
    "/waitlist",
    artists,
    "Waiting clients, offered times, expiry, estimates and deposits."
  ),
  entry(
    "Artist subscription",
    "/subscriptions",
    artists,
    "Current plans, subscription checkout and billing portal."
  ),
  entry(
    "Public booking link",
    "/settings?section=booking-link",
    artists,
    "Saved link, copying, sharing and public intake."
  ),
  entry(
    "Business details",
    "/settings?section=business",
    artists,
    "Contact details, location, licence and booking preferences."
  ),
  entry(
    "Consent and procedure records",
    "/settings?section=regulation",
    artists,
    "Medical and consent templates, issued forms and procedure log."
  ),
  entry(
    "Travel and guest spots",
    "/settings?section=travel",
    artists,
    "Trip dates, destinations, editing and nearby clients."
  ),
  entry(
    "Client and appointment imports",
    "/settings?section=data-import",
    artists,
    "CSV selection, column mapping, service mapping, preview and import results."
  ),
  entry(
    "Instagram imports",
    "/settings?section=instagram",
    artists,
    "Account lookup, selection, import limits and results."
  ),
  entry(
    "Consultation requests",
    "/settings?section=consultations",
    artists,
    "Request details, references, conversation and archive confirmation."
  ),
  entry(
    "Notification management",
    "/notifications-management",
    artists,
    "Device permission, reminders and saved message templates."
  ),
  entry(
    "Bookings and project workspace",
    "/bookings",
    ["client"],
    "Open a booking: overview, messages, files, payment, sittings, consent and aftercare each join the guide."
  ),
  entry(
    "Discover artists",
    "/discover",
    ["client"],
    "Video, artwork, favourites, artist details and enquiry forms."
  ),
  entry(
    "Client profile",
    "/profile",
    ["client"],
    "Profile details, forms, medical information and preferences."
  ),
  entry(
    "Earlier appointment offers",
    "/waitlist",
    ["client"],
    "Waitlist enrolment, cancellation offers, acceptance and payment."
  ),
  entry(
    "Messages and shared booking details",
    "/conversations",
    everyone,
    "Open a thread: compose, attachments, history, design brief, notes, booking plans and payment requests."
  ),
  entry(
    "Purchases",
    "/purchases",
    everyone,
    "Product orders, event registrations, order details and status."
  ),
  entry(
    "Supplier home",
    "/dashboard",
    ["merchant"],
    "Recorded sales, fulfilment, stock and payment-account readiness."
  ),
  entry(
    "Supplier catalogue",
    "/merchant/products",
    ["merchant"],
    "Imported products, search, availability and Shopify editing."
  ),
  entry(
    "Supplier orders",
    "/merchant/orders",
    ["merchant"],
    "Orders, customer delivery details and Shopify fulfilment."
  ),
  entry(
    "Supplier settings",
    "/settings",
    ["merchant"],
    "Business details, Stripe, Shopify connection and catalogue imports."
  ),
  entry(
    "Settings",
    "/settings",
    ["artist", "admin", "client"],
    "Account, business, appearance, update, help and sign out."
  ),
  entry(
    "Account settings",
    "/account-settings",
    ["merchant"],
    "Profile, notification preferences, appearance, updates and account controls."
  ),
  ...everyone.flatMap(role => {
    const path = role === "merchant" ? "/account-settings" : "/settings";
    return [
      entry(
        "Edit account details",
        path + "?section=profile",
        [role],
        "Photo, name, contact details and profile fields."
      ),
      entry(
        "Device notifications and templates",
        path + "?section=notifications",
        [role],
        "Device permissions and the notification controls available to your account."
      ),
      entry(
        "Account removal",
        path + "?section=danger-zone",
        [role],
        "Read deletion consequences and confirmation requirements; the tour never deletes your account."
      ),
    ];
  }),
  entry(
    "Operations",
    "/admin/operations",
    ["admin"],
    "Checkout confirmation, failed notification delivery and outstanding forms."
  ),
  entry(
    "Error reports",
    "/admin/errors",
    ["admin"],
    "Filters, details, resolution and record-cleanup confirmation."
  ),
];
/** Contexts reached with real record IDs or public links, never invented records. */
export const CONTEXTUAL_TOUR_COVERAGE = [
  "Project overview, messages, files, payment and sitting details",
  "Thread composer, attachments, brief, media and client details",
  "Booking client, service, frequency, dates, review and proposal",
  "Sitting completion, rescheduling, pricing discussion and cancellation",
  "Consent and medical form fields, signature and submission",
  "Session-plan deposit, balance, public payment request and payment status",
  "Product variants, cart, delivery, checkout and order details",
  "Event creation, editing, booking and registrations",
  "Studio creation, invitations, roles, member removal and billing checkout",
  "Waitlist offer, response, expiry and checkout",
  "Client, portfolio, service, hours, travel and template editors",
  "Import mapping, preview, conflicts and results",
  "Login, signup, recovery, secure-link sign-in and profile completion",
  "Public artist, booking enquiry, studio, shopfront and events",
  "Account deletion, disconnect, refund and other confirmation sheets",
] as const;
