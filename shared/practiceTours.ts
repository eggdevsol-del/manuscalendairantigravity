/** Guided actions on the real artist UI. External confirmations are the only simulated controls. */
export type PracticeTourStep = {
  title: string;
  body: string;
  target?: string;
  mutation?: string;
  simulation?:
    | "deposit"
    | "forms"
    | "balance"
    | "approve"
    | "decline"
    | "reference"
    | "offer";
  review?: boolean;
  route?: string;
};
const action = (
  title: string,
  target: string,
  body: string,
  mutation?: string
): PracticeTourStep => ({ title, target, body, mutation });
const review = (
  title: string,
  target: string,
  body: string,
  route?: string
): PracticeTourStep => ({ title, target, body, route, review: true });
const simulate = (
  title: string,
  simulation: PracticeTourStep["simulation"],
  body: string
): PracticeTourStep => ({ title, simulation, body });
const openTools = action(
  "Open the conversation tools",
  "^Conversation tools$",
  "The same conversation tools you use with real clients open the booking and promotion flows."
);
const wizard = (project = false): PracticeTourStep[] => [
  openTools,
  action(
    "Book from this conversation",
    "^Book in$",
    "Keep the proposal linked to Alex’s design discussion."
  ),
  action(
    "Choose your saved service",
    project ? "^Sleeve project" : "^Full-day tattoo",
    "Tap the actual service. Its duration, sitting count and price populate the wizard."
  ),
  ...(project
    ? [
        action(
          "Choose the sitting frequency",
          "^Weekly$",
          "Choose weekly sittings for this mock sleeve."
        ),
        action(
          "Find available dates",
          "^Find available dates$",
          "The real availability engine checks your practice working hours and booked sittings."
        ),
      ]
    : []),
  ...(!project
    ? [
        action(
          "Choose a future sitting date",
          "^Date$",
          "Choose a future weekday using the actual date field. Today’s full-day fixture is already booked."
        ),
        action(
          "Set the full-day start time",
          "^Time$",
          "Set 09:00 in the actual time field so the eight-hour sitting fits your mock working day."
        ),
      ]
    : []),
  review(
    "Review the sitting details",
    "Session price",
    "Inspect the dates, duration, price and deposit. You can edit the real fields before continuing."
  ),
  action(
    "Review the complete proposal",
    "^Review proposal$",
    "Use the wizard’s review action; invalid dates or amounts must be corrected here."
  ),
  action(
    "Send the proposal",
    "^Send proposal$",
    "The actual submit action saves the proposal to your practice conversation.",
    "sessionPlans.create"
  ),
  simulate(
    "Alex accepts and pays the deposit",
    "deposit",
    "Simulate the client’s part. No card is charged, SMS sent or live booking created."
  ),
  review(
    "See the confirmed booking",
    "Booking|Full-day|Sleeve|Alex",
    "Open Calendar or the project to see the same confirmed mock sitting and payment values.",
    "/calendar"
  ),
];
const offerBooking: PracticeTourStep[] = [
  simulate(
    "Alex asks to use the offer",
    "offer",
    "Simulate Alex choosing this offer. A purchased mock gift voucher is funded without collecting real money."
  ),
  action(
    "Book using the offer",
    "^Book with this offer$",
    "Use the real pinned offer card. Its pricing and eligibility carry into the actual wizard."
  ),
  action(
    "Choose an eligible service",
    "^Full-day tattoo",
    "Use your saved service and the real promotion-aware date search."
  ),
  review(
    "Check the discounted proposal",
    "Session price",
    "Inspect the actual dates, offer adjustment and deposit before submitting."
  ),
  action(
    "Review the offer booking",
    "^Review proposal$",
    "Use the wizard’s real review button."
  ),
  action(
    "Send the offer booking",
    "^Send proposal$",
    "The offer remains unconfirmed until the simulated client deposit succeeds.",
    "sessionPlans.create"
  ),
  simulate(
    "Alex pays the deposit",
    "deposit",
    "The same mock booking, offer and payment records update across the app."
  ),
  review(
    "Review the confirmed offer booking",
    "Alex|Full-day|Booking",
    "Check the actual calendar and project.",
    "/calendar"
  ),
];
const promo = (fill = false, voucher = false): PracticeTourStep[] =>
  fill
    ? [
        action(
          "Open promotions",
          "Create a promotion|^Promotions$",
          "Open the real Promotions manager from Today."
        ),
        action(
          "Create a promotion",
          "^Create promotion$",
          "Open the normal campaign editor."
        ),
        review(
          "Set the calendar offer terms",
          "^Name$",
          "Enter a mock name, value, eligible months and short book-by expiry in the real form."
        ),
        action(
          "Save the promotion",
          "^Save promotion$",
          "Only the real successful save completes this step.",
          "offers.save"
        ),
        action(
          "Choose the audience",
          "^Choose audience$",
          "Open the actual recipient picker."
        ),
        review(
          "Set filters and recipients",
          "^Audience$",
          "Select Match filters, then choose presets, birthday months or cities. Or manually select several fictional clients."
        ),
        action(
          "Issue the offers",
          "^Add offers",
          "Check recipients and simulated notification choices before using the actual send action.",
          "offers.issue"
        ),
        review(
          "Open Alex’s consultation",
          "Conversation tools|Alex",
          "Return to the real message thread to continue the offer booking.",
          "/chat/1"
        ),
        ...offerBooking,
      ]
    : [
        openTools,
        action(
          "Create an offer for Alex",
          "^Create promo$",
          "Open the actual client-specific promotion flow."
        ),
        action(
          voucher ? "Choose a gift card" : "Choose a discount",
          voucher ? "^Sell a gift card" : "^Offer a discount",
          "Choose the actual offer type, using the same flow as a live client."
        ),
        review(
          "Edit the offer details",
          "Card title",
          "Use the real value, title, expiry and eligibility fields. Keep all values fictional."
        ),
        action(
          "Preview the card",
          "^Preview$",
          "The actual form validates your terms before opening the review screen."
        ),
        action(
          "Send to Alex",
          "^Send to client$",
          "Both campaign save and issue must succeed. A failure keeps the actual form available for correction.",
          "offers.issue"
        ),
        action(
          "Return to the conversation",
          "^Done$",
          "Review the real message thread and offer card."
        ),
        ...offerBooking,
      ];
export const PRACTICE_TOURS: Record<
  string,
  { route: string; steps: PracticeTourStep[] }
> = {
  enquiry: {
    route: "/conversations",
    steps: [
      action(
        "Open Alex’s conversation",
        "^Alex Taylor",
        "You have signed into the real artist workspace with fictional clients and a full-day sitting already populated."
      ),
      action(
        "Write your reply",
        "^Message$|^Write a message",
        "Type a fictional reply using the real message composer."
      ),
      action(
        "Reply to the booking enquiry",
        "^Send message$",
        "Type a reply in the real message composer asking about placement, size and style, then send it.",
        "messages.send"
      ),
      simulate(
        "Alex shares a reference",
        "reference",
        "A simulated client response adds a reference to Messages and Design & references."
      ),
      ...wizard(),
    ],
  },
  project: { route: "/chat/1", steps: wizard(true) },
  messages: {
    route: "/chat/1",
    steps: [
      action(
        "Write your reply",
        "^Message$|^Write a message",
        "Type a fictional reply in the actual message composer."
      ),
      action(
        "Send Alex a message",
        "^Send message$",
        "Use the real composer. Try text and a fixture reference image.",
        "messages.send"
      ),
      review(
        "Review the conversation context",
        "Design brief|Client information|Conversation tools",
        "Review the brief, references and client history using the actual thread controls."
      ),
      openTools,
    ],
  },
  session: {
    route: "/projects/1?session=1",
    steps: [
      review(
        "Prepare for the full-day sitting",
        "Ready for the session|Payment received|Payment outstanding",
        "Open the sitting details and review Alex’s project, shared references and payment history."
      ),
      simulate(
        "Alex completes the forms",
        "forms",
        "Simulated signed forms become available in the same practice record."
      ),
      action(
        "Finish the sitting",
        "^Finish session$|^Request remaining balance$",
        "Open the real finish-session form."
      ),
      action(
        "Request the remaining balance",
        "Finish & request payment|Request payment",
        "Check the amount, then submit the actual form.",
        "appointments.update|dashboard.requestPayment|messages.requestBalance"
      ),
      simulate(
        "Alex pays the final balance",
        "balance",
        "The simulated payment updates the sitting, project and earnings together."
      ),
      review(
        "Check the completed sitting",
        "completed|Payments|balance",
        "Review the actual project and payment records."
      ),
    ],
  },
  reschedule: {
    route: "/projects/1?session=1",
    steps: [
      action(
        "Reschedule this sitting",
        "^Reschedule$",
        "Open the actual reschedule form."
      ),
      review(
        "Choose a new available time",
        "New date",
        "Edit the real date and time inputs. Existing practice payments stay linked to the sitting."
      ),
      action(
        "Save the new time",
        "Save new time|Review new time|Send.*approval",
        "The real validation must succeed before the tutorial advances.",
        "appointments.reschedule"
      ),
      review(
        "Review the changed sitting",
        "Rescheduled|sitting|Alex",
        "See the updated date in the real calendar and project.",
        "/calendar"
      ),
    ],
  },
  "promo-reschedule": {
    route: "/projects/1?session=1",
    steps: [
      action(
        "Move a promotional sitting",
        "^Reschedule$",
        "Open the actual date-change form."
      ),
      review(
        "Review the promotion terms",
        "New date|Keep.*promotion",
        "Choose an out-of-month date. Decide whether to keep the discount or ask Alex to approve revised terms."
      ),
      action(
        "Send the change for approval",
        "Send.*approval|Save new time|Review new time",
        "Submit the real form and inspect any validation errors.",
        "appointments.reschedule"
      ),
      simulate(
        "Alex approves revised terms",
        "approve",
        "The old sitting stays booked until simulated acceptance succeeds."
      ),
      review(
        "Review updated records",
        "sitting|Payments|balance",
        "Check the real project’s date and payment totals."
      ),
    ],
  },
  promotion: { route: "/chat/1", steps: promo() },
  "calendar-fill": { route: "/dashboard", steps: promo(true) },
  voucher: { route: "/chat/1", steps: promo(false, true) },
  today: {
    route: "/dashboard",
    steps: [
      review(
        "Your populated artist day",
        "Needs attention",
        "Review real attention tasks, booked work and upcoming sittings."
      ),
      action(
        "Act on a follow-up",
        "Follow up",
        "Open the task in the real message thread."
      ),
      action(
        "Send the follow-up",
        "^Send message$",
        "Edit and send the actual practice message.",
        "messages.send"
      ),
      review(
        "Review your week",
        "Next 7 days|Next seven|Booked work",
        "Check mock upcoming work and remaining balances.",
        "/dashboard"
      ),
    ],
  },
  clients: {
    route: "/clients",
    steps: [
      action(
        "Open Alex’s record",
        "^Alex Taylor",
        "Open the real client record with history, contacts and references."
      ),
      review(
        "Review client history",
        "Session history|Client information|Notes",
        "Explore the real record tabs and previous mock bookings."
      ),
      action(
        "Open private notes",
        "^Notes$",
        "Open the actual client Notes tab."
      ),
      action(
        "Save a private note",
        "^Add note$|^Save note$",
        "Write a fictional note and submit the real form.",
        "clientProfile.addClientNote"
      ),
    ],
  },
  availability: {
    route: "/work-hours",
    steps: [
      review(
        "Review working availability",
        "Monday|Mon|Availability",
        "Edit actual working-day, time and break controls."
      ),
      action(
        "Save working hours",
        "^Save hours$|^Save availability$|^Save schedule$",
        "Persist the mock schedule using the real save action.",
        "artistSettings.upsert"
      ),
      action("Open services", "^Services$", "Use the actual services tab."),
      action(
        "Add a service",
        "^Add service$",
        "Open the normal editor and fill its real fields."
      ),
      action(
        "Save the service",
        "^Save service$",
        "The service becomes available in the actual practice booking wizard.",
        "artistSettings.upsert"
      ),
    ],
  },
  waitlist: {
    route: "/waitlist",
    steps: [
      review(
        "Review the waitlist",
        "Alex|Sam|Waitlist",
        "Inspect the actual interested mock clients."
      ),
      action(
        "Offer a time",
        "^Offer a time$",
        "Open the actual time-offer form."
      ),
      review(
        "Set the sitting and offer expiry",
        "Offer date and time",
        "Edit the real appointment time, estimate, deposit and expiry fields."
      ),
      action(
        "Send the offer",
        "^Send offer$",
        "The actual successful offer action saves the mock waitlist proposal.",
        "waitlist.offer"
      ),
    ],
  },
  forms: {
    route: "/settings?section=regulation",
    steps: [
      action(
        "Open your medical template",
        "^Medical$",
        "Use the actual form-management tabs."
      ),
      review(
        "Review the template wording",
        "Medical template",
        "Edit fictional medical wording using the real form."
      ),
      action(
        "Save the template",
        "^Save template$",
        "The actual save updates future mock forms only.",
        "forms.updateTemplates"
      ),
      simulate(
        "Alex signs the issued forms",
        "forms",
        "The simulated client signature becomes visible in the real project record."
      ),
      review(
        "Review signed forms",
        "Consent & medical forms|Client information",
        "Open Alex’s actual client record and Forms tab.",
        "/clients"
      ),
    ],
  },
  money: {
    route: "/money",
    steps: [
      review(
        "Review mock earnings",
        "Net|Income|earnings|Payments",
        "These are the real financial components, calculated from practice payments."
      ),
      action(
        "Open payments",
        "Payments|Transactions|Income",
        "Inspect the actual transactions and project links."
      ),
      review(
        "Review a transaction",
        "Alex|Full-day|Deposit",
        "Check sitting, amount, fees and remaining balance in the actual financial view."
      ),
    ],
  },
  bank: {
    route: "/bank-payouts",
    steps: [
      action(
        "Set up payments",
        "^Set up payments$|^Review account details$",
        "Open the actual setup sheet. Provider verification is simulated here."
      ),
      action(
        "Approve mock verification",
        "^Simulate verification approved$",
        "This explicit simulation replaces Stripe’s external identity and bank confirmation.",
        "artistSettings.submitStripeOnboarding"
      ),
      review(
        "Review payout readiness",
        "Payouts enabled|Payment account",
        "Check the actual connected-account status and payout controls."
      ),
    ],
  },
  profile: {
    route: "/artist-profile",
    steps: [
      review(
        "Edit your public profile",
        "Artist display name",
        "Use the real display-name, website and visibility fields."
      ),
      action(
        "Save your public profile",
        "^Save public profile$",
        "The actual save updates your isolated mock profile.",
        "artistSettings.upsert"
      ),
      action(
        "Open your portfolio",
        "^Portfolio$",
        "Use the actual portfolio tab and its fixture artwork."
      ),
      review(
        "Manage your portfolio",
        "Add to your portfolio|Add|Artwork",
        "Use the real media, ordering and removal controls. Practice substitutes fixture assets for R2 uploads."
      ),
    ],
  },
  imports: {
    route: "/settings?section=data-import",
    steps: [
      action(
        "Choose a fixture file",
        "^Use fictional import file$",
        "Load fictional rows into the actual import mapper."
      ),
      review(
        "Review column mapping",
        "Name|Email",
        "Use the real mapping controls and check each source column."
      ),
      action(
        "Review duplicates",
        "^Review matches & duplicates$",
        "The actual preview checks mock records.",
        "dataImport.preview"
      ),
      action(
        "Import ready rows",
        "^Import / retry",
        "Only ready mock rows are added; no live client records change.",
        "dataImport.commit"
      ),
      review(
        "Check imported clients",
        "Casey|Clients|Search clients",
        "See the newly imported fixture in the actual client list.",
        "/clients"
      ),
    ],
  },
  supplies: {
    route: "/supplies",
    steps: [
      action(
        "Choose a supplier",
        "Practice|Demo|Supply|Supplier",
        "Open a real supplier catalogue populated with mock products."
      ),
      action(
        "Choose a product",
        "Cartridge|Ink|Product",
        "Open the real product detail and choose a variant and quantity."
      ),
      action("Add to cart", "Add to cart", "Use the actual cart action."),
      action(
        "Open the cart",
        "Cart",
        "Review and adjust the actual cart quantities."
      ),
      review(
        "Review checkout",
        "Checkout|Delivery",
        "Use the real checkout form; payment is simulated and no supplier order is placed."
      ),
    ],
  },
  shopfront: {
    route: "/shopfront",
    steps: [
      action(
        "Open products",
        "Products",
        "Use the real artist shopfront controls."
      ),
      action(
        "Create a product",
        "Add product|New product",
        "Open the real product editor and use fixture artwork."
      ),
      action(
        "Save the product",
        "Save|Create",
        "The actual mutation updates only the mock shopfront.",
        "storefront.createProduct"
      ),
      review(
        "Review shopfront visibility",
        "Publish|Unpublish|Product",
        "Use the real publishing, event and order controls.",
        "/shopfront"
      ),
    ],
  },
  studio: {
    route: "/studio",
    steps: [
      review(
        "Name your mock studio",
        "Studio name",
        "Enter fictional details in the actual studio-creation form."
      ),
      action(
        "Create the studio",
        "^Create studio$",
        "The real submit creates a studio only inside practice records.",
        "studios.create"
      ),
      review(
        "Review team actions",
        "Invite|Team|Members|Studio",
        "Explore the actual studio controls, permissions and simulated billing."
      ),
    ],
  },
  settings: {
    route: "/settings",
    steps: [
      action(
        "Open your account settings",
        "Account|Profile",
        "Use the real settings navigation."
      ),
      review(
        "Edit fictional account details",
        "Name|Phone|City",
        "Change the actual form fields. Your live account remains untouched."
      ),
      action(
        "Save your changes",
        "Save",
        "Persist the mock account using the real submit action.",
        "auth.updateProfile|artistSettings.upsert"
      ),
      review(
        "Explore the other settings",
        "Notifications|Travel|Plans|Subscription",
        "Use the real preference, travel, notification and plan pages.",
        "/settings"
      ),
    ],
  },
};
