const click =
  (name, role = "button") =>
  async p =>
    p
      .getByRole(role, { name, exact: true })
      .filter({ visible: true })
      .first()
      .click();
const fill = (name, value) => async p =>
  p
    .getByLabel(name, { exact: true })
    .filter({ visible: true })
    .first()
    .fill(value);
const flows = [];
function flow(id, role, path, title, steps) {
  flows.push({
    id: "flow-" + id,
    role,
    path,
    title,
    before: async p => {
      for (const step of steps) await step(p);
    },
  });
}
const newBooking = [click("New booking"), click(/Mia Chen/)];
flow("booking-client", "artist", "/calendar", "Booking / choose client", [
  click("New booking"),
]);
flow(
  "booking-service",
  "artist",
  "/calendar",
  "Booking / choose service",
  newBooking
);
flow(
  "booking-frequency",
  "artist",
  "/calendar",
  "Booking / sitting frequency",
  [...newBooking, click(/Botanical sleeve/)]
);
flow(
  "booking-review",
  "artist",
  "/calendar",
  "Booking / review three sittings",
  [...newBooking, click(/Botanical sleeve/), click("Find available dates")]
);
flow("booking-single", "artist", "/calendar", "Booking / single sitting", [
  ...newBooking,
  click(/Full day/),
]);
flow("new-client", "artist", "/clients", "Clients / add client", [
  click("Add client"),
]);
flow("client-detail", "artist", "/clients", "Clients / details", [
  click(/Mia Chen/),
]);
flow("client-forms", "artist", "/clients", "Clients / forms", [
  click(/Mia Chen/),
  click("Forms", "tab"),
]);
flow("client-notes", "artist", "/clients", "Clients / notes", [
  click(/Mia Chen/),
  click("Notes", "tab"),
]);
flow("private-notes", "artist", "/chat/12", "Conversation / private notes", [
  async p =>
    p.getByText("Client records & private notes", { exact: true }).click(),
]);
flow("design-brief", "artist", "/chat/12", "Conversation / expanded brief", [
  click(/Design brief/),
]);
flow("services", "artist", "/work-hours", "Services / catalogue", [
  click("Services", "tab"),
]);
flow("service-editor", "artist", "/work-hours", "Services / add service", [
  click("Services", "tab"),
  click("Add service"),
]);
flow(
  "portfolio-upload",
  "artist",
  "/artist-profile?view=Portfolio",
  "Portfolio / add artwork",
  [click("Add photo")]
);
flow(
  "travel-add",
  "artist",
  "/settings?section=travel",
  "Travel / add destination",
  [click("Add trip")]
);
flow("studio-remove", "artist", "/studio?view=Team", "Studio / remove member", [
  click("Remove"),
]);
flow(
  "consent-template",
  "artist",
  "/settings?section=regulation",
  "Forms / consent template",
  [click("Consent", "tab")]
);
flow(
  "medical-template",
  "artist",
  "/settings?section=regulation",
  "Forms / medical template",
  [click("Medical", "tab")]
);
flow("past-bookings", "client", "/bookings", "Bookings / past", [
  click("Past", "tab"),
]);
flow("deposit-review", "client", "/bookings", "Payments / deposit review", [
  click(/Review .*deposit/),
]);
flow("client-consent", "client", "/bookings", "Consent / review document", [
  click(/Complete sitting/, "link"),
]);
flow(
  "order-detail",
  "merchant",
  "/merchant/orders",
  "Supplier / order detail",
  [click(/Order #1/)]
);
flow(
  "product-details",
  "merchant",
  "/merchant/products",
  "Supplier / product variants",
  [
    async p =>
      p.locator("summary").filter({ hasText: "View 1 variants" }).click(),
  ]
);
flow("archive-request", "artist", "/lead/1", "Enquiry / archive review", [
  click("Archive request"),
]);
const intro = [
  fill(
    "What would you like tattooed?",
    "Fine-line peonies on my forearm, with room to extend later."
  ),
  async p => p.getByLabel("Fine Line", { exact: true }).check(),
  click("Continue"),
];
const placement = [
  ...intro,
  fill("Placement", "Outer forearm"),
  async p =>
    p.getByLabel("Preferred timeframe").selectOption("Within 3 months"),
  click("Continue"),
];
flow("intake-idea", "public", "/book/ella-morgan", "Intake / idea", []);
flow(
  "intake-placement",
  "public",
  "/book/ella-morgan",
  "Intake / placement",
  intro
);
flow(
  "intake-reference",
  "public",
  "/book/ella-morgan",
  "Intake / reference images",
  placement
);
flow(
  "intake-placement-photo",
  "public",
  "/book/ella-morgan",
  "Intake / placement photos",
  [...placement, click("Continue")]
);
const details = [...placement, click("Continue"), click("Continue")];
flow(
  "intake-details",
  "public",
  "/book/ella-morgan",
  "Intake / contact details",
  details
);
flow("intake-review", "public", "/book/ella-morgan", "Intake / review", [
  ...details,
  fill("First name", "Mia"),
  fill("Last name", "Chen"),
  fill("Email", "mia@example.test"),
  fill("Phone", "0400000000"),
  fill("Date of birth", "1995-02-03"),
  async p => p.getByLabel("Gender", { exact: true }).selectOption("female"),
  click("Continue"),
]);
flow("consent-signature", "client", "/bookings", "Consent / signature", [
  click(/Complete sitting/, "link"),
  click("Continue to signature"),
]);
flow(
  "notification-template",
  "artist",
  "/notifications-management",
  "Notifications / new template",
  [click("Add template")]
);
flow("refund-review", "artist", "/payout-history", "Payments / review refund", [
  click("Review refund"),
]);
flow("session-reschedule", "artist", "/projects/12", "Session / reschedule", [
  click("Reschedule"),
]);
flow("session-cancel", "artist", "/projects/12", "Session / cancellation", [
  async p =>
    p.locator("summary").filter({ hasText: "More session options" }).click(),
  click("Cancel session"),
]);
flow(
  "session-finish",
  "artist",
  "/projects/12",
  "Session / finish and balance",
  [
    click("Finish session"),
  ]
);
flow(
  "portfolio",
  "artist",
  "/artist-profile?view=Portfolio",
  "Portfolio / selected work",
  []
);
flow(
  "portfolio-view",
  "artist",
  "/artist-profile?view=Portfolio",
  "Portfolio / artwork detail",
  [async p => p.locator(".v3-media-preview").first().click()]
);
flow(
  "import-mapping",
  "artist",
  "/settings?section=data-import",
  "Import / map CSV fields",
  [
    async p =>
      p
        .locator('input[type="file"]').first()
        .setInputFiles({
          name: "clients.csv",
          mimeType: "text/csv",
          buffer: Buffer.from(
            "name,email,phone\nMia Chen,mia@example.test,0400000000"
          ),
        }),
  ]
);
flow("shop-cart", "public", "/shop/ella-morgan", "Shop / cart", [
  click("Add to cart"),
]);
flow(
  "payment-confirming",
  "public",
  "/deposit/preview?status=success",
  "Payments / awaiting confirmation",
  []
);
flow(
  "balance-confirming",
  "public",
  "/balance/101?status=success",
  "Payments / balance pending",
  []
);
flow("discovery-home", "client", "/discover", "Discovery / your artists", [
  click("Your artists and bookings"),
]);
flow("discovery-focus", "client", "/discover", "Discovery / artist focus", [
  async p => p.locator(".feed-card-focus-image").first().click(),
]);
flow("event-create", "artist", "/artist-events", "Events / create workshop", [
  click("Create event"),
]);
flows.find(f => f.id === "flow-session-finish").time = "2026-09-10T01:00:00Z";
export { flows };
